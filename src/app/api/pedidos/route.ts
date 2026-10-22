import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calcularDiasRestantes, getEstadoVencimiento } from '@/lib/utils';
import { calcularEstadoApertura } from '@/lib/horarios';
import { generarEnlaceWhatsApp, generarMensajeWhatsApp } from '@/lib/whatsapp';

const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const now = Date.now();

    const rateData = ipRateLimitMap.get(ip);
    if (rateData) {
      if (now > rateData.resetAt) {
        ipRateLimitMap.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
      } else if (rateData.count >= 10) {
        return NextResponse.json(
          {
            error:
              'Límite de solicitudes alcanzado. Por favor aguardá unos minutos antes de volver a ordenar.',
          },
          { status: 429 }
        );
      } else {
        rateData.count += 1;
      }
    } else {
      ipRateLimitMap.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    }

    const body = await req.json();
    const {
      negocio_id,
      cliente_nombre,
      cliente_telefono,
      tipo_entrega,
      direccion,
      referencias_direccion,
      observaciones,
      medio_pago,
      items,
      honeypot,
    } = body;

    if (honeypot && honeypot.trim() !== '') {
      return NextResponse.json({ error: 'Solicitud rechazada.' }, { status: 400 });
    }

    if (
      !negocio_id ||
      !cliente_nombre ||
      !cliente_telefono ||
      !tipo_entrega ||
      !items ||
      !items.length
    ) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios para registrar el pedido.' },
        { status: 400 }
      );
    }

    if (tipo_entrega === 'envio' && (!direccion || !direccion.trim())) {
      return NextResponse.json(
        { error: 'Para entregas a domicilio debés ingresar una dirección.' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Obtener datos completos del negocio y verificar vigencia, apertura y WhatsApp
    const { data: negocio, error: negError } = await adminSupabase
      .from('negocios')
      .select('*')
      .eq('id', negocio_id)
      .single();

    if (negError || !negocio) {
      return NextResponse.json(
        { error: 'El negocio no existe o no se encuentra disponible.' },
        { status: 404 }
      );
    }

    const diasRestantes = calcularDiasRestantes(negocio.fecha_vencimiento);
    const estadoVencimiento = getEstadoVencimiento(diasRestantes);

    if (!negocio.activo || estadoVencimiento === 'vencido') {
      return NextResponse.json(
        {
          error:
            'Servicio no disponible: La suscripción de este comercio se encuentra inactiva o vencida.',
        },
        { status: 403 }
      );
    }

    if (!negocio.whatsapp_numero) {
      return NextResponse.json(
        { error: 'Este negocio aún no recibe pedidos online por WhatsApp.' },
        { status: 400 }
      );
    }

    const estadoApertura = calcularEstadoApertura(negocio);
    if (!estadoApertura.abierto) {
      return NextResponse.json(
        {
          error: `El negocio se encuentra cerrado en este momento. ${estadoApertura.proximoHorarioTexto}`,
        },
        { status: 403 }
      );
    }

    // 2. Validar productos y calcular precios en servidor
    const productIds = items.map((i: { producto_id: string }) => i.producto_id);
    const { data: dbProducts, error: prodError } = await adminSupabase
      .from('productos')
      .select('id, nombre, precio_venta, visible_catalogo')
      .in('id', productIds)
      .eq('negocio_id', negocio_id);

    if (prodError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json({ error: 'Productos no válidos.' }, { status: 400 });
    }

    const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

    let totalCalculado = 0;
    const itemsValidados = [];

    for (const item of items) {
      const dbProd = prodMap.get(item.producto_id);
      if (!dbProd || !dbProd.visible_catalogo) continue;

      const cantidad = Math.max(1, parseInt(item.cantidad, 10) || 1);
      const subtotal = dbProd.precio_venta * cantidad;
      totalCalculado += subtotal;

      itemsValidados.push({
        producto_id: dbProd.id,
        nombre_producto: dbProd.nombre,
        precio_unitario: dbProd.precio_venta,
        cantidad,
        subtotal,
        aclaraciones: item.aclaraciones || null,
      });
    }

    if (itemsValidados.length === 0) {
      return NextResponse.json({ error: 'No hay productos válidos en el carrito.' }, { status: 400 });
    }

    // 3. Si es envío, buscar cadete/empresa por defecto y calcular aviso programado
    let cadetePredeterminadoId: string | null = null;
    let asignadoAt: string | null = null;
    let avisoProgramadoAt: string | null = null;

    if (tipo_entrega === 'envio') {
      const { data: defaultCadete } = await adminSupabase
        .from('cadetes')
        .select('id')
        .eq('negocio_id', negocio_id)
        .eq('activo', true)
        .eq('es_predeterminado', true)
        .maybeSingle();

      if (defaultCadete) {
        cadetePredeterminadoId = defaultCadete.id;
        asignadoAt = new Date().toISOString();
      }

      const momento = negocio.momento_aviso_cadeteria || 'listo';
      const prepMin = negocio.tiempo_preparacion_min ?? 30;
      const antesMin = negocio.minutos_antes_aviso ?? 10;

      if (momento === 'al_aceptar') {
        avisoProgramadoAt = new Date().toISOString();
      } else if (momento === 'minutos_antes') {
        const delayMin = Math.max(0, prepMin - antesMin);
        const target = new Date();
        target.setMinutes(target.getMinutes() + delayMin);
        avisoProgramadoAt = target.toISOString();
      }
    }

    const medioPagoValido =
      medio_pago && ['efectivo', 'transferencia', 'mercadopago'].includes(medio_pago)
        ? medio_pago
        : null;

    // 4. Insertar pedido en base de datos
    const { data: nuevoPedido, error: pedInsertError } = await adminSupabase
      .from('pedidos')
      .insert({
        negocio_id,
        origen: 'online',
        cliente_nombre: cliente_nombre.trim(),
        cliente_telefono: cliente_telefono.trim(),
        tipo_entrega,
        direccion: tipo_entrega === 'envio' ? direccion.trim() : null,
        referencias_direccion:
          tipo_entrega === 'envio' && referencias_direccion ? referencias_direccion.trim() : null,
        observaciones: observaciones ? observaciones.trim() : null,
        total: totalCalculado,
        medio_pago: medioPagoValido,
        estado_pago: 'pendiente',
        monto_a_cobrar:
          tipo_entrega === 'envio' && medioPagoValido === 'efectivo' ? totalCalculado : null,
        estado: 'nuevo',
        cadete_id: cadetePredeterminadoId,
        aceptado_at: new Date().toISOString(),
        asignado_at: asignadoAt,
        aviso_programado_at: avisoProgramadoAt,
      })
      .select('id, numero_pedido, created_at')
      .single();

    if (pedInsertError || !nuevoPedido) {
      throw new Error(pedInsertError?.message || 'Error guardando pedido en base de datos');
    }

    // 5. Insertar items del pedido
    const itemsParaInsertar = itemsValidados.map((it) => ({
      pedido_id: nuevoPedido.id,
      negocio_id,
      producto_id: it.producto_id,
      nombre_producto: it.nombre_producto,
      precio_unitario: it.precio_unitario,
      cantidad: it.cantidad,
      subtotal: it.subtotal,
      aclaraciones: it.aclaraciones,
    }));

    await adminSupabase.from('pedido_items').insert(itemsParaInsertar);

    // 6. Generar mensaje de WhatsApp y enlace wa.me
    const paramsWA = {
      negocioNombre: negocio.nombre,
      numeroPedido: nuevoPedido.numero_pedido,
      clienteNombre: cliente_nombre.trim(),
      clienteTelefono: cliente_telefono.trim(),
      tipoEntrega: tipo_entrega,
      direccion: tipo_entrega === 'envio' ? direccion.trim() : null,
      referencias: referencias_direccion ? referencias_direccion.trim() : null,
      observaciones: observaciones ? observaciones.trim() : null,
      items: itemsValidados.map((it) => ({
        nombre: it.nombre_producto,
        cantidad: it.cantidad,
        precio: it.precio_unitario,
        subtotal: it.subtotal,
        aclaraciones: it.aclaraciones,
      })),
      total: totalCalculado,
      whatsappNumero: negocio.whatsapp_numero,
      fecha: nuevoPedido.created_at,
    };

    const mensajeTexto = generarMensajeWhatsApp(paramsWA);
    const whatsappUrl = generarEnlaceWhatsApp(paramsWA);

    return NextResponse.json({
      success: true,
      pedido_id: nuevoPedido.id,
      numero_pedido: nuevoPedido.numero_pedido,
      total: totalCalculado,
      mensaje_texto: mensajeTexto,
      whatsapp_url: whatsappUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar el pedido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
