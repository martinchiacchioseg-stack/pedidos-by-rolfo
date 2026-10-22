'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Package,
  Bike,
  XCircle,
  RefreshCw,
  Search,
  MessageSquare,
  AlertCircle,
  ChevronRight,
  Plus,
  Volume2,
  VolumeX,
  Send,
  MapPin,
  CreditCard,
  Banknote,
  Wallet,
  Phone,
  Store,
  Navigation,
  BellRing,
  Check,
  Trash2,
} from 'lucide-react';
import {
  Pedido,
  EstadoPedido,
  MedioPago,
  EstadoPago,
  Cadete,
  Negocio,
  Producto,
} from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  PLANTILLAS_WHATSAPP_DEFAULT,
  compilarPlantillaWhatsApp,
  abrirWhatsAppConTexto,
} from '@/lib/whatsapp';
import { Modal } from '@/components/ui/Modal';

interface ItemManualDraft {
  producto_id: string;
  nombre_producto: string;
  precio_unitario: number;
  cantidad: number;
  aclaraciones: string;
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cadetes, setCadetes] = useState<Cadete[]>([]);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroOrigen, setFiltroOrigen] = useState<string>('todos');
  const [filtroFecha, setFiltroFecha] = useState<string>('');
  const [search, setSearch] = useState('');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);

  // Alerta sonora para nuevos pedidos
  const [sonidoActivo, setSonidoActivo] = useState(true);
  const prevNuevosIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  // Modal de Pedido Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [manualForm, setManualForm] = useState({
    cliente_nombre: '',
    cliente_telefono: '',
    tipo_entrega: 'retiro' as 'retiro' | 'envio',
    direccion: '',
    referencias_direccion: '',
    observaciones: '',
    medio_pago: 'efectivo' as MedioPago,
    estado_pago: 'pendiente' as EstadoPago,
    monto_a_cobrar: '',
    cadete_id: '',
  });
  const [manualItems, setManualItems] = useState<ItemManualDraft[]>([]);

  // Modal de Previsualización y Edición de WhatsApp (Cliente y Cadetería)
  const [waModal, setWaModal] = useState<{
    open: boolean;
    titulo: string;
    destinatarioNombre: string;
    telefono: string;
    mensaje: string;
    tipoAviso: 'cliente_listo' | 'cliente_camino' | 'cadeteria';
    pedidoId: string;
    cambiarAEnCamino?: boolean;
  }>({
    open: false,
    titulo: '',
    destinatarioNombre: '',
    telefono: '',
    mensaje: '',
    tipoAviso: 'cliente_listo',
    pedidoId: '',
  });

  // Modal de Cancelación de Pedido
  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    pedido: Pedido | null;
    motivo: string;
  }>({
    open: false,
    pedido: null,
    motivo: '',
  });

  const reproducirSonidoNuevoPedido = useCallback(() => {
    if (!sonidoActivo || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.14); // A5
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);
    } catch {
      // Ignorar si el navegador bloquea autoplay sin interacción previa
    }
  }, [sonidoActivo]);

  const fetchPedidos = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroEstado !== 'todos') params.set('estado', filtroEstado);
      if (filtroOrigen !== 'todos') params.set('origen', filtroOrigen);
      if (filtroFecha) params.set('fecha', filtroFecha);

      const res = await fetch(`/api/admin/pedidos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const lista: Pedido[] = data.pedidos || [];
        setPedidos(lista);
        if (data.cadetes) setCadetes(data.cadetes);
        if (data.negocio) setNegocio(data.negocio);

        // Detectar pedidos nuevos para alerta sonora
        const actualesNuevos = new Set(
          lista.filter((p) => p.estado === 'nuevo').map((p) => p.id)
        );
        if (!firstLoadRef.current) {
          for (const id of actualesNuevos) {
            if (!prevNuevosIdsRef.current.has(id)) {
              reproducirSonidoNuevoPedido();
              break;
            }
          }
        }
        prevNuevosIdsRef.current = actualesNuevos;
        firstLoadRef.current = false;

        // Mantener sincronizado el pedido seleccionado
        setPedidoSeleccionado((prev) => {
          if (!prev) return null;
          const actualizado = lista.find((p) => p.id === prev.id);
          return actualizado || prev;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroOrigen, filtroFecha, reproducirSonidoNuevoPedido]);

  const fetchProductosParaManual = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/productos');
      if (res.ok) {
        const data = await res.json();
        setProductos(data.productos || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 20000);
    return () => clearInterval(interval);
  }, [fetchPedidos]);

  const abrirModalManual = () => {
    if (productos.length === 0) {
      fetchProductosParaManual();
    }
    const defaultCadete = cadetes.find((c) => c.es_predeterminado && c.activo);
    setManualForm({
      cliente_nombre: '',
      cliente_telefono: '',
      tipo_entrega: 'retiro',
      direccion: '',
      referencias_direccion: '',
      observaciones: '',
      medio_pago: 'efectivo',
      estado_pago: 'pendiente',
      monto_a_cobrar: '',
      cadete_id: defaultCadete ? defaultCadete.id : '',
    });
    setManualItems([]);
    setManualError('');
    setBusquedaProducto('');
    setShowManualModal(true);
  };

  const agregarProductoManual = (prod: Producto) => {
    setManualItems((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === prod.id);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], cantidad: clone[idx].cantidad + 1 };
        return clone;
      }
      return [
        ...prev,
        {
          producto_id: prod.id,
          nombre_producto: prod.nombre,
          precio_unitario: prod.precio_venta,
          cantidad: 1,
          aclaraciones: '',
        },
      ];
    });
  };

  const cambiarCantidadManual = (productoId: string, delta: number) => {
    setManualItems((prev) =>
      prev
        .map((it) =>
          it.producto_id === productoId ? { ...it, cantidad: it.cantidad + delta } : it
        )
        .filter((it) => it.cantidad > 0)
    );
  };

  const totalManual = manualItems.reduce(
    (acc, it) => acc + it.precio_unitario * it.cantidad,
    0
  );

  const guardarPedidoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');

    if (manualItems.length === 0) {
      setManualError('Seleccioná al menos un producto para el pedido.');
      return;
    }
    if (manualForm.tipo_entrega === 'envio' && !manualForm.direccion.trim()) {
      setManualError('Ingresá la dirección de entrega para el envío.');
      return;
    }

    try {
      setManualSubmitting(true);
      const res = await fetch('/api/admin/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manualForm,
          monto_a_cobrar:
            manualForm.monto_a_cobrar !== ''
              ? Number(manualForm.monto_a_cobrar)
              : manualForm.medio_pago === 'efectivo' && manualForm.estado_pago !== 'pagado'
              ? totalManual
              : 0,
          items: manualItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualError(data.error || 'No se pudo registrar el pedido manual');
        return;
      }
      setShowManualModal(false);
      await fetchPedidos();
      if (data.pedido) {
        setPedidoSeleccionado(data.pedido);
      }
    } catch {
      setManualError('Error de conexión al guardar el pedido.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const actualizarPedido = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/admin/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pedido) {
          setPedidoSeleccionado(data.pedido);
        }
        fetchPedidos();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cambiarEstado = async (pedido: Pedido, nuevoEstado: EstadoPedido) => {
    if (nuevoEstado === 'cancelado') {
      setCancelModal({
        open: true,
        pedido,
        motivo: pedido.estado === 'entregado' ? 'Error de carga / Devolución' : 'Cancelado por el cliente',
      });
      return;
    }

    await actualizarPedido({
      pedido_id: pedido.id,
      nuevo_estado: nuevoEstado,
    });

    // Si pasa a 'en_camino' y el negocio tiene configurado sugerir aviso al cliente
    if (
      nuevoEstado === 'en_camino' &&
      negocio?.avisar_cliente_en_camino !== false &&
      pedido.cliente_telefono &&
      pedido.cliente_telefono !== 'Mostrador'
    ) {
      prepararAvisoWhatsApp(pedido, 'cliente_camino');
    }
  };

  const confirmarCancelacion = async () => {
    if (!cancelModal.pedido) return;
    await actualizarPedido({
      pedido_id: cancelModal.pedido.id,
      nuevo_estado: 'cancelado',
      motivo_cancelacion: cancelModal.motivo.trim() || 'Pedido cancelado',
    });
    setCancelModal({ open: false, pedido: null, motivo: '' });
  };

  const prepararAvisoWhatsApp = (
    pedido: Pedido,
    tipoAviso: 'cliente_listo' | 'cliente_camino' | 'cadeteria',
    cambiarAEnCamino = false
  ) => {
    if (!negocio) return;
    const plantillas = {
      ...PLANTILLAS_WHATSAPP_DEFAULT,
      ...(negocio.plantillas_whatsapp || {}),
    };

    if (tipoAviso === 'cliente_listo') {
      const texto = compilarPlantillaWhatsApp(plantillas.cliente_listo, pedido, negocio);
      setWaModal({
        open: true,
        titulo: 'Avisar al cliente: Pedido Listo',
        destinatarioNombre: pedido.cliente_nombre,
        telefono: pedido.cliente_telefono,
        mensaje: texto,
        tipoAviso: 'cliente_listo',
        pedidoId: pedido.id,
      });
    } else if (tipoAviso === 'cliente_camino') {
      const texto = compilarPlantillaWhatsApp(plantillas.cliente_en_camino, pedido, negocio);
      setWaModal({
        open: true,
        titulo: 'Avisar al cliente: Pedido en Camino',
        destinatarioNombre: pedido.cliente_nombre,
        telefono: pedido.cliente_telefono,
        mensaje: texto,
        tipoAviso: 'cliente_camino',
        pedidoId: pedido.id,
        cambiarAEnCamino,
      });
    } else if (tipoAviso === 'cadeteria') {
      const cadeteObj =
        pedido.cadete || cadetes.find((c) => c.id === pedido.cadete_id) || cadetes[0];
      const esExterna = cadeteObj?.tipo === 'externa';
      const tpl = esExterna ? plantillas.cadeteria_externa : plantillas.cadete_propio;
      const texto = compilarPlantillaWhatsApp(tpl, pedido, negocio);
      setWaModal({
        open: true,
        titulo: esExterna
          ? 'Solicitar retiro a Cadetería Externa'
          : 'Avisar envío a Cadete Propio',
        destinatarioNombre: cadeteObj?.nombre || 'Cadetería',
        telefono: cadeteObj?.telefono_whatsapp || '',
        mensaje: texto,
        tipoAviso: 'cadeteria',
        pedidoId: pedido.id,
      });
    }
  };

  const enviarWhatsAppDesdeModal = async () => {
    if (!waModal.telefono.trim()) return;
    abrirWhatsAppConTexto(waModal.telefono, waModal.mensaje);

    const payload: Record<string, unknown> = {
      pedido_id: waModal.pedidoId,
      marcar_aviso: waModal.tipoAviso,
    };
    if (waModal.cambiarAEnCamino) {
      payload.nuevo_estado = 'en_camino';
    }
    await actualizarPedido(payload);
    setWaModal((prev) => ({ ...prev, open: false }));
  };

  // Calcular avisos a cadetería vencidos/pendientes
  const ahoraMs = Date.now();
  const avisosCadeteriaPendientes = pedidos.filter((p) => {
    if (p.tipo_entrega !== 'envio') return false;
    if (p.cadeteria_avisada_at) return false;
    if (!['nuevo', 'en_preparacion', 'listo'].includes(p.estado)) return false;
    if (!p.aviso_programado_at) return p.estado === 'listo';
    return new Date(p.aviso_programado_at).getTime() <= ahoraMs;
  });

  const pedidosFiltrados = pedidos.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.numero_pedido.toString().includes(q) ||
      p.cliente_nombre.toLowerCase().includes(q) ||
      p.cliente_telefono.toLowerCase().includes(q) ||
      (p.direccion && p.direccion.toLowerCase().includes(q))
    );
  });

  const contarPorEstado = (est: EstadoPedido) =>
    pedidos.filter((p) => p.estado === est).length;

  const getBadgeEstado = (estado: EstadoPedido) => {
    switch (estado) {
      case 'nuevo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950/90 text-sky-300 border border-sky-700/70">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            Nuevo
          </span>
        );
      case 'en_preparacion':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/90 text-amber-300 border border-amber-700/70">
            <Clock className="w-3 h-3 text-amber-400" />
            En preparación
          </span>
        );
      case 'listo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/90 text-emerald-300 border border-emerald-700/70">
            <Package className="w-3 h-3 text-emerald-400" />
            Listo
          </span>
        );
      case 'en_camino':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/90 text-indigo-300 border border-indigo-700/70">
            <Bike className="w-3.5 h-3.5 text-indigo-400" />
            En camino
          </span>
        );
      case 'entregado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Entregado
          </span>
        );
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/90 text-rose-300 border border-rose-800/70">
            <XCircle className="w-3 h-3 text-rose-400" />
            Cancelado
          </span>
        );
    }
  };

  const getMedioPagoBadge = (medio?: MedioPago | null, estadoPago?: EstadoPago) => {
    const pagado = estadoPago === 'pagado';
    const label =
      medio === 'efectivo'
        ? 'Efectivo'
        : medio === 'transferencia'
        ? 'Transferencia'
        : medio === 'mercadopago'
        ? 'MercadoPago'
        : 'Sin definir';
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border ${
          pagado
            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
            : 'bg-zinc-900 text-zinc-300 border-zinc-800'
        }`}
      >
        <Wallet className="w-3 h-3" />
        {label} {pagado ? '(Pagado)' : ''}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Acciones Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-amber-500" />
            Bandeja Operativa de Pedidos
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gestión de pedidos online y de mostrador, avisos a clientes, cadetería y cobros
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSonidoActivo((v) => !v)}
            title={sonidoActivo ? 'Alerta sonora activada' : 'Alerta sonora silenciada'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              sonidoActivo
                ? 'bg-zinc-900 border-zinc-800 text-amber-400 hover:bg-zinc-800'
                : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {sonidoActivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline">{sonidoActivo ? 'Sonido ON' : 'Silenciado'}</span>
          </button>

          <button
            type="button"
            onClick={fetchPedidos}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={abrirModalManual}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Pedido Manual</span>
          </button>
        </div>
      </div>

      {/* Alerta de Avisos Pendientes a Cadetería (Sección H.2) */}
      {avisosCadeteriaPendientes.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-700/60 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-200">
                Tenés {avisosCadeteriaPendientes.length}{' '}
                {avisosCadeteriaPendientes.length === 1
                  ? 'pedido de envío pendiente de avisar a cadetería'
                  : 'pedidos de envío pendientes de avisar a cadetería'}
              </div>
              <p className="text-[11px] text-amber-300/80">
                Pedidos:{' '}
                {avisosCadeteriaPendientes.map((p) => `#${p.numero_pedido}`).join(', ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const primero = avisosCadeteriaPendientes[0];
              setPedidoSeleccionado(primero);
              prepararAvisoWhatsApp(primero, 'cadeteria');
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            Avisar ahora (#{avisosCadeteriaPendientes[0].numero_pedido})
          </button>
        </div>
      )}

      {/* Barra de Filtros: Estados, Origen, Búsqueda y Fecha */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Pestañas de estado */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800 overflow-x-auto text-xs">
            {[
              { id: 'todos', label: 'Todos', count: pedidos.length },
              { id: 'nuevo', label: 'Nuevos', count: contarPorEstado('nuevo') },
              { id: 'en_preparacion', label: 'En Preparación', count: contarPorEstado('en_preparacion') },
              { id: 'listo', label: 'Listos', count: contarPorEstado('listo') },
              { id: 'en_camino', label: 'En Camino', count: contarPorEstado('en_camino') },
              { id: 'entregado', label: 'Entregados', count: contarPorEstado('entregado') },
              { id: 'cancelado', label: 'Cancelados', count: contarPorEstado('cancelado') },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFiltroEstado(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  filtroEstado === tab.id
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      filtroEstado === tab.id
                        ? 'bg-zinc-950/20 text-zinc-950 font-extrabold'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filtro por origen + Búsqueda + Fecha */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroOrigen}
              onChange={(e) => setFiltroOrigen(e.target.value)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="todos">Origen: Todos</option>
              <option value="online">Solo Online (Catálogo)</option>
              <option value="manual">Solo Manuales (Mostrador/Tel)</option>
            </select>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="# Pedido, cliente, dirección..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Grilla Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Tarjetas de Pedidos */}
        <div className="lg:col-span-2 space-y-3">
          {pedidosFiltrados.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-zinc-300">
                No hay pedidos con los filtros seleccionados
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Los pedidos nuevos del catálogo público o cargados manualmente aparecerán acá.
              </p>
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => {
              const esSeleccionado = pedidoSeleccionado?.id === pedido.id;
              const requiereAvisoCadete = avisosCadeteriaPendientes.some(
                (p) => p.id === pedido.id
              );

              return (
                <div
                  key={pedido.id}
                  onClick={() => setPedidoSeleccionado(pedido)}
                  className={`bg-zinc-900/90 border rounded-2xl p-4 sm:p-5 transition-all cursor-pointer hover:border-zinc-700 ${
                    esSeleccionado
                      ? 'border-amber-500 ring-1 ring-amber-500/30 bg-zinc-900'
                      : 'border-zinc-800'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-extrabold text-white">
                        #{pedido.numero_pedido}
                      </span>
                      {getBadgeEstado(pedido.estado)}

                      {/* Etiqueta de Origen */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${
                          pedido.origen === 'manual'
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        <Store className="w-3 h-3" />
                        {pedido.origen === 'manual' ? 'Manual' : 'Online'}
                      </span>

                      {/* Tipo de Entrega */}
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-950 px-2 py-0.5 rounded-lg border border-zinc-800">
                        {pedido.tipo_entrega === 'envio' ? (
                          <>
                            <Bike className="w-3 h-3 text-amber-400" />
                            Envío
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3 h-3 text-emerald-400" />
                            Retiro
                          </>
                        )}
                      </span>

                      {/* Medio de Pago */}
                      {getMedioPagoBadge(pedido.medio_pago, pedido.estado_pago)}

                      {requiereAvisoCadete && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-lg">
                          <BellRing className="w-3 h-3" />
                          Avisar cadete
                        </span>
                      )}
                    </div>

                    <span className="text-base font-bold text-white font-mono">
                      {formatCurrency(pedido.total)}
                    </span>
                  </div>

                  {/* Segunda fila: Cliente, dirección, cadete y fecha */}
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 gap-2 border-t border-zinc-800/60 pt-3">
                    <div className="space-y-0.5">
                      <div>
                        <strong className="text-zinc-200">{pedido.cliente_nombre}</strong> •{' '}
                        <span className="font-mono text-zinc-400">{pedido.cliente_telefono}</span>
                      </div>
                      {pedido.tipo_entrega === 'envio' && pedido.direccion && (
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{pedido.direccion}</span>
                          {pedido.cadete && (
                            <span className="ml-2 text-indigo-300 font-medium">
                              • Cadete: {pedido.cadete.nombre}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {formatDate(pedido.created_at)}
                    </span>
                  </div>

                  {/* Resumen de productos */}
                  <div className="mt-2.5 text-xs text-zinc-400 flex flex-wrap gap-1.5">
                    {pedido.items?.map((it) => (
                      <span
                        key={it.id}
                        className="bg-zinc-950 px-2 py-0.5 rounded-md text-[11px] text-zinc-300 border border-zinc-800"
                      >
                        {it.cantidad}x {it.nombre_producto}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Columna Derecha: Panel de Control del Pedido Seleccionado */}
        <div className="lg:col-span-1">
          {pedidoSeleccionado ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 sticky top-20 space-y-5 shadow-2xl max-h-[calc(100vh-6rem)] overflow-y-auto">
              {/* Cabecera del Pedido */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white font-mono">
                      Pedido #{pedidoSeleccionado.numero_pedido}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {pedidoSeleccionado.origen}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {formatDate(pedidoSeleccionado.created_at)}
                  </span>
                </div>
                {getBadgeEstado(pedidoSeleccionado.estado)}
              </div>

              {/* Alerta si el cadete reportó que no se pudo entregar */}
              {pedidoSeleccionado.no_entregado_motivo && (
                <div className="bg-rose-950/50 border border-rose-800/80 rounded-2xl p-3 text-xs text-rose-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-300">
                    <AlertCircle className="w-4 h-4" />
                    Incidencia reportada por el cadete
                  </div>
                  <div>
                    <strong>Motivo:</strong> {pedidoSeleccionado.no_entregado_motivo}
                  </div>
                  {pedidoSeleccionado.no_entregado_observacion && (
                    <div>
                      <strong>Detalle:</strong> {pedidoSeleccionado.no_entregado_observacion}
                    </div>
                  )}
                </div>
              )}

              {/* Datos del Cliente y Dirección */}
              <div className="space-y-2 text-xs">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                  Cliente & Modalidad ({pedidoSeleccionado.tipo_entrega === 'envio' ? 'Envío a domicilio' : 'Retiro en local'})
                </span>
                <div className="font-semibold text-white text-sm">
                  {pedidoSeleccionado.cliente_nombre}
                </div>
                {pedidoSeleccionado.cliente_telefono &&
                  pedidoSeleccionado.cliente_telefono !== 'Mostrador' && (
                    <div className="text-zinc-300 font-mono flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{pedidoSeleccionado.cliente_telefono}</span>
                    </div>
                  )}
                {pedidoSeleccionado.direccion && (
                  <div className="text-zinc-200 bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                    <strong className="text-zinc-400 block text-[11px]">
                      Dirección de Entrega:
                    </strong>
                    <div>{pedidoSeleccionado.direccion}</div>
                    {pedidoSeleccionado.referencias_direccion && (
                      <div className="text-[11px] text-zinc-400">
                        Ref: {pedidoSeleccionado.referencias_direccion}
                      </div>
                    )}
                  </div>
                )}
                {pedidoSeleccionado.observaciones && (
                  <div className="text-amber-200 bg-amber-950/30 p-3 rounded-xl border border-amber-800/40">
                    <strong className="text-amber-400 block text-[11px]">
                      Observaciones del Pedido:
                    </strong>
                    {pedidoSeleccionado.observaciones}
                  </div>
                )}
              </div>

              {/* Avisos por WhatsApp al Cliente (Sección G) */}
              {pedidoSeleccionado.cliente_telefono &&
                pedidoSeleccionado.cliente_telefono !== 'Mostrador' && (
                  <div className="border-t border-zinc-800 pt-4 space-y-2">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                      Avisos al Cliente por WhatsApp
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => prepararAvisoWhatsApp(pedidoSeleccionado, 'cliente_listo')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/60 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>
                          {pedidoSeleccionado.cliente_avisado_listo_at
                            ? 'Reenviar "Listo"'
                            : 'Avisar "Pedido Listo"'}
                        </span>
                      </button>

                      {pedidoSeleccionado.tipo_entrega === 'envio' && (
                        <button
                          type="button"
                          onClick={() =>
                            prepararAvisoWhatsApp(
                              pedidoSeleccionado,
                              'cliente_camino',
                              pedidoSeleccionado.estado === 'listo'
                            )
                          }
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-800/60 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {pedidoSeleccionado.cliente_avisado_camino_at
                              ? 'Reenviar "En Camino"'
                              : 'Avisar "En Camino"'}
                          </span>
                        </button>
                      )}
                    </div>
                    {(pedidoSeleccionado.cliente_avisado_listo_at ||
                      pedidoSeleccionado.cliente_avisado_camino_at) && (
                      <div className="text-[11px] text-zinc-500 space-y-0.5">
                        {pedidoSeleccionado.cliente_avisado_listo_at && (
                          <div>
                            • Avisado Listo: {formatDate(pedidoSeleccionado.cliente_avisado_listo_at)}
                          </div>
                        )}
                        {pedidoSeleccionado.cliente_avisado_camino_at && (
                          <div>
                            • Avisado En Camino:{' '}
                            {formatDate(pedidoSeleccionado.cliente_avisado_camino_at)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {/* Cadetería y Despacho (Sección H - solo si es envío) */}
              {pedidoSeleccionado.tipo_entrega === 'envio' && (
                <div className="border-t border-zinc-800 pt-4 space-y-2.5">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                    Asignación de Cadete / Empresa Externa
                  </span>

                  <select
                    value={pedidoSeleccionado.cadete_id || ''}
                    onChange={(e) =>
                      actualizarPedido({
                        pedido_id: pedidoSeleccionado.id,
                        cadete_id: e.target.value || null,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- Sin cadete asignado --</option>
                    {cadetes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.tipo === 'externa' ? 'Cadetería Externa' : 'Cadete Propio'})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => prepararAvisoWhatsApp(pedidoSeleccionado, 'cadeteria')}
                    disabled={cadetes.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Bike className="w-4 h-4" />
                    <span>
                      {pedidoSeleccionado.cadeteria_avisada_at
                        ? 'Reenviar aviso a Cadetería por WhatsApp'
                        : 'Avisar a Cadetería por WhatsApp'}
                    </span>
                  </button>

                  {pedidoSeleccionado.cadeteria_avisada_at && (
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Cadetería avisada: {formatDate(pedidoSeleccionado.cadeteria_avisada_at)}
                    </div>
                  )}

                  {/* Ubicación GPS registrada por el cadete al entregar (Sección H.4 / H.5) */}
                  {pedidoSeleccionado.estado === 'entregado' && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                        Comprobante de Entrega
                      </div>
                      {pedidoSeleccionado.entrega_lat && pedidoSeleccionado.entrega_lng ? (
                        <div className="space-y-1">
                          <a
                            href={`https://www.google.com/maps?q=${pedidoSeleccionado.entrega_lat},${pedidoSeleccionado.entrega_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-amber-400 hover:underline font-medium"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Ver punto exacto en Google Maps
                          </a>
                          <div className="text-[11px] text-zinc-500">
                            Precisión GPS: ±{Math.round(pedidoSeleccionado.entrega_precision_m || 0)}m
                          </div>
                        </div>
                      ) : pedidoSeleccionado.entregado_sin_ubicacion ? (
                        <div className="text-[11px] text-amber-300">
                          Entregado sin ubicación GPS ({pedidoSeleccionado.motivo_sin_ubicacion || 'Sin señal'})
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-500">
                          Marcado como entregado desde el panel administrativo.
                        </div>
                      )}
                      {pedidoSeleccionado.monto_cobrado_declarado !== null &&
                        pedidoSeleccionado.monto_cobrado_declarado !== undefined && (
                          <div className="text-[11px] text-emerald-300 font-mono">
                            Efectivo rendido por cadete:{' '}
                            {formatCurrency(pedidoSeleccionado.monto_cobrado_declarado)}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}

              {/* Medio de Pago y Estado de Cobro (Sección C.2) */}
              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                  Medio de Pago y Cobro
                </span>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {(
                    [
                      { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                      { id: 'transferencia', label: 'Transferencia', icon: CreditCard },
                      { id: 'mercadopago', label: 'MercadoPago', icon: Wallet },
                    ] as const
                  ).map((mp) => {
                    const Icon = mp.icon;
                    const activo = pedidoSeleccionado.medio_pago === mp.id;
                    return (
                      <button
                        key={mp.id}
                        type="button"
                        onClick={() =>
                          actualizarPedido({
                            pedido_id: pedidoSeleccionado.id,
                            medio_pago: mp.id,
                            monto_a_cobrar:
                              mp.id === 'efectivo' ? pedidoSeleccionado.total : 0,
                          })
                        }
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
                          activo
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{mp.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-xs">
                  <span className="text-zinc-400">Estado del pago:</span>
                  <button
                    type="button"
                    onClick={() =>
                      actualizarPedido({
                        pedido_id: pedidoSeleccionado.id,
                        estado_pago:
                          pedidoSeleccionado.estado_pago === 'pagado'
                            ? 'pendiente'
                            : 'pagado',
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
                      pedidoSeleccionado.estado_pago === 'pagado'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {pedidoSeleccionado.estado_pago === 'pagado'
                      ? 'PAGADO'
                      : 'PENDIENTE DE COBRO'}
                  </button>
                </div>
              </div>

              {/* Detalle de Productos */}
              <div className="space-y-2 border-t border-zinc-800 pt-4">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                  Productos del Pedido
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pedidoSeleccionado.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between text-xs py-1.5 border-b border-zinc-800/50"
                    >
                      <div>
                        <div className="font-medium text-zinc-200">
                          {item.cantidad}x {item.nombre_producto}
                        </div>
                        {item.aclaraciones && (
                          <div className="text-[11px] text-amber-400 italic">
                            Nota: {item.aclaraciones}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-zinc-300 font-semibold">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-zinc-800">
                  <span>Total del Pedido:</span>
                  <span className="text-amber-400 font-mono text-base">
                    {formatCurrency(pedidoSeleccionado.total)}
                  </span>
                </div>
              </div>

              {/* Cambio de Estado de la Orden (Sección C.1) */}
              <div className="border-t border-zinc-800 pt-4 space-y-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                  Flujo de Estados del Pedido
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => cambiarEstado(pedidoSeleccionado, 'en_preparacion')}
                    className="p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 font-semibold border border-amber-800/60 transition-colors cursor-pointer"
                  >
                    1. En Preparación
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(pedidoSeleccionado, 'listo')}
                    className="p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 font-semibold border border-emerald-800/60 transition-colors cursor-pointer"
                  >
                    2. Listo
                  </button>
                  {pedidoSeleccionado.tipo_entrega === 'envio' && (
                    <button
                      type="button"
                      onClick={() => cambiarEstado(pedidoSeleccionado, 'en_camino')}
                      className="p-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 font-semibold border border-indigo-800/60 transition-colors cursor-pointer col-span-2"
                    >
                      3. En Camino (Despachar con Cadete)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => cambiarEstado(pedidoSeleccionado, 'entregado')}
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-colors cursor-pointer"
                  >
                    Entregado (Generar Venta)
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(pedidoSeleccionado, 'cancelado')}
                    className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-semibold border border-rose-800/50 transition-colors cursor-pointer"
                  >
                    Cancelar Pedido
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center p-10 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl text-center text-zinc-500">
              <ChevronRight className="w-8 h-8 mb-2 text-zinc-600" />
              <p className="text-xs">
                Seleccioná un pedido de la lista para gestionar su estado, asignar cadete, registrar el pago o avisar por WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Carga Rápida de Pedido Manual (Sección B) */}
      <Modal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        title="Cargar Pedido Manual (Mostrador / Teléfono)"
        maxWidth="2xl"
      >
        <form onSubmit={guardarPedidoManual} className="space-y-4">
          {manualError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
              {manualError}
            </div>
          )}

          {/* Selector rápido de productos */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              1. Buscar y agregar productos
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Escribí el nombre del producto para agregar rápido..."
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
              {productos
                .filter((p) =>
                  p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
                )
                .map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => agregarProductoManual(prod)}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left text-xs transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-zinc-200 truncate pr-2">
                      {prod.nombre}
                    </span>
                    <span className="font-mono text-amber-400 font-bold shrink-0">
                      + {formatCurrency(prod.precio_venta)}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Items agregados al pedido manual */}
          {manualItems.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="text-xs font-semibold text-zinc-400">
                Productos seleccionados ({manualItems.reduce((a, b) => a + b.cantidad, 0)})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {manualItems.map((it) => (
                  <div
                    key={it.producto_id}
                    className="flex items-center justify-between gap-2 text-xs py-1 border-b border-zinc-900"
                  >
                    <div className="font-medium text-white">
                      {it.cantidad}x {it.nombre_producto}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-300">
                        {formatCurrency(it.precio_unitario * it.cantidad)}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidadManual(it.producto_id, -1)}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarCantidadManual(it.producto_id, 1)}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setManualItems((prev) =>
                            prev.filter((x) => x.producto_id !== it.producto_id)
                          )
                        }
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-zinc-800 text-sm font-bold text-white">
                <span>Total a cobrar:</span>
                <span className="font-mono text-amber-400">
                  {formatCurrency(totalManual)}
                </span>
              </div>
            </div>
          )}

          {/* Modalidad de entrega y datos del cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Tipo de Entrega
              </label>
              <select
                value={manualForm.tipo_entrega}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    tipo_entrega: e.target.value as 'retiro' | 'envio',
                  }))
                }
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              >
                <option value="retiro">Retiro en Mostrador / Local</option>
                <option value="envio">Envío a Domicilio</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Medio de Pago
              </label>
              <select
                value={manualForm.medio_pago}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    medio_pago: e.target.value as MedioPago,
                  }))
                }
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">MercadoPago</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Nombre del Cliente (opcional en mostrador)
              </label>
              <input
                type="text"
                placeholder="Ej: Juan Pérez o Mostrador"
                value={manualForm.cliente_nombre}
                onChange={(e) =>
                  setManualForm((prev) => ({ ...prev, cliente_nombre: e.target.value }))
                }
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Teléfono WhatsApp (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: 1123456789"
                value={manualForm.cliente_telefono}
                onChange={(e) =>
                  setManualForm((prev) => ({
                    ...prev,
                    cliente_telefono: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {manualForm.tipo_entrega === 'envio' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <div className="sm:col-span-2">
                <label className="text-xs text-amber-400 font-semibold block mb-1">
                  Dirección de Entrega (Obligatoria para envío) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Calle, número, piso/depto, localidad"
                  value={manualForm.direccion}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, direccion: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Referencias de domicilio
                </label>
                <input
                  type="text"
                  placeholder="Entre calles, portón negro..."
                  value={manualForm.referencias_direccion}
                  onChange={(e) =>
                    setManualForm((prev) => ({
                      ...prev,
                      referencias_direccion: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Asignar Cadete
                </label>
                <select
                  value={manualForm.cadete_id}
                  onChange={(e) =>
                    setManualForm((prev) => ({ ...prev, cadete_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                >
                  <option value="">Automático / Sin asignar</option>
                  {cadetes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.tipo})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Observaciones generales
            </label>
            <input
              type="text"
              placeholder="Aclaraciones de cocción, vuelto de $20.000, etc."
              value={manualForm.observaciones}
              onChange={(e) =>
                setManualForm((prev) => ({ ...prev, observaciones: e.target.value }))
              }
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowManualModal(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={manualSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {manualSubmitting ? 'Guardando...' : 'Confirmar Pedido Manual'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Previsualizar y Editar Mensaje de WhatsApp antes de Abrir wa.me */}
      <Modal
        isOpen={waModal.open}
        onClose={() => setWaModal((prev) => ({ ...prev, open: false }))}
        title={waModal.titulo}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Destinatario</label>
              <input
                type="text"
                value={waModal.destinatarioNombre}
                readOnly
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Teléfono de WhatsApp
              </label>
              <input
                type="text"
                value={waModal.telefono}
                onChange={(e) =>
                  setWaModal((prev) => ({ ...prev, telefono: e.target.value }))
                }
                placeholder="Ej: 5491123456789"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1">
              Mensaje a enviar (podés editarlo antes de abrir WhatsApp)
            </label>
            <textarea
              rows={6}
              value={waModal.mensaje}
              onChange={(e) =>
                setWaModal((prev) => ({ ...prev, mensaje: e.target.value }))
              }
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setWaModal((prev) => ({ ...prev, open: false }))}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={enviarWhatsAppDesdeModal}
              disabled={!waModal.telefono.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Abrir WhatsApp y Registrar Aviso</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Confirmación de Cancelación (y anulación de venta si ya fue entregado) */}
      <Modal
        isOpen={cancelModal.open}
        onClose={() => setCancelModal({ open: false, pedido: null, motivo: '' })}
        title={`Cancelar Pedido #${cancelModal.pedido?.numero_pedido || ''}`}
      >
        <div className="space-y-4">
          {cancelModal.pedido?.estado === 'entregado' && (
            <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/60 text-xs text-amber-200">
              <strong>Atención:</strong> Este pedido ya figuraba como{' '}
              <strong>Entregado</strong>. Al cancelarlo, su venta asociada se marcará
              automáticamente como <strong>Anulada</strong> en los reportes y cierres de
              caja, dejando constancia del motivo y de tu usuario.
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-300 font-medium block mb-1">
              Motivo de la cancelación / anulación *
            </label>
            <input
              type="text"
              value={cancelModal.motivo}
              onChange={(e) =>
                setCancelModal((prev) => ({ ...prev, motivo: e.target.value }))
              }
              placeholder="Ej: El cliente canceló / Error de cobro"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancelModal({ open: false, pedido: null, motivo: '' })}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmarCancelacion}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
            >
              Confirmar Cancelación
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
