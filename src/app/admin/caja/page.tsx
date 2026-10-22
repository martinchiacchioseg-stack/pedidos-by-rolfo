'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Banknote,
  CreditCard,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Download,
  Bike,
  History,
  XCircle,
} from 'lucide-react';
import { CierreCaja, MedioPago } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';

interface EstadoCajaActual {
  total_vendido: number;
  total_efectivo_esperado: number;
  total_transferencia: number;
  total_mercadopago: number;
  efectivo_declarado_cadetes: number;
  cantidad_pedidos: number;
  cantidad_anulaciones: number;
  total_anulaciones: number;
  pedidos_sin_medio_pago: Array<{
    id: string;
    numero_pedido: number;
    cliente_nombre: string;
    total: number;
  }>;
  rendicion_por_cadete: Array<{
    nombre: string;
    entregas: number;
    efectivo_declarado: number;
  }>;
}

export default function CierreCajaPage() {
  const [fechaRef, setFechaRef] = useState<string>('');
  const [estadoActual, setEstadoActual] = useState<EstadoCajaActual | null>(null);
  const [historial, setHistorial] = useState<CierreCaja[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario de cierre
  const [efectivoContado, setEfectivoContado] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchCaja = useCallback(async (fecha?: string) => {
    try {
      setLoading(true);
      const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
      const res = await fetch(`/api/admin/caja${q}`);
      if (res.ok) {
        const data = await res.json();
        setFechaRef(data.fecha_referencia);
        setEstadoActual(data.estado_actual);
        setHistorial(data.historial || []);
        if (efectivoContado === '' && data.estado_actual) {
          setEfectivoContado(String(data.estado_actual.total_efectivo_esperado || 0));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [efectivoContado]);

  useEffect(() => {
    fetchCaja();
  }, [fetchCaja]);

  const asignarMedioPagoRapido = async (pedidoId: string, medio: MedioPago) => {
    await fetch('/api/admin/pedidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedidoId,
        medio_pago: medio,
      }),
    });
    fetchCaja(fechaRef);
  };

  const registrarCierreCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estadoActual) return;
    setErrorMsg('');
    setMensajeExito('');

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_referencia: fechaRef,
          efectivo_contado: Number(efectivoContado) || 0,
          observaciones,
          estado_calculado: estadoActual,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Error al cerrar la caja');
        return;
      }
      setMensajeExito('Cierre de caja registrado de forma inmutable.');
      setObservaciones('');
      fetchCaja(fechaRef);
    } catch {
      setErrorMsg('Error de conexión al registrar cierre');
    } finally {
      setSubmitting(false);
    }
  };

  const exportarHistorialCSV = () => {
    if (historial.length === 0) return;
    const headers = [
      'Fecha Referencia',
      'Fecha y Hora Cierre',
      'Cerrado Por',
      'Pedidos Entregados',
      'Total Vendido ($)',
      'Efectivo Esperado ($)',
      'Efectivo Contado ($)',
      'Diferencia Efectivo ($)',
      'Transferencia ($)',
      'MercadoPago ($)',
      'Efectivo Cadetes ($)',
      'Anulaciones Cant',
      'Anulaciones Monto ($)',
      'Observaciones',
    ];

    const rows = historial.map((c) =>
      [
        c.fecha_referencia,
        formatDate(c.fecha_cierre),
        `"${(c.cerrado_por_nombre || 'Admin').replace(/"/g, '""')}"`,
        c.cantidad_pedidos,
        Number(c.total_vendido).toFixed(2),
        Number(c.total_efectivo_esperado).toFixed(2),
        Number(c.efectivo_contado).toFixed(2),
        Number(c.diferencia_efectivo).toFixed(2),
        Number(c.total_transferencia).toFixed(2),
        Number(c.total_mercadopago).toFixed(2),
        Number(c.efectivo_declarado_cadetes).toFixed(2),
        c.cantidad_anulaciones,
        Number(c.total_anulaciones).toFixed(2),
        `"${(c.observaciones || '').replace(/"/g, '""')}"`,
      ].join(',')
    );

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cierres-caja-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const esperadoEfectivo = estadoActual?.total_efectivo_esperado || 0;
  const contadoNum = Number(efectivoContado) || 0;
  const diferenciaVivo = contadoNum - esperadoEfectivo;

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-amber-500" />
            Cierre de Caja Diario
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Arqueo simple de efectivo, conciliación con cadetes y registro histórico inmutable
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fechaRef}
            onChange={(e) => {
              setFechaRef(e.target.value);
              fetchCaja(e.target.value);
            }}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
          />
          <button
            type="button"
            onClick={exportarHistorialCSV}
            disabled={historial.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-amber-400 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Historial CSV</span>
          </button>
        </div>
      </div>

      {/* Advertencia de Pedidos Entregados sin Medio de Pago (Sección F) */}
      {estadoActual && estadoActual.pedidos_sin_medio_pago.length > 0 && (
        <div className="bg-amber-950/50 border border-amber-600/70 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2.5 text-amber-300 font-bold text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              Atención: Hay {estadoActual.pedidos_sin_medio_pago.length} pedido(s) entregado(s) hoy sin medio de pago registrado. Asignalo antes de cerrar la caja:
            </span>
          </div>
          <div className="space-y-2">
            {estadoActual.pedidos_sin_medio_pago.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/90 border border-amber-800/50 rounded-xl p-3 text-xs"
              >
                <div>
                  <strong className="text-white font-mono">#{p.numero_pedido}</strong> •{' '}
                  <span className="text-zinc-300">{p.cliente_nombre}</span> •{' '}
                  <span className="font-mono font-bold text-amber-400">
                    {formatCurrency(p.total)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => asignarMedioPagoRapido(p.id, 'efectivo')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 font-semibold cursor-pointer"
                  >
                    Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => asignarMedioPagoRapido(p.id, 'transferencia')}
                    className="px-2.5 py-1 rounded-lg bg-sky-950 text-sky-300 border border-sky-700 font-semibold cursor-pointer"
                  >
                    Transferencia
                  </button>
                  <button
                    type="button"
                    onClick={() => asignarMedioPagoRapido(p.id, 'mercadopago')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-700 font-semibold cursor-pointer"
                  >
                    MercadoPago
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading || !estadoActual ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center text-xs text-zinc-400">
          Calculando totales del día para el arqueo de caja...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Totales Esperados del Día y Rendición de Cadetes */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-zinc-400">
                  Total Vendido del Día ({estadoActual.cantidad_pedidos} pedidos)
                </span>
                <div className="text-2xl font-black text-white font-mono">
                  {formatCurrency(estadoActual.total_vendido)}
                </div>
              </div>

              <div className="bg-zinc-900 border border-emerald-800/60 rounded-2xl p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
                  <span>Efectivo Esperado en Caja</span>
                  <Banknote className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {formatCurrency(estadoActual.total_efectivo_esperado)}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block">Transferencias</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {formatCurrency(estadoActual.total_transferencia)}
                  </span>
                </div>
                <CreditCard className="w-5 h-5 text-sky-400" />
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block">MercadoPago</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {formatCurrency(estadoActual.total_mercadopago)}
                  </span>
                </div>
                <Wallet className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            {/* Efectivo declarado por cadetes */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bike className="w-4 h-4 text-amber-400" />
                  Efectivo Declarado por Cadetes
                </h2>
                <span className="font-mono text-sm font-bold text-amber-400">
                  Total cadetes: {formatCurrency(estadoActual.efectivo_declarado_cadetes)}
                </span>
              </div>

              {estadoActual.rendicion_por_cadete.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No hay cobros en efectivo declarados por cadetes en esta fecha.
                </p>
              ) : (
                <div className="space-y-2">
                  {estadoActual.rendicion_por_cadete.map((rc) => (
                    <div
                      key={rc.nombre}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
                    >
                      <span className="font-semibold text-zinc-200">
                        {rc.nombre} ({rc.entregas} cobros en efectivo)
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(rc.efectivo_declarado)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Anulaciones del día */}
            {estadoActual.cantidad_anulaciones > 0 && (
              <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-rose-300">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>
                    Anulaciones registradas en el día: {estadoActual.cantidad_anulaciones}
                  </span>
                </div>
                <span className="font-mono font-bold text-rose-400">
                  {formatCurrency(estadoActual.total_anulaciones)}
                </span>
              </div>
            )}
          </div>

          {/* Columna Derecha: Formulario para Cerrar Caja del Día */}
          <form
            onSubmit={registrarCierreCaja}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 h-fit"
          >
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Cerrar Caja del Día ({fechaRef})
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Una vez confirmado, el cierre queda guardado en el historial y no puede modificarse.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}
            {mensajeExito && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{mensajeExito}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 block">
                Efectivo físico contado en billetes ($) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={efectivoContado}
                onChange={(e) => setEfectivoContado(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-lg font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Diferencia en tiempo real */}
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                Math.abs(diferenciaVivo) < 1
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : diferenciaVivo > 0
                  ? 'bg-sky-950/40 border-sky-800/60 text-sky-300'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}
            >
              <span className="font-semibold">
                {Math.abs(diferenciaVivo) < 1
                  ? 'Caja exacta (sin diferencia)'
                  : diferenciaVivo > 0
                  ? 'Sobrante de efectivo'
                  : 'Faltante de efectivo'}
              </span>
              <span className="font-mono text-sm font-black">
                {diferenciaVivo > 0 ? '+' : ''}
                {formatCurrency(diferenciaVivo)}
              </span>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Observaciones del cierre (opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Ej: Turno noche, se retiraron $10.000 para cambio..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Registrando Cierre...' : 'Confirmar y Cerrar Caja'}
            </button>
          </form>
        </div>
      )}

      {/* Historial Inmutable de Cierres de Caja */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          Historial de Cierres de Caja (Inmutable)
        </h2>

        {historial.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Aún no se registraron cierres de caja en este negocio.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="py-2.5 pr-4">Fecha Ref.</th>
                  <th className="py-2.5 pr-4">Cerrado el</th>
                  <th className="py-2.5 pr-4">Responsable</th>
                  <th className="py-2.5 pr-4">Pedidos</th>
                  <th className="py-2.5 pr-4">Total Vendido</th>
                  <th className="py-2.5 pr-4">Efectivo Esp.</th>
                  <th className="py-2.5 pr-4">Efectivo Contado</th>
                  <th className="py-2.5 pr-4">Diferencia</th>
                  <th className="py-2.5">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {historial.map((c) => {
                  const dif = Number(c.diferencia_efectivo) || 0;
                  return (
                    <tr key={c.id} className="text-zinc-200">
                      <td className="py-3 pr-4 font-mono font-bold">
                        {c.fecha_referencia}
                      </td>
                      <td className="py-3 pr-4 font-mono text-zinc-400">
                        {formatDate(c.fecha_cierre)}
                      </td>
                      <td className="py-3 pr-4">{c.cerrado_por_nombre || 'Admin'}</td>
                      <td className="py-3 pr-4 font-mono">{c.cantidad_pedidos}</td>
                      <td className="py-3 pr-4 font-mono font-bold text-white">
                        {formatCurrency(c.total_vendido)}
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        {formatCurrency(c.total_efectivo_esperado)}
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold">
                        {formatCurrency(c.efectivo_contado)}
                      </td>
                      <td
                        className={`py-3 pr-4 font-mono font-bold ${
                          Math.abs(dif) < 1
                            ? 'text-emerald-400'
                            : dif > 0
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {dif > 0 ? '+' : ''}
                        {formatCurrency(dif)}
                      </td>
                      <td className="py-3 text-zinc-400 max-w-xs truncate">
                        {c.observaciones || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
