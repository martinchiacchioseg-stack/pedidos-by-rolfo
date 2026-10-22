'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Package,
  Bike,
  XCircle,
  RefreshCw,
  Search,
  Calendar,
  MessageSquare,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Pedido, EstadoPedido } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroFecha, setFiltroFecha] = useState<string>('');
  const [search, setSearch] = useState('');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);

  const fetchPedidos = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroEstado !== 'todos') params.set('estado', filtroEstado);
      if (filtroFecha) params.set('fecha', filtroFecha);

      const res = await fetch(`/api/admin/pedidos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPedidos(data.pedidos || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroFecha]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const cambiarEstado = async (pedidoId: string, nuevoEstado: EstadoPedido) => {
    try {
      const res = await fetch('/api/admin/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoId, nuevo_estado: nuevoEstado }),
      });
      if (res.ok) {
        fetchPedidos();
        if (pedidoSeleccionado?.id === pedidoId) {
          setPedidoSeleccionado((prev) => prev ? { ...prev, estado: nuevoEstado } : null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.numero_pedido.toString().includes(q) ||
      p.cliente_nombre.toLowerCase().includes(q) ||
      p.cliente_telefono.includes(q) ||
      (p.direccion && p.direccion.toLowerCase().includes(q))
    );
  });

  const getBadgeEstado = (estado: EstadoPedido) => {
    switch (estado) {
      case 'nuevo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
            Nuevo
          </span>
        );
      case 'en_preparacion':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
            <Clock className="w-3 h-3 text-amber-400" />
            En Preparación
          </span>
        );
      case 'listo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            <Package className="w-3 h-3 text-emerald-400" />
            Listo para entrega
          </span>
        );
      case 'entregado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            <CheckCircle2 className="w-3 h-3" />
            Entregado
          </span>
        );
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
            <XCircle className="w-3 h-3 text-rose-400" />
            Cancelado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Título y botón refresco */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-rose-500" />
            Bandeja de Pedidos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión en tiempo real de órdenes recibidas por WhatsApp y catálogo online
          </p>
        </div>

        <button
          onClick={fetchPedidos}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Filtros de Búsqueda y Estados */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Pestañas de estado */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto text-xs">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'nuevo', label: 'Nuevos' },
            { id: 'en_preparacion', label: 'En Cocina' },
            { id: 'listo', label: 'Listos' },
            { id: 'entregado', label: 'Entregados' },
            { id: 'cancelado', label: 'Cancelados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroEstado(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filtroEstado === tab.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador y selector de fecha */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="# Pedido o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="relative">
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Listado de tarjetas de pedidos */}
        <div className="lg:col-span-2 space-y-3">
          {pedidosFiltrados.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No hay pedidos para mostrar</h3>
              <p className="text-xs text-slate-500 mt-1">Los nuevos pedidos se verán reflejados aquí.</p>
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => {
              const esSeleccionado = pedidoSeleccionado?.id === pedido.id;
              return (
                <div
                  key={pedido.id}
                  onClick={() => setPedidoSeleccionado(pedido)}
                  className={`bg-slate-900/90 border rounded-2xl p-4 sm:p-5 transition-all cursor-pointer hover:border-slate-700 ${
                    esSeleccionado ? 'border-rose-500 bg-slate-900' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-extrabold text-white">
                        #{pedido.numero_pedido}
                      </span>
                      {getBadgeEstado(pedido.estado)}
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                        {pedido.tipo_entrega === 'envio' ? (
                          <>
                            <Bike className="w-3 h-3 text-rose-400" />
                            Envío
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3 h-3 text-emerald-400" />
                            Retiro
                          </>
                        )}
                      </span>
                    </div>

                    <span className="text-base font-bold text-white font-mono">
                      {formatCurrency(pedido.total)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-1 border-t border-slate-800/60 pt-3">
                    <div>
                      <strong className="text-slate-200">{pedido.cliente_nombre}</strong> •{' '}
                      <span className="font-mono">{pedido.cliente_telefono}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{formatDate(pedido.created_at)}</span>
                  </div>

                  {/* Resumen de items */}
                  <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-2">
                    {pedido.items?.map((it) => (
                      <span key={it.id} className="bg-slate-950 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-800">
                        {it.cantidad}x {it.nombre_producto}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Columna Derecha: Detalle del Pedido Seleccionado y Acciones de Cambio de Estado */}
        <div className="lg:col-span-1">
          {pedidoSeleccionado ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sticky top-24 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white font-mono">
                    Pedido #{pedidoSeleccionado.numero_pedido}
                  </h3>
                  <span className="text-xs text-slate-500">{formatDate(pedidoSeleccionado.created_at)}</span>
                </div>
                {getBadgeEstado(pedidoSeleccionado.estado)}
              </div>

              {/* Datos del Cliente */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Cliente & Entrega
                </span>
                <div className="font-semibold text-white text-sm">{pedidoSeleccionado.cliente_nombre}</div>
                <div className="text-slate-300 font-mono flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <a
                    href={`https://wa.me/${pedidoSeleccionado.cliente_telefono.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-emerald-400 hover:underline"
                  >
                    {pedidoSeleccionado.cliente_telefono}
                  </a>
                </div>
                {pedidoSeleccionado.direccion && (
                  <div className="text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <strong className="text-slate-400 block text-[11px]">Dirección de Entrega:</strong>
                    {pedidoSeleccionado.direccion}
                  </div>
                )}
                {pedidoSeleccionado.observaciones && (
                  <div className="text-amber-300/90 bg-amber-950/20 p-2.5 rounded-xl border border-amber-900/30">
                    <strong className="text-amber-400 block text-[11px]">Observaciones del Cliente:</strong>
                    {pedidoSeleccionado.observaciones}
                  </div>
                )}
              </div>

              {/* Items del pedido */}
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Detalle de Productos
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {pedidoSeleccionado.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between text-xs py-1.5 border-b border-slate-800/40"
                    >
                      <div>
                        <div className="font-medium text-slate-200">
                          {item.cantidad}x {item.nombre_producto}
                        </div>
                        {item.aclaraciones && (
                          <div className="text-[11px] text-amber-400 italic">
                            Nota: {item.aclaraciones}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-slate-300 font-semibold">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>Total a Cobrar:</span>
                  <span className="text-rose-400 font-mono text-base">
                    {formatCurrency(pedidoSeleccionado.total)}
                  </span>
                </div>
              </div>

              {/* Controles para cambiar de estado */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Actualizar Estado de la Orden
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => cambiarEstado(pedidoSeleccionado.id, 'en_preparacion')}
                    className="p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 font-medium border border-amber-800/60 transition-colors cursor-pointer"
                  >
                    A Cocina (Preparar)
                  </button>
                  <button
                    onClick={() => cambiarEstado(pedidoSeleccionado.id, 'listo')}
                    className="p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 font-medium border border-emerald-800/60 transition-colors cursor-pointer"
                  >
                    Listo para Retirar/Despacho
                  </button>
                  <button
                    onClick={() => cambiarEstado(pedidoSeleccionado.id, 'entregado')}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
                  >
                    Completado / Entregado
                  </button>
                  <button
                    onClick={() => cambiarEstado(pedidoSeleccionado.id, 'cancelado')}
                    className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-medium border border-rose-800/50 transition-colors cursor-pointer"
                  >
                    Cancelar Pedido
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800/60 rounded-3xl text-center text-slate-500">
              <ChevronRight className="w-8 h-8 mb-2 text-slate-600" />
              <p className="text-xs">Seleccioná un pedido de la lista para ver el detalle y actualizar su estado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
