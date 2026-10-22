import { NextRequest, NextResponse } from 'next/server';
import { verifyCadeteUser } from '@/lib/auth-business';

export async function GET() {
  const auth = await verifyCadeteUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile, negocio, cadete } = auth;

  // Límite de 30 días hacia atrás para historial del cadete (Sección H.5)
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pedidosRaw, error } = await adminSupabase
    .from('pedidos')
    .select(
      'id, numero_pedido, estado, cliente_nombre, cliente_telefono, tipo_entrega, direccion, referencias_direccion, observaciones, total, medio_pago, estado_pago, monto_a_cobrar, monto_cobrado_declarado, asignado_at, retirado_at, entregado_at, entrega_lat, entrega_lng, entrega_precision_m, entregado_sin_ubicacion, motivo_sin_ubicacion, no_entregado_motivo, no_entregado_observacion, created_at, items:pedido_items(id, nombre_producto, cantidad, aclaraciones)'
    )
    .eq('negocio_id', profile.negocio_id)
    .eq('cadete_id', cadete.id)
    .gte('created_at', hace30Dias)
    .in('estado', ['nuevo', 'en_preparacion', 'listo', 'en_camino', 'entregado'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // SECCIÓN H.5: Ocultar teléfono y dirección exacta del cliente en pedidos ya entregados y excluir pedidos de prueba
  const pedidosSanitizados = (pedidosRaw || [])
    .filter((p) => !(p as { es_prueba?: boolean }).es_prueba)
    .map((p) => {
    if (p.estado === 'entregado') {
      return {
        ...p,
        cliente_telefono: '',
        direccion: 'Entrega finalizada (domicilio protegido)',
        referencias_direccion: null,
      };
    }
    return p;
  });

  return NextResponse.json({
    pedidos: pedidosSanitizados,
    cadete,
    usuario: {
      id: profile.id,
      nombre: profile.nombre,
      email: profile.email,
      acepto_privacidad_gps: Boolean(profile.acepto_privacidad_gps),
    },
    negocio: {
      id: negocio.id,
      nombre: negocio.nombre,
      direccion_local: negocio.direccion_local,
      telefono: negocio.telefono,
      whatsapp_numero: negocio.whatsapp_numero,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyCadeteUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile, cadete } = auth;

  try {
    const body = await req.json();
    const { accion } = body;
    const nowIso = new Date().toISOString();

    // 1. Consentimiento de privacidad GPS en el primer ingreso (Sección H.5)
    if (accion === 'aceptar_privacidad_gps') {
      await adminSupabase
        .from('usuarios')
        .update({
          acepto_privacidad_gps: true,
          acepto_privacidad_at: nowIso,
        })
        .eq('id', profile.id);

      return NextResponse.json({ success: true });
    }

    const { pedido_id } = body;
    if (!pedido_id) {
      return NextResponse.json({ error: 'ID de pedido requerido' }, { status: 400 });
    }

    // Verificar que el pedido pertenezca al negocio y esté asignado a este cadete
    const { data: pedidoActual, error: pedErr } = await adminSupabase
      .from('pedidos')
      .select('*, items:pedido_items(*)')
      .eq('id', pedido_id)
      .eq('negocio_id', profile.negocio_id)
      .eq('cadete_id', cadete.id)
      .single();

    if (pedErr || !pedidoActual) {
      return NextResponse.json(
        { error: 'Pedido no encontrado o no asignado a tu cuenta.' },
        { status: 404 }
      );
    }

    // 2. Acción: "Retiré el pedido" -> pasa a 'en_camino'
    if (accion === 'retirar') {
      const { error: updErr } = await adminSupabase
        .from('pedidos')
        .update({
          estado: 'en_camino',
          retirado_at: nowIso,
          no_entregado_motivo: null,
          no_entregado_observacion: null,
          updated_at: nowIso,
        })
        .eq('id', pedidoActual.id);

      if (updErr) throw new Error(updErr.message);
      return NextResponse.json({ success: true });
    }

    // 3. Acción: "Entregado" -> captura GPS puntual, confirma efectivo cobrado y genera Venta Automática
    if (accion === 'entregar') {
      const {
        lat,
        lng,
        precision_m,
        entregado_sin_ubicacion,
        motivo_sin_ubicacion,
        monto_cobrado_declarado,
      } = body;

      const tieneCoordenadas =
        typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng);

      const updateData: Record<string, unknown> = {
        estado: 'entregado',
        entregado_at: nowIso,
        estado_pago: 'pagado',
        cerrado_por_usuario_id: profile.id,
        entrega_lat: tieneCoordenadas ? lat : null,
        entrega_lng: tieneCoordenadas ? lng : null,
        entrega_precision_m: tieneCoordenadas && precision_m ? Number(precision_m) : null,
        entregado_sin_ubicacion: !tieneCoordenadas || Boolean(entregado_sin_ubicacion),
        motivo_sin_ubicacion: !tieneCoordenadas
          ? motivo_sin_ubicacion || 'permiso_denegado_o_sin_senal'
          : null,
        updated_at: nowIso,
      };

      if (monto_cobrado_declarado !== undefined && monto_cobrado_declarado !== null) {
        updateData.monto_cobrado_declarado = Number(monto_cobrado_declarado);
      } else if (pedidoActual.medio_pago === 'efectivo') {
        updateData.monto_cobrado_declarado =
          pedidoActual.monto_a_cobrar ?? pedidoActual.total;
      }

      const { error: updErr } = await adminSupabase
        .from('pedidos')
        .update(updateData)
        .eq('id', pedidoActual.id);

      if (updErr) throw new Error(updErr.message);

      // Generar la Venta Automática (Sección D)
      const prodIds = (pedidoActual.items || [])
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
            prods.map((p: { id: string; costo_total: number | null }) => [
              p.id,
              Number(p.costo_total) || 0,
            ])
          );
        }
      }

      const costoEstimado = (pedidoActual.items || []).reduce(
        (acc: number, it: { producto_id?: string | null; cantidad: number }) => {
          const costoUnit = it.producto_id ? mapaCostos[it.producto_id] || 0 : 0;
          return acc + costoUnit * (Number(it.cantidad) || 1);
        },
        0
      );

      let tiempoEntregaMin: number | null = null;
      const inicioRef =
        pedidoActual.retirado_at || pedidoActual.asignado_at || pedidoActual.created_at;
      if (inicioRef) {
        const diffMs = new Date(nowIso).getTime() - new Date(inicioRef).getTime();
        tiempoEntregaMin = Math.max(1, Math.round(diffMs / 60000));
      }

      await adminSupabase.from('ventas').upsert(
        {
          negocio_id: profile.negocio_id,
          pedido_id: pedidoActual.id,
          fecha_venta: nowIso,
          total: pedidoActual.total,
          costo_estimado: costoEstimado,
          tiene_costos_cargados: costoEstimado > 0,
          medio_pago: pedidoActual.medio_pago,
          origen: pedidoActual.origen || 'online',
          tipo_entrega: pedidoActual.tipo_entrega,
          cadete_id: cadete.id,
          tiempo_entrega_min: tiempoEntregaMin,
          cerrado_por_usuario_id: profile.id,
          anulada: false,
        },
        { onConflict: 'pedido_id' }
      );

      return NextResponse.json({ success: true });
    }

    // 4. Acción: "No se pudo entregar" -> vuelve a 'listo' y alerta al negocio
    if (accion === 'no_entregado') {
      const { motivo, observacion } = body;
      if (!motivo || !motivo.trim()) {
        return NextResponse.json(
          { error: 'Seleccioná el motivo por el cual no se pudo realizar la entrega.' },
          { status: 400 }
        );
      }

      const { error: updErr } = await adminSupabase
        .from('pedidos')
        .update({
          estado: 'listo',
          no_entregado_motivo: motivo.trim(),
          no_entregado_observacion: observacion?.trim() || null,
          no_entregado_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', pedidoActual.id);

      if (updErr) throw new Error(updErr.message);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
