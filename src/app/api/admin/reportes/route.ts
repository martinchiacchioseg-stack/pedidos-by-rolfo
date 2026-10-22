import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET(req: NextRequest) {
  // ESTRICTO: Solo rol 'admin' puede ver reportes, costos y ganancias
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;
  const searchParams = req.nextUrl.searchParams;
  const periodo = searchParams.get('periodo') || 'semana'; // 'hoy' | 'semana' | 'mes' | 'personalizado'
  const desdeParam = searchParams.get('desde');
  const hastaParam = searchParams.get('hasta');

  // Calcular rango en zona horaria Argentina (-03:00)
  const hoyAr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  let fechaInicioIso: string;
  let fechaFinIso = `${hoyAr}T23:59:59.999-03:00`;

  if (periodo === 'hoy') {
    fechaInicioIso = `${hoyAr}T00:00:00.000-03:00`;
  } else if (periodo === 'mes') {
    const mesPrefix = hoyAr.slice(0, 7); // YYYY-MM
    fechaInicioIso = `${mesPrefix}-01T00:00:00.000-03:00`;
  } else if (periodo === 'personalizado' && desdeParam && hastaParam) {
    fechaInicioIso = `${desdeParam}T00:00:00.000-03:00`;
    fechaFinIso = `${hastaParam}T23:59:59.999-03:00`;
  } else {
    // Últimos 7 días
    const d = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const dStr = d.toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    fechaInicioIso = `${dStr}T00:00:00.000-03:00`;
  }

  // Obtener ventas del período junto con su pedido, items y cadete
  const { data: ventasRaw, error } = await adminSupabase
    .from('ventas')
    .select(
      '*, cadete:cadetes(id, nombre, tipo), pedido:pedidos(id, numero_pedido, cliente_nombre, tipo_entrega, entregado_sin_ubicacion, items:pedido_items(nombre_producto, cantidad, subtotal))'
    )
    .eq('negocio_id', profile.negocio_id)
    .gte('fecha_venta', fechaInicioIso)
    .lte('fecha_venta', fechaFinIso)
    .order('fecha_venta', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const todasLasVentas = (ventasRaw || []).filter((v: { es_prueba?: boolean }) => !v.es_prueba);
  const ventasValidas = todasLasVentas.filter((v) => !v.anulada);
  const ventasAnuladas = todasLasVentas.filter((v) => v.anulada);

  let totalVendido = 0;
  let costoTotalEstimado = 0;
  let ventasConCostosCount = 0;

  const porMedioPago = {
    efectivo: 0,
    transferencia: 0,
    mercadopago: 0,
    sin_definir: 0,
  };

  const porOrigen = {
    online: { cantidad: 0, total: 0 },
    manual: { cantidad: 0, total: 0 },
  };

  const mapaCadetes: Record<
    string,
    {
      cadete_id: string;
      nombre: string;
      tipo: string;
      entregas: number;
      sumaMinutos: number;
      entregasConTiempo: number;
      totalRecaudado: number;
    }
  > = {};

  const mapaProductos: Record<
    string,
    { nombre: string; cantidad: number; ingresos: number }
  > = {};

  const mapaSerieDiaria: Record<
    string,
    { fecha: string; total: number; pedidos: number; ganancia: number }
  > = {};

  for (const v of ventasValidas) {
    const monto = Number(v.total) || 0;
    const costo = Number(v.costo_estimado) || 0;
    totalVendido += monto;
    costoTotalEstimado += costo;
    if (v.tiene_costos_cargados || costo > 0) {
      ventasConCostosCount += 1;
    }

    // Medio de pago
    if (v.medio_pago === 'efectivo') porMedioPago.efectivo += monto;
    else if (v.medio_pago === 'transferencia') porMedioPago.transferencia += monto;
    else if (v.medio_pago === 'mercadopago') porMedioPago.mercadopago += monto;
    else porMedioPago.sin_definir += monto;

    // Origen
    const org = v.origen === 'manual' ? 'manual' : 'online';
    porOrigen[org].cantidad += 1;
    porOrigen[org].total += monto;

    // Cadetes
    if (v.cadete_id && v.cadete) {
      if (!mapaCadetes[v.cadete_id]) {
        mapaCadetes[v.cadete_id] = {
          cadete_id: v.cadete_id,
          nombre: v.cadete.nombre,
          tipo: v.cadete.tipo,
          entregas: 0,
          sumaMinutos: 0,
          entregasConTiempo: 0,
          totalRecaudado: 0,
        };
      }
      mapaCadetes[v.cadete_id].entregas += 1;
      mapaCadetes[v.cadete_id].totalRecaudado += monto;
      if (v.tiempo_entrega_min && v.tiempo_entrega_min > 0) {
        mapaCadetes[v.cadete_id].sumaMinutos += Number(v.tiempo_entrega_min);
        mapaCadetes[v.cadete_id].entregasConTiempo += 1;
      }
    }

    // Ranking de productos
    const items = v.pedido?.items || [];
    for (const it of items) {
      const key = it.nombre_producto || 'Producto';
      if (!mapaProductos[key]) {
        mapaProductos[key] = { nombre: key, cantidad: 0, ingresos: 0 };
      }
      mapaProductos[key].cantidad += Number(it.cantidad) || 1;
      mapaProductos[key].ingresos += Number(it.subtotal) || 0;
    }

    // Serie diaria en fecha Argentina
    const diaStr = new Date(v.fecha_venta).toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    if (!mapaSerieDiaria[diaStr]) {
      mapaSerieDiaria[diaStr] = { fecha: diaStr, total: 0, pedidos: 0, ganancia: 0 };
    }
    mapaSerieDiaria[diaStr].total += monto;
    mapaSerieDiaria[diaStr].pedidos += 1;
    mapaSerieDiaria[diaStr].ganancia += monto - costo;
  }

  const cantidadPedidos = ventasValidas.length;
  const ticketPromedio = cantidadPedidos > 0 ? totalVendido / cantidadPedidos : 0;
  const gananciaEstimada = totalVendido - costoTotalEstimado;

  const entregasPorCadete = Object.values(mapaCadetes)
    .map((c) => ({
      cadete_id: c.cadete_id,
      nombre: c.nombre,
      tipo: c.tipo,
      entregas: c.entregas,
      tiempo_promedio_min:
        c.entregasConTiempo > 0 ? Math.round(c.sumaMinutos / c.entregasConTiempo) : null,
      total_recaudado: c.totalRecaudado,
    }))
    .sort((a, b) => b.entregas - a.entregas);

  const rankingProductos = Object.values(mapaProductos)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  const serieDiaria = Object.values(mapaSerieDiaria).sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
  );

  return NextResponse.json({
    rango: { desde: fechaInicioIso, hasta: fechaFinIso },
    kpis: {
      total_vendido: totalVendido,
      cantidad_pedidos: cantidadPedidos,
      ticket_promedio: ticketPromedio,
      costo_estimado: costoTotalEstimado,
      ganancia_estimada: gananciaEstimada,
      ventas_con_costos: ventasConCostosCount,
      total_anuladas: ventasAnuladas.reduce((a, b) => a + (Number(b.total) || 0), 0),
      cantidad_anuladas: ventasAnuladas.length,
    },
    por_medio_pago: porMedioPago,
    por_origen: porOrigen,
    entregas_por_cadete: entregasPorCadete,
    ranking_productos: rankingProductos,
    serie_diaria: serieDiaria,
    ventas_detalle: todasLasVentas,
  });
}
