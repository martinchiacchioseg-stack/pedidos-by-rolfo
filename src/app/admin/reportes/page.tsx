'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Download,
  Bike,
  Wallet,
  Store,
  AlertCircle,
  Clock,
  Award,
  XCircle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ReporteResponse {
  rango: { desde: string; hasta: string };
  kpis: {
    total_vendido: number;
    cantidad_pedidos: number;
    ticket_promedio: number;
    costo_estimado: number;
    ganancia_estimada: number;
    ventas_con_costos: number;
    total_anuladas: number;
    cantidad_anuladas: number;
  };
  por_medio_pago: {
    efectivo: number;
    transferencia: number;
    mercadopago: number;
    sin_definir: number;
  };
  por_origen: {
    online: { cantidad: number; total: number };
    manual: { cantidad: number; total: number };
  };
  entregas_por_cadete: Array<{
    cadete_id: string;
    nombre: string;
    tipo: string;
    entregas: number;
    tiempo_promedio_min: number | null;
    total_recaudado: number;
  }>;
  ranking_productos: Array<{
    nombre: string;
    cantidad: number;
    ingresos: number;
  }>;
  serie_diaria: Array<{
    fecha: string;
    total: number;
    pedidos: number;
    ganancia: number;
  }>;
  ventas_detalle: Array<{
    id: string;
    fecha_venta: string;
    total: number;
    costo_estimado: number;
    medio_pago: string | null;
    origen: string;
    tipo_entrega: string;
    tiempo_entrega_min: number | null;
    anulada: boolean;
    motivo_anulacion: string | null;
    pedido?: {
      numero_pedido: number;
      cliente_nombre: string;
    };
    cadete?: {
      nombre: string;
    };
  }>;
}

