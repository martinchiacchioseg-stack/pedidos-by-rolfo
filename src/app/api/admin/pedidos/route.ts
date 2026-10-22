import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET(req: NextRequest) {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile, negocio } = auth;
  const searchParams = req.nextUrl.searchParams;
  const estado = searchParams.get('estado');
  const origen = searchParams.get('origen');
  const fecha = searchParams.get('fecha');

  let query = adminSupabase
    .from('pedidos')
    .select('*, items:pedido_items(*), cadete:cadetes(*)')
    .eq('negocio_id', profile.negocio_id)
    .order('created_at', { ascending: false });

  if (estado && estado !== 'todos') {
    query = query.eq('estado', estado);
  }

  if (origen && origen !== 'todos') {
    query = query.eq('origen', origen);
  }

  if (fecha) {
    // Filtrar considerando el día en Argentina (-03:00)
    const inicio = `${fecha}T00:00:00.000-03:00`;
    const fin = `${fecha}T23:59:59.999-03:00`;
    query = query.gte('created_at', inicio).lte('created_at', fin);
  }

  const [{ data: pedidos, error }, { data: cadetes }] = await Promise.all([
    query,
    adminSupabase
      .from('cadetes')
      .select('*')
      .eq('negocio_id', profile.negocio_id)
      .eq('activo', true)
      .order('es_predeterminado', { ascending: false })
      .order('nombre', { ascending: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    pedidos: (pedidos || []).filter((p: { es_prueba?: boolean }) => !p.es_prueba),
    cadetes: cadetes || [],
    negocio,
    role: profile.role,
  });
}

/**
 * POST /api/admin/pedidos
 * Carga rápida de Pedido Manual (mostrador o telefónico) por admin o vendedor.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile, negocio, estaVencido } = auth;
  if (estaVencido) {
    return NextResponse.json({ error: 'El plan del negocio se encuentra vencido.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      cliente_nombre,
      cliente_telefono,
      tipo_entrega,
      direccion,
      referencias_direccion,
      observaciones,
      medio_pago,
      estado_pago,
      monto_a_cobrar,
      cadete_id,
      items,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Seleccioná al menos un producto para el pedido.' }, { status: 400 });
    }

    if (tipo_entrega === 'envio' && (!direccion || !direccion.trim())) {
      return NextResponse.json(
        { error: 'La dirección de entrega es obligatoria para pedidos con envío.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // Si es envío y no se especificó cadete, buscar cadete predeterminado activo
    let cadeteAsignado = cadete_id || null;
    if (tipo_entrega === 'envio' && !cadeteAsignado) {
      const { data: defaultCadete } = await adminSupabase
        .from('cadetes')
        .select('id')
        .eq('negocio_id', profile.negocio_id)
        .eq('activo', true)
        .eq('es_predeterminado', true)
        .limit(1)
        .maybeSingle();
      if (defaultCadete) {
        cadeteAsignado = defaultCadete.id;
      }
    }

    let avisoProgramadoAt: string | null = null;
    if (tipo_entrega === 'envio') {
      const momento = negocio.momento_aviso_cadeteria || 'listo';
      const prepMin = Number(negocio.tiempo_preparacion_min) || 30;
      const antesMin = Number(negocio.minutos_antes_aviso) || 10;
      if (momento === 'al_aceptar') {
        avisoProgramadoAt = nowIso;
      } else if (momento === 'minutos_antes') {
        const delayMs = Math.max(0, prepMin - antesMin) * 60 * 1000;
        avisoProgramadoAt = new Date(Date.now() + delayMs).toISOString();
      }
    }

    let totalCalculado = 0;
    const itemsFormateados = items.map(
      (item: {
        producto_id?: string;
        nombre_producto: string;
        cantidad: number;
        precio_unitario: number;
        aclaraciones?: string;
      }) => {
        const cant = Math.max(1, Number(item.cantidad) || 1);
        const precio = Number(item.precio_unitario) || 0;
        const subtotal = cant * precio;
        totalCalculado += subtotal;
        return {
          producto_id: item.producto_id || null,
          nombre_producto: item.nombre_producto,
          cantidad: cant,
          precio_unitario: precio,
          subtotal,
          aclaraciones: item.aclaraciones || null,
        };
      }
    );

    const montoCobrarFinal =
      monto_a_cobrar !== undefined && monto_a_cobrar !== null && monto_a_cobrar !== ''
        ? Number(monto_a_cobrar)
        : medio_pago === 'efectivo' && estado_pago !== 'pagado'
        ? totalCalculado
        : 0;

    const { data: nuevoPedido, error: pedidoError } = await adminSupabase
      .from('pedidos')
      .insert({
        negocio_id: profile.negocio_id,
        cliente_nombre: cliente_nombre?.trim() || 'Cliente Mostrador',
        cliente_telefono: cliente_telefono?.trim() || 'Mostrador',
        tipo_entrega: tipo_entrega === 'envio' ? 'envio' : 'retiro',
        direccion: tipo_entrega === 'envio' ? direccion.trim() : null,
        referencias_direccion: tipo_entrega === 'envio' && referencias_direccion ? referencias_direccion.trim() : null,
        observaciones: observaciones?.trim() || null,
        total: totalCalculado,
        estado: 'nuevo',
        origen: 'manual',
        medio_pago: medio_pago || 'efectivo',
        estado_pago: estado_pago || 'pendiente',
        monto_a_cobrar: montoCobrarFinal,
        cadete_id: tipo_entrega === 'envio' ? cadeteAsignado : null,
        aceptado_at: nowIso,
        asignado_at: tipo_entrega === 'envio' && cadeteAsignado ? nowIso : null,
        aviso_programado_at: avisoProgramadoAt,
      })
      .select('*')
      .single();

    if (pedidoError || !nuevoPedido) {
      throw new Error(pedidoError?.message || 'Error al registrar el pedido manual');
    }

    const itemsConPedidoId = itemsFormateados.map((it) => ({
      ...it,
      pedido_id: nuevoPedido.id,
      negocio_id: profile.negocio_id,
    }));

    const { error: itemsError } = await adminSupabase.from('pedido_items').insert(itemsConPedidoId);
    if (itemsError) {
      throw new Error(itemsError.message);
    }

    const { data: pedidoCompleto } = await adminSupabase
      .from('pedidos')
      .select('*, items:pedido_items(*), cadete:cadetes(*)')
      .eq('id', nuevoPedido.id)
      .single();

    return NextResponse.json({
      success: true,
      pedido: pedidoCompleto,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/pedidos
 * Actualiza estado, medio de pago, estado de pago, cadete asignado, avisos por WhatsApp,
 * y gestiona Ventas Automáticas (creación al pasar a 'entregado' y anulación si se cancela).
 */
export async function PATCH(req: NextRequest) {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile, negocio } = auth;

  try {
    const body = await req.json();
    const {
      pedido_id,
      nuevo_estado,
      medio_pago,
      estado_pago,
      monto_a_cobrar,
      cadete_id,
      marcar_aviso,
      motivo_cancelacion,
    } = body;

    if (!pedido_id) {
      return NextResponse.json({ error: 'ID de pedido requerido' }, { status: 400 });
    }

    // Obtener estado actual del pedido
    const { data: pedidoActual, error: fetchError } = await adminSupabase
      .from('pedidos')
      .select('*, items:pedido_items(*)')
      .eq('id', pedido_id)
      .eq('negocio_id', profile.negocio_id)
      .single();

    if (fetchError || !pedidoActual) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updated_at: nowIso,
    };

    // 1. Cambio de estado si se solicitó
    if (nuevo_estado) {
      const estadosValidos = ['nuevo', 'en_preparacion', 'listo', 'en_camino', 'entregado', 'cancelado'];
      if (!estadosValidos.includes(nuevo_estado)) {
        return NextResponse.json({ error: 'Estado de pedido inválido' }, { status: 400 });
      }
      updatePayload.estado = nuevo_estado;

      if (nuevo_estado === 'en_preparacion') {
        if (!pedidoActual.aceptado_at) {
          updatePayload.aceptado_at = nowIso;
        }
        // Programar aviso a cadetería si es envío
        if (pedidoActual.tipo_entrega === 'envio') {
          if (negocio.momento_aviso_cadeteria === 'al_aceptar') {
            updatePayload.aviso_programado_at = nowIso;
          } else if (negocio.momento_aviso_cadeteria === 'minutos_antes') {
            const prepMin = Number(negocio.tiempo_preparacion_min) || 30;
            const antesMin = Number(negocio.minutos_antes_aviso) || 10;
            const delayMs = Math.max(0, prepMin - antesMin) * 60 * 1000;
            updatePayload.aviso_programado_at = new Date(Date.now() + delayMs).toISOString();
          }
        }
      } else if (nuevo_estado === 'listo') {
        if (pedidoActual.tipo_entrega === 'envio' && negocio.momento_aviso_cadeteria === 'listo') {
          updatePayload.aviso_programado_at = nowIso;
        }
      } else if (nuevo_estado === 'en_camino' && !pedidoActual.retirado_at) {
        updatePayload.retirado_at = nowIso;
      } else if (nuevo_estado === 'entregado') {
        if (!pedidoActual.entregado_at) {
          updatePayload.entregado_at = nowIso;
        }
        updatePayload.estado_pago = 'pagado';
        updatePayload.cerrado_por_usuario_id = profile.id;
      } else if (nuevo_estado === 'cancelado') {
        if (motivo_cancelacion !== undefined) {
          updatePayload.motivo_cancelacion = motivo_cancelacion || 'Pedido cancelado';
        }
      }
    }

    // 2. Medio de pago / Estado de pago / Monto a cobrar
    if (medio_pago !== undefined) {
      updatePayload.medio_pago = medio_pago;
    }
    if (estado_pago !== undefined) {
      updatePayload.estado_pago = estado_pago;
    }
    if (monto_a_cobrar !== undefined) {
      updatePayload.monto_a_cobrar = monto_a_cobrar === null ? null : Number(monto_a_cobrar);
    }

    // 3. Asignación de cadete
    if (cadete_id !== undefined) {
      updatePayload.cadete_id = cadete_id || null;
      if (cadete_id && cadete_id !== pedidoActual.cadete_id) {
        updatePayload.asignado_at = nowIso;
      }
    }

    // 4. Registro de avisos por WhatsApp
    if (marcar_aviso === 'cliente_listo') {
      updatePayload.cliente_avisado_listo_at = nowIso;
    } else if (marcar_aviso === 'cliente_camino') {
      updatePayload.cliente_avisado_camino_at = nowIso;
    } else if (marcar_aviso === 'cadeteria') {
      updatePayload.cadeteria_avisada_at = nowIso;
    }

    // Actualizar el pedido
    const { data: updated, error: updateError } = await adminSupabase
      .from('pedidos')
      .update(updatePayload)
      .eq('id', pedido_id)
      .eq('negocio_id', profile.negocio_id)
      .select('*, items:pedido_items(*), cadete:cadetes(*)')
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message || 'Error al actualizar pedido');
    }

    // 5. SECCIÓN D: Ventas Automáticas
    // Si el pedido pasó a 'entregado', generar o reactivar la venta automática
    if (nuevo_estado === 'entregado') {
      const prodIds = (updated.items || [])
        .map((it: { producto_id?: string | null }) => it.producto_id)
        .filter(Boolean) as string[];

      let mapaCostos: Record<string, number> = {};
      if (prodIds.length > 0) {
        const { data: prods } = await adminSupabase
          .from('productos')
          .select('id, costo_total')
          .in('id', prodIds);
        if (prods) {
          mapaCostos = Object.fromEntries(
            prods.map((p: { id: string; costo_total: number | null }) => [p.id, Number(p.costo_total) || 0])
          );
        }
      }

      const costoEstimado = (updated.items || []).reduce(
        (acc: number, it: { producto_id?: string | null; cantidad: number }) => {
          const costoUnit = it.producto_id ? mapaCostos[it.producto_id] || 0 : 0;
          return acc + costoUnit * (Number(it.cantidad) || 1);
        },
        0
      );

      // Calcular tiempo de entrega en minutos si fue envío y tuvo asignado_at o retirado_at
      let tiempoEntregaMin: number | null = null;
      const inicioRef = updated.retirado_at || updated.asignado_at || updated.created_at;
      if (updated.tipo_entrega === 'envio' && inicioRef) {
        const diffMs = new Date(nowIso).getTime() - new Date(inicioRef).getTime();
        tiempoEntregaMin = Math.max(1, Math.round(diffMs / 60000));
      }

      await adminSupabase.from('ventas').upsert(
        {
          negocio_id: profile.negocio_id,
          pedido_id: updated.id,
          fecha_venta: nowIso,
          total: updated.total,
          costo_estimado: costoEstimado,
          tiene_costos_cargados: costoEstimado > 0,
          medio_pago: updated.medio_pago,
          origen: updated.origen || 'online',
          tipo_entrega: updated.tipo_entrega,
          cadete_id: updated.cadete_id,
          tiempo_entrega_min: tiempoEntregaMin,
          cerrado_por_usuario_id: profile.id,
          anulada: false,
          motivo_anulacion: null,
          anulada_por_usuario_id: null,
          anulada_at: null,
        },
        { onConflict: 'pedido_id' }
      );
    }

    // Si se actualizó el medio_pago o cadete_id de un pedido que ya estaba entregado, sincronizar la venta
    if (!nuevo_estado && updated.estado === 'entregado' && (medio_pago !== undefined || cadete_id !== undefined)) {
      await adminSupabase
        .from('ventas')
        .update({
          medio_pago: updated.medio_pago,
          cadete_id: updated.cadete_id,
          updated_at: nowIso,
        })
        .eq('pedido_id', updated.id)
        .eq('negocio_id', profile.negocio_id);
    }

    // Si el pedido se cancela (incluso si ya estaba entregado), anular su venta asociada con registro de usuario y motivo
    if (nuevo_estado === 'cancelado') {
      await adminSupabase
        .from('ventas')
        .update({
          anulada: true,
          motivo_anulacion: motivo_cancelacion || 'Pedido cancelado luego de entrega',
          anulada_por_usuario_id: profile.id,
          anulada_at: nowIso,
          updated_at: nowIso,
        })
        .eq('pedido_id', updated.id)
        .eq('negocio_id', profile.negocio_id);
    }

    return NextResponse.json({ success: true, pedido: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
