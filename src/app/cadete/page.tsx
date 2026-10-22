'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bike,
  Phone,
  MessageSquare,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Banknote,
  Clock,
  WifiOff,
} from 'lucide-react';
import { Pedido, Cadete } from '@/types/database';
import {
  formatCurrency,
  formatDate,
  generarLinkGoogleMaps,
  generarLinkWaze,
  limpiarNumeroWhatsApp,
} from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';

interface OfflineDeliveryItem {
  pedido_id: string;
  lat: number | null;
  lng: number | null;
  precision_m: number | null;
  entregado_sin_ubicacion: boolean;
  motivo_sin_ubicacion: string | null;
  monto_cobrado_declarado: number | null;
  timestamp: string;
}

const OFFLINE_QUEUE_KEY = 'rolfo_cadete_offline_deliveries_v2';

export default function CadeteAppPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cadete, setCadete] = useState<Cadete | null>(null);
  const [negocioNombre, setNegocioNombre] = useState('');
  const [direccionLocal, setDireccionLocal] = useState('');
  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pendientes' | 'en_camino' | 'entregados'>('pendientes');

  // Cola offline por baja señal
  const [offlineQueue, setOfflineQueue] = useState<OfflineDeliveryItem[]>([]);
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Modal de Confirmación de Entrega + Captura GPS puntual
  const [entregaModal, setEntregaModal] = useState<{
    open: boolean;
    pedido: Pedido | null;
    montoCobrado: string;
    capturandoGps: boolean;
    estadoGpsTexto: string;
  }>({
    open: false,
    pedido: null,
    montoCobrado: '',
    capturandoGps: false,
    estadoGpsTexto: '',
  });

  // Modal de "No se pudo entregar"
  const [noEntregadoModal, setNoEntregadoModal] = useState<{
    open: boolean;
    pedido: Pedido | null;
    motivo: string;
    observacion: string;
    submitting: boolean;
  }>({
    open: false,
    pedido: null,
    motivo: 'No atendió',
    observacion: '',
    submitting: false,
  });

  const cargarColaOffline = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        setOfflineQueue(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchPedidosCadete = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cadete/pedidos');
      if (res.ok) {
        const data = await res.json();
        setPedidos(data.pedidos || []);
        setCadete(data.cadete || null);
        setNegocioNombre(data.negocio?.nombre || 'Pedidos by ROLΦ');
        setDireccionLocal(data.negocio?.direccion_local || '');
        if (data.usuario) {
          setAceptoPrivacidad(Boolean(data.usuario.acepto_privacidad_gps));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sincronizarColaOffline = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    let items: OfflineDeliveryItem[] = [];
    try {
      items = JSON.parse(raw);
    } catch {
      return;
    }
    if (items.length === 0) return;

    setSyncingOffline(true);
    const restantes: OfflineDeliveryItem[] = [];

    for (const item of items) {
      try {
        const res = await fetch('/api/cadete/pedidos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'entregar',
            ...item,
          }),
        });
        if (!res.ok) {
          restantes.push(item);
        }
      } catch {
        restantes.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(restantes));
    setOfflineQueue(restantes);
    setSyncingOffline(false);
    fetchPedidosCadete();
  }, [fetchPedidosCadete]);

  useEffect(() => {
    cargarColaOffline();
    fetchPedidosCadete();
    const interval = setInterval(fetchPedidosCadete, 20000);
    window.addEventListener('online', sincronizarColaOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', sincronizarColaOffline);
    };
  }, [cargarColaOffline, fetchPedidosCadete, sincronizarColaOffline]);

  const aceptarAvisoPrivacidadGps = async () => {
    setAceptoPrivacidad(true);
    await fetch('/api/cadete/pedidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'aceptar_privacidad_gps' }),
    });
  };

  const marcarRetirado = async (pedidoId: string) => {
    const res = await fetch('/api/cadete/pedidos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'retirar', pedido_id: pedidoId }),
    });
    if (res.ok) {
      setTab('en_camino');
      fetchPedidosCadete();
    }
  };

  const abrirModalEntregar = (pedido: Pedido) => {
    const montoSugerido =
      pedido.medio_pago === 'efectivo'
        ? String(pedido.monto_a_cobrar ?? pedido.total)
        : '0';
    setEntregaModal({
      open: true,
      pedido,
      montoCobrado: montoSugerido,
      capturandoGps: false,
      estadoGpsTexto: '',
    });
  };

  const confirmarEntregaConGps = async () => {
    const pedido = entregaModal.pedido;
    if (!pedido) return;

    setEntregaModal((prev) => ({
      ...prev,
      capturandoGps: true,
      estadoGpsTexto: 'Obteniendo ubicación puntual de entrega...',
    }));

    // Captura puntual de geolocalización SOLO al pulsar confirmar entrega (Secciones H.4 y H.5)
    const obtenerPosicionPuntual = (): Promise<{
      lat: number | null;
      lng: number | null;
      precision_m: number | null;
      entregado_sin_ubicacion: boolean;
      motivo_sin_ubicacion: string | null;
    }> => {
      return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          resolve({
            lat: null,
            lng: null,
            precision_m: null,
            entregado_sin_ubicacion: true,
            motivo_sin_ubicacion: 'navegador_sin_soporte_gps',
          });
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              precision_m: pos.coords.accuracy,
              entregado_sin_ubicacion: false,
              motivo_sin_ubicacion: null,
            });
          },
          (err) => {
            let motivo = 'sin_senal';
            if (err.code === 1) motivo = 'permiso_denegado';
            else if (err.code === 3) motivo = 'timeout_baja_senal';
            resolve({
              lat: null,
              lng: null,
              precision_m: null,
              entregado_sin_ubicacion: true,
              motivo_sin_ubicacion: motivo,
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 9000,
            maximumAge: 0,
          }
        );
      });
    };

    const coords = await obtenerPosicionPuntual();
    const montoDeclarado =
      pedido.medio_pago === 'efectivo'
        ? Number(entregaModal.montoCobrado) || 0
        : 0;

    const payload: OfflineDeliveryItem = {
      pedido_id: pedido.id,
      lat: coords.lat,
      lng: coords.lng,
      precision_m: coords.precision_m,
      entregado_sin_ubicacion: coords.entregado_sin_ubicacion,
      motivo_sin_ubicacion: coords.motivo_sin_ubicacion,
      monto_cobrado_declarado: montoDeclarado,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/cadete/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'entregar',
          ...payload,
        }),
      });

      if (!res.ok) throw new Error('Error de red');

      setEntregaModal({
        open: false,
        pedido: null,
        montoCobrado: '',
        capturandoGps: false,
        estadoGpsTexto: '',
      });
      fetchPedidosCadete();
    } catch {
      // Guardar en cola local para reintentar automáticamente al recuperar señal
      const nuevaCola = [...offlineQueue, payload];
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(nuevaCola));
      setOfflineQueue(nuevaCola);
      setEntregaModal({
        open: false,
        pedido: null,
        montoCobrado: '',
        capturandoGps: false,
        estadoGpsTexto: '',
      });
    }
  };

  const confirmarNoEntregado = async () => {
    if (!noEntregadoModal.pedido) return;
    setNoEntregadoModal((p) => ({ ...p, submitting: true }));
    try {
      const res = await fetch('/api/cadete/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'no_entregado',
          pedido_id: noEntregadoModal.pedido.id,
          motivo: noEntregadoModal.motivo,
          observacion: noEntregadoModal.observacion,
        }),
      });
      if (res.ok) {
        setNoEntregadoModal({
          open: false,
          pedido: null,
          motivo: 'No atendió',
          observacion: '',
          submitting: false,
        });
        fetchPedidosCadete();
      }
    } finally {
      setNoEntregadoModal((p) => ({ ...p, submitting: false }));
    }
  };

  const cerrarSesion = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const pendientes = pedidos.filter((p) =>
    ['nuevo', 'en_preparacion', 'listo'].includes(p.estado)
  );
  const enCamino = pedidos.filter((p) => p.estado === 'en_camino');
  const entregados = pedidos.filter((p) => p.estado === 'entregado');

  const listaActiva =
    tab === 'pendientes'
      ? pendientes
      : tab === 'en_camino'
      ? enCamino
      : entregados;

  // Efectivo total rendido/cobrado hoy por el cadete
  const hoyStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const efectivoCobradoHoy = entregados
    .filter((p) => {
      if (!p.entregado_at) return false;
      const fechaEntrega = new Date(p.entregado_at).toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      });
      return fechaEntrega === hoyStr;
    })
    .reduce((acc, p) => acc + (Number(p.monto_cobrado_declarado) || 0), 0);

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col pb-12">
      {/* Barra Superior de Alto Contraste */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-zinc-950 flex items-center justify-center font-black shadow-md">
            <Bike className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-white leading-tight">
              {cadete?.nombre || 'App del Cadete'}
            </div>
            <div className="text-[11px] text-amber-400 font-medium">
              {negocioNombre}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPedidosCadete}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 active:scale-95 cursor-pointer"
            aria-label="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={cerrarSesion}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-rose-400 active:scale-95 cursor-pointer"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Resumen Rápido de Efectivo a Rendir Hoy */}
      <div className="px-4 pt-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Banknote className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-[11px] text-zinc-400 block">
                Efectivo cobrado hoy (a rendir en caja)
              </span>
              <span className="text-base font-extrabold text-white font-mono">
                {formatCurrency(efectivoCobradoHoy)}
              </span>
            </div>
          </div>
          {direccionLocal && (
            <div className="text-right text-[11px] text-zinc-400 max-w-[160px] truncate">
              Retiro: {direccionLocal}
            </div>
          )}
        </div>
      </div>

      {/* Aviso de Cola Offline si hubo entregas sin señal */}
      {offlineQueue.length > 0 && (
        <div className="px-4 pt-3">
          <div className="bg-amber-950/70 border border-amber-600 rounded-2xl p-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-200">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {offlineQueue.length} entrega(s) guardada(s) sin señal listas para sincronizar.
              </span>
            </div>
            <button
              type="button"
              onClick={sincronizarColaOffline}
              disabled={syncingOffline}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold shrink-0 cursor-pointer"
            >
              {syncingOffline ? 'Enviando...' : 'Sincronizar'}
            </button>
          </div>
        </div>
      )}

      {/* Pestañas grandes para uso con una sola mano */}
      <div className="px-4 pt-4 sticky top-[69px] z-20 bg-[#09090b]/95 pb-2">
        <div className="grid grid-cols-3 gap-1.5 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setTab('pendientes')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'pendientes'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-400'
            }`}
          >
            Pendientes ({pendientes.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('en_camino')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'en_camino'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-400'
            }`}
          >
            En Camino ({enCamino.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('entregados')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'entregados'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-400'
            }`}
          >
            Entregados ({entregados.length})
          </button>
        </div>
      </div>

      {/* Lista de Pedidos del Cadete */}
      <main className="px-4 pt-2 space-y-4 flex-1">
        {listaActiva.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-10 text-center space-y-2 mt-4">
            <Bike className="w-10 h-10 text-zinc-600 mx-auto" />
            <div className="text-sm font-bold text-zinc-300">
              No tenés pedidos en esta pestaña
            </div>
            <p className="text-xs text-zinc-500">
              Los envíos que el negocio te asigne aparecerán acá automáticamente.
            </p>
          </div>
        ) : (
          listaActiva.map((pedido) => {
            const cobrarEfectivo =
              pedido.medio_pago === 'efectivo' && pedido.estado_pago !== 'pagado';
            const montoCobrar = pedido.monto_a_cobrar ?? pedido.total;

            return (
              <div
                key={pedido.id}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl"
              >
                {/* Encabezado de tarjeta */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-black text-white">
                      #{pedido.numero_pedido}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        pedido.estado === 'listo'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : pedido.estado === 'en_camino'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                          : pedido.estado === 'entregado'
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}
                    >
                      {pedido.estado === 'listo'
                        ? 'Listo para retirar'
                        : pedido.estado === 'en_camino'
                        ? 'En reparto'
                        : pedido.estado === 'entregado'
                        ? 'Entregado'
                        : 'En cocina'}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(pedido.created_at)}
                  </span>
                </div>

                {/* Bloque Destacado de Cobro */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    cobrarEfectivo
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  }`}
                >
                  <div>
                    <span className="text-[11px] uppercase font-bold block opacity-80">
                      {cobrarEfectivo
                        ? 'COBRAR EN EFECTIVO AL CLIENTE'
                        : `PAGO (${(pedido.medio_pago || 'confirmado').toUpperCase()})`}
                    </span>
                    <span className="text-lg font-black font-mono">
                      {cobrarEfectivo
                        ? formatCurrency(montoCobrar)
                        : 'No cobrar efectivo ($0)'}
                    </span>
                  </div>
                  <Banknote className="w-6 h-6 opacity-80" />
                </div>

                {/* Datos de Destino (Solo visibles mientras no esté finalizado - Sección H.5) */}
                <div className="space-y-2 text-sm">
                  <div className="font-bold text-white text-base">
                    Cliente: {pedido.cliente_nombre}
                  </div>

                  {pedido.estado !== 'entregado' && pedido.direccion && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 space-y-1">
                      <div className="text-xs text-amber-400 font-bold uppercase flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        Dirección de entrega
                      </div>
                      <div className="text-white font-semibold text-base">
                        {pedido.direccion}
                      </div>
                      {pedido.referencias_direccion && (
                        <div className="text-xs text-zinc-400">
                          Ref: {pedido.referencias_direccion}
                        </div>
                      )}
                    </div>
                  )}

                  {pedido.observaciones && (
                    <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-200">
                      <strong>Nota:</strong> {pedido.observaciones}
                    </div>
                  )}
                </div>

                {/* Resumen de bolsas/productos (sin precios ni costos) */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase">
                    Contenido del pedido:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {pedido.items?.map((it) => (
                      <span
                        key={it.id}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-200"
                      >
                        {it.cantidad}x {it.nombre_producto}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Botones de Navegación y Contacto (Solo activos antes de entregar) */}
                {pedido.estado !== 'entregado' && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {pedido.cliente_telefono && (
                      <>
                        <a
                          href={`tel:${limpiarNumeroWhatsApp(pedido.cliente_telefono)}`}
                          className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold"
                        >
                          <Phone className="w-4 h-4 text-emerald-400" />
                          <span>Llamar</span>
                        </a>
                        <a
                          href={`https://wa.me/${limpiarNumeroWhatsApp(pedido.cliente_telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>WhatsApp</span>
                        </a>
                      </>
                    )}

                    {pedido.direccion && (
                      <>
                        <a
                          href={generarLinkGoogleMaps(pedido.direccion)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 border border-zinc-700 text-amber-400 text-xs font-bold"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Google Maps</span>
                        </a>
                        <a
                          href={generarLinkWaze(pedido.direccion)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 border border-zinc-700 text-sky-400 text-xs font-bold"
                        >
                          <Navigation className="w-4 h-4" />
                          <span>Abrir Waze</span>
                        </a>
                      </>
                    )}
                  </div>
                )}

                {/* Botones Principales de Acción Operativa */}
                {pedido.estado !== 'entregado' && (
                  <div className="pt-2 space-y-2 border-t border-zinc-800">
                    {pedido.estado !== 'en_camino' ? (
                      <button
                        type="button"
                        onClick={() => marcarRetirado(pedido.id)}
                        className="w-full min-h-[54px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      >
                        <PackageCheck className="w-5 h-5" />
                        <span>RETIRÉ EL PEDIDO (SALIR EN CAMINO)</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => abrirModalEntregar(pedido)}
                          className="w-full min-h-[56px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                        >
                          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                          <span>MARCAR ENTREGADO</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setNoEntregadoModal({
                              open: true,
                              pedido,
                              motivo: 'No atendió',
                              observacion: '',
                              submitting: false,
                            })
                          }
                          className="w-full min-h-[46px] rounded-2xl bg-rose-950/60 border border-rose-800/70 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>No se pudo entregar</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* MODAL 1: Aviso de Privacidad GPS en el primer ingreso (Sección H.5) */}
      <Modal
        open={!aceptoPrivacidad}
        onClose={aceptarAvisoPrivacidadGps}
        title="Privacidad y Uso de Ubicación GPS"
      >
        <div className="space-y-4 text-xs text-zinc-300">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200">
            <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <strong>Sin rastreo en segundo plano:</strong> Tu ubicación GPS{' '}
              <strong>solo se captura en el instante puntual</strong> en que tocás el botón{' '}
              <em>&quot;Marcar Entregado&quot;</em> como comprobante de entrega.
            </div>
          </div>
          <p className="text-zinc-400 leading-relaxed">
            La aplicación nunca sigue tu recorrido en vivo ni accede a tu ubicación fuera del momento de confirmar cada entrega.
          </p>
          <button
            type="button"
            onClick={aceptarAvisoPrivacidadGps}
            className="w-full min-h-[48px] rounded-2xl bg-amber-500 text-zinc-950 font-black text-sm cursor-pointer"
          >
            Entendido, comenzar a repartir
          </button>
        </div>
      </Modal>

      {/* MODAL 2: Confirmar Entrega + Efectivo Cobrado + Captura GPS */}
      <Modal
        open={entregaModal.open}
        onClose={() =>
          !entregaModal.capturandoGps &&
          setEntregaModal((p) => ({ ...p, open: false }))
        }
        title={`Confirmar Entrega — #${entregaModal.pedido?.numero_pedido || ''}`}
      >
        <div className="space-y-4">
          {entregaModal.pedido?.medio_pago === 'efectivo' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-400 block">
                Confirmar monto cobrado en efectivo ($)
              </label>
              <input
                type="number"
                value={entregaModal.montoCobrado}
                onChange={(e) =>
                  setEntregaModal((p) => ({ ...p, montoCobrado: e.target.value }))
                }
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-lg font-mono font-bold text-white"
              />
            </div>
          )}

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Al confirmar, se registrará la hora exacta y la coordenada puntual de entrega.
            </span>
          </div>

          {entregaModal.estadoGpsTexto && (
            <div className="text-xs text-amber-400 font-semibold text-center animate-pulse">
              {entregaModal.estadoGpsTexto}
            </div>
          )}

          <button
            type="button"
            disabled={entregaModal.capturandoGps}
            onClick={confirmarEntregaConGps}
            className="w-full min-h-[54px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-base cursor-pointer disabled:opacity-50"
          >
            {entregaModal.capturandoGps
              ? 'Registrando ubicación y entrega...'
              : 'CONFIRMAR ENTREGA AHORA'}
          </button>
        </div>
      </Modal>

      {/* MODAL 3: Reportar "No se pudo entregar" */}
      <Modal
        open={noEntregadoModal.open}
        onClose={() => setNoEntregadoModal((p) => ({ ...p, open: false }))}
        title={`No se pudo entregar — #${noEntregadoModal.pedido?.numero_pedido || ''}`}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1.5">
              Motivo *
            </label>
            <select
              value={noEntregadoModal.motivo}
              onChange={(e) =>
                setNoEntregadoModal((p) => ({ ...p, motivo: e.target.value }))
              }
              className="w-full px-3.5 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-sm text-white"
            >
              <option value="No atendió">No atendió en el domicilio</option>
              <option value="Dirección incorrecta">Dirección incorrecta / inexistente</option>
              <option value="Rechazó el pedido">El cliente rechazó el pedido</option>
              <option value="Otro">Otro motivo</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Aclaración adicional para el local (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Llamé 3 veces por teléfono y tocaron timbre..."
              value={noEntregadoModal.observacion}
              onChange={(e) =>
                setNoEntregadoModal((p) => ({ ...p, observacion: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>

          <button
            type="button"
            disabled={noEntregadoModal.submitting}
            onClick={confirmarNoEntregado}
            className="w-full min-h-[50px] rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm cursor-pointer disabled:opacity-50"
          >
            {noEntregadoModal.submitting
              ? 'Informando al local...'
              : 'DEVOLVER PEDIDO A "LISTO" Y AVISAR AL LOCAL'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
