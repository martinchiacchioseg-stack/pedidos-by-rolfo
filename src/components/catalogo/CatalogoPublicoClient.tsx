'use client';

import { useState, useEffect, useId } from 'react';
import {
  UtensilsCrossed,
  Phone,
  Clock,
  ShoppingBag,
  Plus,
  Minus,
  Store,
  Bike,
  MessageCircle,
  Copy,
  Check,
  AlertCircle,
  X,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Negocio, Categoria, Producto, TipoEntrega } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { SuperAdminAccessFooter } from '@/components/shared/SuperAdminAccessFooter';

interface CartItem {
  producto: Producto;
  cantidad: number;
  aclaraciones: string;
}

interface CatalogoData {
  servicio_no_disponible: boolean;
  negocio: Negocio;
  categorias: Categoria[];
  productos: Producto[];
}

export function CatalogoPublicoClient({ slug }: { slug: string }) {
  const [data, setData] = useState<CatalogoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrito de compras
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Formulario de Checkout del cliente
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('envio');
  const [direccion, setDireccion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Pantalla de confirmación de pedido
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{
    numero_pedido: number;
    whatsapp_url: string;
    mensaje_texto: string;
    total: number;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Filtro de categorías
  const [categoriaActiva, setCategoriaActiva] = useState<string>('todas');

  const honeypotId = useId();

  useEffect(() => {
    async function loadCatalogo() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/negocio/${slug}`);
        if (!res.ok) {
          throw new Error('No se pudo encontrar el menú del negocio solicitado.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar catálogo');
      } finally {
        setLoading(false);
      }
    }

    loadCatalogo();
  }, [slug]);

  // Funciones del Carrito
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito((prev) => {
      const index = prev.findIndex((item) => item.producto.id === producto.id);
      if (index > -1) {
        const copy = [...prev];
        copy[index].cantidad += 1;
        return copy;
      }
      return [...prev, { producto, cantidad: 1, aclaraciones: '' }];
    });
  };

  const modificarCantidad = (productoId: string, delta: number) => {
    setCarrito((prev) => {
      return prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const modificarAclaracion = (productoId: string, aclaracion: string) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.producto.id === productoId ? { ...item, aclaraciones: aclaracion } : item
      )
    );
  };

  const totalCarrito = carrito.reduce(
    (acc, item) => acc + item.producto.precio_venta * item.cantidad,
    0
  );
  const cantidadItemsTotal = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  // Enviar Pedido a la Base de Datos y abrir WhatsApp
  const handleEnviarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (carrito.length === 0) {
      setCheckoutError('El carrito se encuentra vacío.');
      return;
    }

    if (tipoEntrega === 'envio' && !direccion.trim()) {
      setCheckoutError('Por favor ingresá tu dirección para el envío.');
      return;
    }

    setEnviandoPedido(true);

    try {
      const payload = {
        negocio_id: data?.negocio.id,
        cliente_nombre: clienteNombre,
        cliente_telefono: clienteTelefono,
        tipo_entrega: tipoEntrega,
        direccion: tipoEntrega === 'envio' ? direccion : null,
        observaciones,
        honeypot,
        items: carrito.map((item) => ({
          producto_id: item.producto.id,
          cantidad: item.cantidad,
          aclaraciones: item.aclaraciones || null,
        })),
      };

      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || 'No se pudo registrar el pedido.');
      }

      // 1. Mostrar pantalla de confirmación
      setPedidoConfirmado({
        numero_pedido: responseData.numero_pedido,
        whatsapp_url: responseData.whatsapp_url,
        mensaje_texto: responseData.mensaje_texto,
        total: responseData.total,
      });

      // 2. Abrir WhatsApp automáticamente mediante wa.me
      window.open(responseData.whatsapp_url, '_blank');

      // 3. Limpiar carrito
      setCarrito([]);
      setCarritoAbierto(false);
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Error inesperado al enviar');
    } finally {
      setEnviandoPedido(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-medium">Cargando menú digital...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-between text-neutral-100">
        <div className="max-w-md mx-auto my-auto p-6 text-center">
          <UtensilsCrossed className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Negocio no encontrado</h2>
          <p className="text-xs text-neutral-400 mt-1">{error || 'El menú digital solicitado no existe.'}</p>
        </div>
        <SuperAdminAccessFooter />
      </div>
    );
  }

  // PANTALLA: SERVICIO NO DISPONIBLE (VENCIDO O PAUSADO)
  if (data.servicio_no_disponible) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-between text-neutral-100">
        <div className="max-w-md mx-auto my-auto p-8 text-center bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Servicio no disponible</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            El catálogo de <strong className="text-white">{data.negocio.nombre}</strong> no se encuentra activo en este momento.
          </p>
          <div className="mt-6 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-[11px] text-neutral-500">
            Si sos el administrador de este comercio, por favor contactá al soporte central de Pedidos by ROLΦ para reactivar tu cuenta.
          </div>
        </div>
        <SuperAdminAccessFooter negocioNombre={data.negocio.nombre} />
      </div>
    );
  }

  const { negocio, categorias, productos } = data;
  const colorPrimario = negocio.color_primario || '#E11D48';
  const whatsappConfigurado = Boolean(negocio.whatsapp_numero);

  // Filtrado de productos por categoría
  const productosFiltrados = productos.filter((p) =>
    categoriaActiva === 'todas' ? true : p.categoria_id === categoriaActiva
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Cabecera / Banner del Comercio */}
      <header className="relative bg-slate-900 border-b border-slate-800/80 pb-6 pt-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {negocio.logo_url ? (
            <img
              src={negocio.logo_url}
              alt={negocio.nombre}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-2 border-slate-700 shadow-2xl flex-shrink-0"
            />
          ) : (
            <div
              style={{ backgroundColor: colorPrimario }}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl text-white flex items-center justify-center font-bold text-3xl shadow-2xl flex-shrink-0"
            >
              {negocio.nombre.charAt(0)}
            </div>
          )}

          <div className="space-y-2 flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {negocio.nombre}
            </h1>

            {negocio.mensaje_bienvenida && (
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {negocio.mensaje_bienvenida}
              </p>
            )}

            {/* Datos de contacto y horarios */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-400">
              {negocio.horarios && (
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {negocio.horarios.dias} • {negocio.horarios.apertura} a {negocio.horarios.cierre} hs
                  </span>
                </div>
              )}
              {negocio.telefono && (
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{negocio.telefono}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Pestañas de Categorías con Scroll Horizontal Suave */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setCategoriaActiva('todas')}
            style={categoriaActiva === 'todas' ? { backgroundColor: colorPrimario } : {}}
            className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap cursor-pointer ${
              categoriaActiva === 'todas'
                ? 'text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Todos ({productos.length})
          </button>
          {categorias.map((cat) => {
            const count = productos.filter((p) => p.categoria_id === cat.id).length;
            if (count === 0) return null;
            const esActiva = categoriaActiva === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setCategoriaActiva(cat.id)}
                style={esActiva ? { backgroundColor: colorPrimario } : {}}
                className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  esActiva
                    ? 'text-white shadow-md'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat.nombre} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Listado de Productos */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28">
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-xs">No hay productos disponibles en esta categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {productosFiltrados.map((prod) => {
              const cantidadEnCarrito =
                carrito.find((item) => item.producto.id === prod.id)?.cantidad || 0;

              return (
                <div
                  key={prod.id}
                  className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
                >
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5">
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-rose-400 transition-colors">
                        {prod.nombre}
                      </h3>
                      {prod.descripcion && (
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {prod.descripcion}
                        </p>
                      )}
                      <div className="text-sm sm:text-base font-extrabold text-white font-mono pt-1">
                        {formatCurrency(prod.precio_venta)}
                      </div>
                    </div>

                    {prod.imagen_url && (
                      <img
                        src={prod.imagen_url}
                        alt={prod.nombre}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-slate-800 flex-shrink-0"
                      />
                    )}
                  </div>

                  {/* Botón Agregar / Contador de Cantidad */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-end">
                    {cantidadEnCarrito > 0 ? (
                      <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded-2xl border border-slate-800">
                        <button
                          onClick={() => modificarCantidad(prod.id, -1)}
                          className="w-7 h-7 rounded-xl bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-xs px-2 text-white">
                          {cantidadEnCarrito}
                        </span>
                        <button
                          onClick={() => modificarCantidad(prod.id, 1)}
                          style={{ backgroundColor: colorPrimario }}
                          className="w-7 h-7 rounded-xl text-white flex items-center justify-center cursor-pointer hover:opacity-90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => agregarAlCarrito(prod)}
                        style={{ backgroundColor: colorPrimario }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-semibold text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* BARRA FLOTANTE DEL CARRITO (MOBILE-FIRST) */}
      {cantidadItemsTotal > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40">
          <button
            onClick={() => setCarritoAbierto(true)}
            style={{ backgroundColor: colorPrimario }}
            className="w-full py-4 px-6 rounded-3xl shadow-2xl flex items-center justify-between text-white font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-xs font-mono font-bold">
                {cantidadItemsTotal}
              </div>
              <span className="text-sm font-bold">Ver Mi Pedido</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold">{formatCurrency(totalCarrito)}</span>
              <ChevronRight className="w-5 h-5 opacity-80" />
            </div>
          </button>
        </div>
      )}

      {/* MODAL / DRAWER DEL CHECKOUT & CARRITO */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Cabecera del modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-white text-base">Resumen de tu Pedido</h3>
              </div>
              <button
                onClick={() => setCarritoAbierto(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scroll */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              {checkoutError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Lista de productos agregados */}
              <div className="space-y-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Productos Seleccionados
                </span>
                {carrito.map((item) => (
                  <div key={item.producto.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">{item.producto.nombre}</span>
                      <span className="font-mono text-white font-bold">
                        {formatCurrency(item.producto.precio_venta * item.cantidad)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Aclaración opcional */}
                      <input
                        type="text"
                        placeholder="Aclaración (ej: Sin cebolla, bien cocida)"
                        value={item.aclaraciones}
                        onChange={(e) => modificarAclaracion(item.producto.id, e.target.value)}
                        className="flex-1 mr-3 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 placeholder-slate-600 text-xs"
                      />

                      {/* Contador */}
                      <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-xl border border-slate-800">
                        <button
                          onClick={() => modificarCantidad(item.producto.id, -1)}
                          className="text-slate-400 hover:text-white p-1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-white px-1">{item.cantidad}</span>
                        <button
                          onClick={() => modificarCantidad(item.producto.id, 1)}
                          className="text-slate-400 hover:text-white p-1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>Total Estimado:</span>
                  <span className="text-rose-400 font-mono text-lg">{formatCurrency(totalCarrito)}</span>
                </div>
              </div>

              {/* Formulario de Datos del Cliente */}
              <form id="checkout-form" onSubmit={handleEnviarPedido} className="space-y-3 pt-2 border-t border-slate-800">
                <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Tus Datos para la Entrega
                </span>

                {/* Honeypot invisible */}
                <input
                  id={honeypotId}
                  type="text"
                  name="empresa_extra"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Tu Nombre y Apellido *</label>
                    <input
                      type="text"
                      required
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      placeholder="ej: Mariana Gómez"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Tu Teléfono (WhatsApp) *</label>
                    <input
                      type="tel"
                      required
                      value={clienteTelefono}
                      onChange={(e) => setClienteTelefono(e.target.value)}
                      placeholder="ej: 11 4455-6677"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Tipo de entrega */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Modalidad de Entrega *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoEntrega('envio')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        tipoEntrega === 'envio'
                          ? 'bg-rose-950/60 border-rose-600 text-white font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Bike className="w-4 h-4 text-rose-400" />
                      <span>Envío a Domicilio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoEntrega('retiro')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        tipoEntrega === 'retiro'
                          ? 'bg-rose-950/60 border-rose-600 text-white font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Store className="w-4 h-4 text-emerald-400" />
                      <span>Retiro en Local</span>
                    </button>
                  </div>
                </div>

                {tipoEntrega === 'envio' && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Dirección Completa *</label>
                    <input
                      type="text"
                      required
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Calle, número, piso/depto y timbre"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Observaciones Generales</label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="ej: Abono con billete de $20.000, timbre roto, etc."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </form>
            </div>

            {/* Pie del modal con botón de WhatsApp */}
            <div className="p-4 border-t border-slate-800 bg-slate-950">
              {whatsappConfigurado ? (
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={enviandoPedido}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>{enviandoPedido ? 'Generando Pedido...' : 'Enviar Pedido por WhatsApp'}</span>
                </button>
              ) : (
                <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-2xl text-center space-y-1">
                  <span className="text-amber-300 font-bold block text-xs">
                    Este negocio aún no recibe pedidos online
                  </span>
                  <span className="text-[11px] text-amber-400/80 block">
                    El administrador del comercio aún debe configurar su número de WhatsApp.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA / MODAL DE CONFIRMACIÓN DE PEDIDO */}
      {pedidoConfirmado && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-emerald-400 font-bold block">
                ¡Pedido Registrado con Éxito!
              </span>
              <h2 className="text-3xl font-extrabold text-white font-mono mt-1">
                #{pedidoConfirmado.numero_pedido}
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                El pedido ya fue registrado en el sistema. Se abrió una ventana de WhatsApp para que envíes los detalles al local.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={pedidoConfirmado.whatsapp_url}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Reabrir Chat en WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(pedidoConfirmado.mensaje_texto);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiado ? '¡Resumen Copiado al Portapapeles!' : 'Copiar Resumen del Pedido'}</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setPedidoConfirmado(null)}
                className="text-xs text-slate-500 hover:text-white underline cursor-pointer"
              >
                Cerrar y volver al menú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pie de Página con Acceso Oculto al Súper Administrador */}
      <SuperAdminAccessFooter negocioNombre={negocio.nombre} />
    </div>
  );
}
