import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET(req: NextRequest) {
  // ESTRICTO: Solo 'admin' tiene acceso a Cierres de Caja
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;
  const searchParams = req.nextUrl.searchParams;

  // Fecha de referencia en zona horaria Argentina (-03:00)
  const hoyAr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const fechaRef = searchParams.get('fecha') || hoyAr;

  const inicioDia = `${fechaRef}T00:00:00.000-03:00`;
  const finDia = `${fechaRef}T23:59:59.999-03:00`;

  const [{ data: ventasDia }, { data: pedidosEntregadosDia }, { data: historialCierres }] =
    await Promise.all([
      adminSupabase
        .from('ventas')
        .select('*, cadete:cadetes(id, nombre, tipo), pedido:pedidos(id, numero_pedido, cliente_nombre, monto_cobrado_declarado)')
        .eq('negocio_id', profile.negocio_id)
        .gte('fecha_venta', inicioDia)
        .lte('fecha_venta', finDia),
      adminSupabase
        .from('pedidos')
        .select('id, numero_pedido, cliente_nombre, total, medio_pago, monto_cobrado_declarado, cadete_id, cadete:cadetes(id, nombre)')
        .eq('negocio_id', profile.negocio_id)
        .eq('estado', 'entregado')
        .gte('created_at', inicioDia)
        .lte('created_at', finDia),
      adminSupabase
        .from('cierres_caja')
        .select('*')
        .eq('negocio_id', profile.negocio_id)
        .order('fecha_cierre', { ascending: false })
        .limit(60),
    ]);

  const listaVentas = (ventasDia || []).filter((v: { es_prueba?: boolean }) => !v.es_prueba);
  const ventasValidas = listaVentas.filter((v) => !v.anulada);
  const ventasAnuladas = listaVentas.filter((v) => v.anulada);

  let totalVendido = 0;
  let totalEfectivoEsperado = 0;
  let totalTransferencia = 0;
  let totalMercadopago = 0;

  for (const v of ventasValidas) {
    const monto = Number(v.total) || 0;
    totalVendido += monto;
    if (v.medio_pago === 'efectivo') totalEfectivoEsperado += monto;
    else if (v.medio_pago === 'transferencia') totalTransferencia += monto;
    else if (v.medio_pago === 'mercadopago') totalMercadopago += monto;
  }

  // Efectivo declarado por cadetes y pedidos entregados sin medio de pago
  let efectivoDeclaradoCadetes = 0;
  const rendicionPorCadete: Record<
    string,
    { nombre: string; entregas: number; efectivo_declarado: number }
  > = {};

  const pedidosSinMedioPago: Array<{
    id: string;
    numero_pedido: number;
    cliente_nombre: string;
    total: number;
  }> = [];

  for (const p of pedidosEntregadosDia || []) {
    if (!p.medio_pago) {
      pedidosSinMedioPago.push({
        id: p.id,
        numero_pedido: p.numero_pedido,
        cliente_nombre: p.cliente_nombre,
        total: Number(p.total) || 0,
      });
    }

    const cobradoCadete = Number(p.monto_cobrado_declarado) || 0;
    if (p.cadete_id && cobradoCadete > 0) {
      efectivoDeclaradoCadetes += cobradoCadete;
      const cadeteObj = Array.isArray(p.cadete) ? p.cadete[0] : p.cadete;
      const nombreCadete = cadeteObj?.nombre || 'Cadete';
      if (!rendicionPorCadete[p.cadete_id]) {
        rendicionPorCadete[p.cadete_id] = {
          nombre: nombreCadete,
          entregas: 0,
          efectivo_declarado: 0,
        };
      }
      rendicionPorCadete[p.cadete_id].entregas += 1;
      rendicionPorCadete[p.cadete_id].efectivo_declarado += cobradoCadete;
    }
  }

  return NextResponse.json({
    fecha_referencia: fechaRef,
    estado_actual: {
      total_vendido: totalVendido,
      total_efectivo_esperado: totalEfectivoEsperado,
      total_transferencia: totalTransferencia,
      total_mercadopago: totalMercadopago,
      efectivo_declarado_cadetes: efectivoDeclaradoCadetes,
      cantidad_pedidos: ventasValidas.length,
      cantidad_anulaciones: ventasAnuladas.length,
      total_anulaciones: ventasAnuladas.reduce((a, b) => a + (Number(b.total) || 0), 0),
      pedidos_sin_medio_pago: pedidosSinMedioPago,
      rendicion_por_cadete: Object.values(rendicionPorCadete),
    },
    historial: historialCierres || [],
  });
}

/**
 * POST /api/admin/caja
 * Registra un Cierre de Caja INMUTABLE para la fecha indicada.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const {
      fecha_referencia,
      efectivo_contado,
      observaciones,
      estado_calculado,
    } = body;

    if (efectivo_contado === undefined || efectivo_contado === null || efectivo_contado === '') {
      return NextResponse.json(
        { error: 'Debés ingresar el monto de efectivo físico contado en caja.' },
        { status: 400 }
      );
    }

    const hoyAr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    const fechaRef = fecha_referencia || hoyAr;

    const contadoNum = Number(efectivo_contado) || 0;
    const esperadoNum = Number(estado_calculado?.total_efectivo_esperado) || 0;
    const diferencia = contadoNum - esperadoNum;

    const { data: nuevoCierre, error } = await adminSupabase
      .from('cierres_caja')
      .insert({
        negocio_id: profile.negocio_id,
        cerrado_por_usuario_id: profile.id,
        cerrado_por_nombre: profile.nombre || profile.email,
        fecha_referencia: fechaRef,
        fecha_cierre: new Date().toISOString(),
        total_vendido: Number(estado_calculado?.total_vendido) || 0,
        total_efectivo_esperado: esperadoNum,
        total_transferencia: Number(estado_calculado?.total_transferencia) || 0,
        total_mercadopago: Number(estado_calculado?.total_mercadopago) || 0,
        efectivo_declarado_cadetes:
          Number(estado_calculado?.efectivo_declarado_cadetes) || 0,
        efectivo_contado: contadoNum,
        diferencia_efectivo: diferencia,
        cantidad_pedidos: Number(estado_calculado?.cantidad_pedidos) || 0,
        cantidad_anulaciones: Number(estado_calculado?.cantidad_anulaciones) || 0,
        total_anulaciones: Number(estado_calculado?.total_anulaciones) || 0,
        observaciones: observaciones?.trim() || null,
        resumen_json: estado_calculado || {},
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      cierre: nuevoCierre,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al registrar el cierre de caja';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