export default function ReportesVentasPage() {
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'personalizado'>('semana');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState<ReporteResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReportes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ periodo });
      if (periodo === 'personalizado' && desde && hasta) {
        params.set('desde', desde);
        params.set('hasta', hasta);
      }
      const res = await fetch(`/api/admin/reportes?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [periodo, desde, hasta]);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  const exportarCSV = () => {
    if (!data) return;
    const headers = [
      'Fecha Venta',
      'Nro Pedido',
      'Cliente',
      'Origen',
      'Entrega',
      'Medio de Pago',
      'Cadete',
      'Tiempo Entrega (min)',
      'Total ($)',
      'Costo Receta Est. ($)',
      'Ganancia Est. ($)',
      'Estado Venta',
      'Motivo Anulacion',
    ];

    const rows = data.ventas_detalle.map((v) => {
      const total = Number(v.total) || 0;
      const costo = Number(v.costo_estimado) || 0;
      const ganancia = v.anulada ? 0 : total - costo;
      return [
        formatDate(v.fecha_venta),
        v.pedido?.numero_pedido ? `#${v.pedido.numero_pedido}` : '-',
        `"${(v.pedido?.cliente_nombre || 'Cliente').replace(/"/g, '""')}"`,
        v.origen,
        v.tipo_entrega,
        v.medio_pago || 'sin_definir',
        `"${(v.cadete?.nombre || '-').replace(/"/g, '""')}"`,
        v.tiempo_entrega_min ?? '-',
        total.toFixed(2),
        costo.toFixed(2),
        ganancia.toFixed(2),
        v.anulada ? 'ANULADA' : 'CONFIRMADA',
        `"${(v.motivo_anulacion || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-ventas-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxDiario =
    data && data.serie_diaria.length > 0
      ? Math.max(...data.serie_diaria.map((d) => d.total), 1)
      : 1;

  return (
    <div className="space-y-6">
      {/* Encabezado y Controles de Período */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            Reporte de Ventas y Rentabilidad
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Métricas automáticas de pedidos entregados, medios de pago, desempeño de cadetes y ganancia estimada por receta
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 text-xs">
            {(
              [
                { id: 'hoy', label: 'Hoy' },
                { id: 'semana', label: 'Últimos 7 días' },
                { id: 'mes', label: 'Este Mes' },
                { id: 'personalizado', label: 'Personalizado' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
                  periodo === p.id
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportarCSV}
            disabled={!data || data.ventas_detalle.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-amber-400 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Selector de rango personalizado */}
      {periodo === 'personalizado' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>
          <button
            type="button"
            onClick={fetchReportes}
            className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer"
          >
            Filtrar Rango
          </button>
        </div>
      )}

      {loading || !data ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center text-xs text-zinc-400">
          Calculando métricas de ventas y rentabilidad...
        </div>
      ) : (
        <>
          {/* Tarjetas KPI Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Total Vendido</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {formatCurrency(data.kpis.total_vendido)}
              </div>
              <div className="text-[11px] text-zinc-500">
                Ventas confirmadas (sin anuladas)
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Pedidos Entregados</span>
                <ShoppingBag className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {data.kpis.cantidad_pedidos}
              </div>
              <div className="text-[11px] text-zinc-500">
                Online: {data.por_origen.online.cantidad} • Manuales:{' '}
                {data.por_origen.manual.cantidad}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Ticket Promedio</span>
                <Receipt className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {formatCurrency(data.kpis.ticket_promedio)}
              </div>
              <div className="text-[11px] text-zinc-500">
                Promedio por orden entregada
              </div>
            </div>

            <div className="bg-zinc-900 border border-emerald-900/60 rounded-2xl p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                <span>Ganancia Estimada</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                {formatCurrency(data.kpis.ganancia_estimada)}
              </div>
              <div className="text-[11px] text-zinc-400">
                Costo receta est.: {formatCurrency(data.kpis.costo_estimado)}
              </div>
            </div>
          </div>

          {/* Aclaración sobre ganancia estimada (Sección E) */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs text-zinc-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Nota sobre Ganancia Estimada:</strong> El cálculo descuenta el costo de receta de cada producto vendido. Su exactitud depende de tener cargados y actualizados los costos unitarios de los ingredientes en la ficha de cada producto ({data.kpis.ventas_con_costos} de {data.kpis.cantidad_pedidos} ventas del período contaban con costos de receta cargados).
            </span>
          </div>

          {/* Gráfico de Barras de Evolución Diaria + Desglose por Medio de Pago y Origen */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Barras Limpio */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Evolución Diaria de Ventas y Ganancia
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Facturación diaria (ámbar) vs. ganancia estimada (esmeralda)
                  </p>
                </div>
              </div>

              {data.serie_diaria.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-zinc-500">
                  No hay ventas registradas en las fechas seleccionadas.
                </div>
              ) : (
                <div className="h-56 flex items-end gap-3 pt-6 pb-2 overflow-x-auto border-b border-zinc-800">
                  {data.serie_diaria.map((dia) => {
                    const pctTotal = Math.max(8, Math.round((dia.total / maxDiario) * 100));
                    const pctGanancia = Math.max(
                      4,
                      Math.round((Math.max(0, dia.ganancia) / maxDiario) * 100)
                    );
                    return (
                      <div
                        key={dia.fecha}
                        className="flex-1 min-w-[54px] flex flex-col items-center gap-1.5 h-full justify-end group"
                      >
                        <div className="text-[10px] font-mono text-zinc-300 font-bold">
                          {formatCurrency(dia.total)}
                        </div>
                        <div className="w-full flex items-end justify-center gap-1 h-36">
                          <div
                            style={{ height: `${pctTotal}%` }}
                            title={`Vendido: ${formatCurrency(dia.total)} (${dia.pedidos} pedidos)`}
                            className="w-4 rounded-t-lg bg-amber-500 transition-all"
                          />
                          <div
                            style={{ height: `${pctGanancia}%` }}
                            title={`Ganancia est.: ${formatCurrency(dia.ganancia)}`}
                            className="w-4 rounded-t-lg bg-emerald-500/80 transition-all"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {dia.fecha.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Desglose por Medio de Pago y Canal */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-400" />
                  Por Medio de Pago
                </h2>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Efectivo', monto: data.por_medio_pago.efectivo, color: 'bg-emerald-500' },
                    { label: 'Transferencia', monto: data.por_medio_pago.transferencia, color: 'bg-sky-500' },
                    { label: 'MercadoPago', monto: data.por_medio_pago.mercadopago, color: 'bg-indigo-500' },
                    { label: 'Sin especificar', monto: data.por_medio_pago.sin_definir, color: 'bg-zinc-600' },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                        <span className="text-zinc-300 font-medium">{m.label}</span>
                      </div>
                      <span className="font-mono font-bold text-white">
                        {formatCurrency(m.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-400" />
                  Pedidos Online vs. Manuales
                </h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400 block">Online (Catálogo)</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {formatCurrency(data.por_origen.online.total)}
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      {data.por_origen.online.cantidad} pedidos
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400 block">Manual (Mostrador)</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {formatCurrency(data.por_origen.manual.total)}
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      {data.por_origen.manual.cantidad} pedidos
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ranking de Productos + Rendimiento de Cadetes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Productos más vendidos */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Productos Más Vendidos
              </h2>
              {data.ranking_productos.length === 0 ? (
                <p className="text-xs text-zinc-500">Sin datos en este período.</p>
              ) : (
                <div className="space-y-2">
                  {data.ranking_productos.map((prod, idx) => (
                    <div
                      key={prod.nombre}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-white">{prod.nombre}</span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-zinc-400">{prod.cantidad} u.</span>
                        <span className="text-emerald-400 font-bold">
                          {formatCurrency(prod.ingresos)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desempeño y Tiempos de Entrega por Cadete */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-amber-400" />
                Entregas y Tiempo Promedio por Cadete
              </h2>
              {data.entregas_por_cadete.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No se registraron envíos con cadete asignado en este período.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.entregas_por_cadete.map((c) => (
                    <div
                      key={c.cadete_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs gap-2"
                    >
                      <div>
                        <div className="font-bold text-white">{c.nombre}</div>
                        <span className="text-[11px] text-zinc-500">
                          {c.tipo === 'externa' ? 'Cadetería Externa' : 'Cadete Propio'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200">
                          {c.entregas} envíos
                        </span>
                        <span className="px-2 py-1 rounded bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {c.tiempo_promedio_min ? `${c.tiempo_promedio_min} min` : 's/d'}
                        </span>
                        <span className="font-bold text-emerald-400">
                          {formatCurrency(c.total_recaudado)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Registro de Ventas Anuladas si las hubo */}
          {data.kpis.cantidad_anuladas > 0 && (
            <div className="bg-rose-950/20 border border-rose-900/50 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Ventas Anuladas en el Período ({data.kpis.cantidad_anuladas})
                </h2>
                <span className="text-xs font-mono font-bold text-rose-400">
                  Total anulado: {formatCurrency(data.kpis.total_anuladas)}
                </span>
              </div>
              <div className="space-y-2">
                {data.ventas_detalle
                  .filter((v) => v.anulada)
                  .map((v) => (
                    <div
                      key={v.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-zinc-950/80 border border-rose-900/40 text-xs gap-2"
                    >
                      <div>
                        <strong className="text-white font-mono">
                          Pedido #{v.pedido?.numero_pedido || '-'}
                        </strong>{' '}
                        • <span className="text-zinc-300">{v.pedido?.cliente_nombre}</span>
                        <div className="text-[11px] text-rose-300">
                          Motivo: {v.motivo_anulacion || 'Pedido cancelado'}
                        </div>
                      </div>
                      <div className="font-mono text-rose-400 font-bold">
                        {formatCurrency(v.total)} ({formatDate(v.fecha_venta)})
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
