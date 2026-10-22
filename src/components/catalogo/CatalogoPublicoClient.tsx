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
  MapPin,
  Search,
  CalendarClock,
  Lock,
} from 'lucide-react';
import { Negocio, Categoria, Producto, TipoEntrega, MedioPago } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { getFontStylesForNegocio } from '@/lib/fonts';
import { DIAS_SEMANA_ORDEN, HORARIOS_SEMANALES_DEFAULT } from '@/lib/horarios';
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

  // Carrito y modales
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [modalHorarios, setModalHorarios] = useState(false);

  // Buscador y categorías
  const [categoriaActiva, setCategoriaActiva] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');

  // Datos del cliente en Checkout
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('envio');
  const [direccion, setDireccion] = useState('');
  const [referenciasDireccion, setReferenciasDireccion] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [observaciones, setObservaciones] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Confirmación
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{
    numero_pedido: number;
    whatsapp_url: string;
    mensaje_texto: string;
    total: number;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const honeypotId = useId();

  useEffect(() => {
    async function loadCatalogo() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/negocio/${slug}`);
        if (!res.ok) {
          throw new Error('No se pudo encontrar el menú del comercio solicitado.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar el catálogo');
      } finally {
        setLoading(false);
      }
    }

    loadCatalogo();
  }, [slug]);

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
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
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

  const handleEnviarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (carrito.length === 0) {
      setCheckoutError('El carrito se encuentra vacío.');
      return;
    }

    if (tipoEntrega === 'envio' && !direccion.trim()) {
      setCheckoutError('Por favor ingresá la dirección de entrega.');
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
        referencias_direccion: tipoEntrega === 'envio' ? referenciasDireccion : null,
        medio_pago: medioPago,
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

      setPedidoConfirmado({
        numero_pedido: responseData.numero_pedido,
        whatsapp_url: responseData.whatsapp_url,
        mensaje_texto: responseData.mensaje_texto,
        total: responseData.total,
      });

      window.open(responseData.whatsapp_url, '_blank', 'noopener,noreferrer');

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
      <div className="min-h-screen bg-[#090b10] flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-medium tracking-wide">Cargando carta digital...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#090b10] flex flex-col justify-between text-slate-100">
        <div className="max-w-md mx-auto my-auto p-8 text-center">
          <UtensilsCrossed className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="font-heading text-lg font-bold text-white">Comercio no encontrado</h2>
          <p className="text-xs text-slate-400 mt-1">
            {error || 'El menú digital solicitado no existe.'}
          </p>
        </div>
        <SuperAdminAccessFooter />
      </div>
    );
  }

  const { negocio, categorias, productos, servicio_no_disponible } = data;
  const colorPrimario = negocio.color_primario || '#E11D48';
  const colorSecundario = negocio.color_secundario || '#0F172A';
  const fontStyles = getFontStylesForNegocio(negocio.tipografia_id);
  const esTemaClaro = negocio.tema_catalogo === 'claro';

  const whatsappConfigurado = Boolean(negocio.whatsapp_numero);
  const estaAbierto = negocio.abierto_efectivo !== false;
  const proximoHorario = negocio.proximo_horario_texto || 'Consultá nuestros horarios';
  const horariosSemanales = negocio.horarios_semanales || HORARIOS_SEMANALES_DEFAULT;

  // Determinar si el botón de enviar pedido debe bloquearse y por qué motivo
  const puedeRecibirPedidos = !servicio_no_disponible && whatsappConfigurado && estaAbierto;
  let motivoBloqueoPedido = '';
  if (servicio_no_disponible) {
    motivoBloqueoPedido = 'El plan de este comercio se encuentra vencido o inactivo.';
  } else if (!whatsappConfigurado) {
    motivoBloqueoPedido = 'Este negocio aún no recibe pedidos online por WhatsApp.';
  } else if (!estaAbierto) {
    motivoBloqueoPedido = `Cerrado ahora. ${proximoHorario}.`;
  }

  const radiusClass =
    negocio.estilo_bordes === 'recto'
      ? 'rounded-xl'
      : negocio.estilo_bordes === 'redondeado'
      ? 'rounded-3xl'
      : 'rounded-2xl';

  // Si el plan está vencido y no tiene productos cargados o está pausado, igual cumplimos:
  // si está vencido mostramos aviso claro y deshabilitamos envío
  const productosFiltrados = productos.filter((p) => {
    const matchCat = categoriaActiva === 'todas' ? true : p.categoria_id === categoriaActiva;
    const matchQ =
      !busqueda.trim() ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase()));
    return matchCat && matchQ;
  });

  return (
    <div
      style={fontStyles}
      className={`min-h-screen flex flex-col brand-body transition-colors ${
        esTemaClaro ? 'bg-slate-50 text-slate-900' : 'bg-[#090b10] text-slate-100'
      }`}
    >
      {/* AVISO SUPERIOR SI EL PLAN ESTÁ VENCIDO */}
      {servicio_no_disponible && (
        <div className="bg-rose-950 border-b border-rose-800/80 px-4 py-3 text-center">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-xs text-rose-200 font-medium">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Servicio temporalmente no disponible para pedidos online. Si sos el administrador, renová tu suscripción.
            </span>
          </div>
        </div>
      )}

      {/* CARTEL DESTACADO CUANDO EL NEGOCIO ESTÁ CERRADO (Sección A) */}
      {!servicio_no_disponible && !estaAbierto && (
        <div className="bg-amber-500/12 border-b border-amber-500/25 px-4 py-3">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 text-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="font-semibold">Cerrado ahora</span>
              <span className="text-amber-300/80">•</span>
              <span className="text-amber-100">{proximoHorario}</span>
            </div>
            <button
              type="button"
              onClick={() => setModalHorarios(true)}
              className="text-[11px] font-semibold text-amber-300 hover:text-amber-100 underline cursor-pointer"
            >
              Ver todos los horarios
            </button>
          </div>
        </div>
      )}

      {/* CABECERA / PORTADA DE MARCA DEL NEGOCIO */}
      <header
        style={{
          background: esTemaClaro
            ? `linear-gradient(180deg, ${colorSecundario}12 0%, transparent 100%)`
            : `radial-gradient(circle at 50% 0%, ${colorPrimario}22 0%, #090b10 75%)`,
        }}
        className={`relative border-b pb-7 pt-8 px-4 sm:px-6 ${
          esTemaClaro ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-[#11151f]/70'
        }`}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {negocio.logo_url ? (
            <img
              src={negocio.logo_url}
              alt={negocio.nombre}
              className={`w-24 h-24 sm:w-28 sm:h-28 ${radiusClass} object-cover border border-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.45)] shrink-0`}
            />
          ) : (
            <div
              style={{ backgroundColor: colorPrimario }}
              className={`w-24 h-24 sm:w-28 sm:h-28 ${radiusClass} text-white flex items-center justify-center font-bold text-3xl shadow-xl shrink-0 brand-heading`}
            >
              {negocio.nombre.charAt(0)}
            </div>
          )}

          <div className="space-y-2.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              {/* Indicador Abierto / Cerrado */}
              {estaAbierto && !servicio_no_disponible ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Abierto ahora
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  <Lock className="w-3 h-3" />
                  Cerrado ahora
                </span>
              )}

              {negocio.tiempo_preparacion_min && estaAbierto && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                    esTemaClaro
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-white/5 text-slate-300 border-white/10'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Prep. aprox. {negocio.tiempo_preparacion_min} min
                </span>
              )}
            </div>

            <h1
              className={`brand-heading text-2xl sm:text-4xl font-extrabold tracking-tight ${
                esTemaClaro ? 'text-slate-900' : 'text-white'
              }`}
            >
              {negocio.nombre}
            </h1>

            {negocio.slogan && (
              <p
                style={{ color: colorPrimario }}
                className="text-xs sm:text-sm font-semibold tracking-wide"
              >
                {negocio.slogan}
              </p>
            )}

            {negocio.mensaje_bienvenida && (
              <p
                className={`text-xs sm:text-sm max-w-2xl leading-relaxed ${
                  esTemaClaro ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {negocio.mensaje_bienvenida}
              </p>
            )}

            {/* Píldoras de información comercial */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1 text-xs">
              <button
                type="button"
                onClick={() => setModalHorarios(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                  esTemaClaro
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-[#090b10]/80 hover:bg-white/10 text-slate-300 border-white/10'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                <span>{proximoHorario}</span>
                <span className="text-[10px] underline ml-1 opacity-75">Horarios</span>
              </button>

              {negocio.direccion_local && (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    esTemaClaro
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-[#090b10]/80 text-slate-300 border-white/10'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{negocio.direccion_local}</span>
                </div>
              )}

              {negocio.telefono && (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    esTemaClaro
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-[#090b10]/80 text-slate-300 border-white/10'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{negocio.telefono}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* BARRA DE NAVEGACIÓN DE CATEGORÍAS Y BUSCADOR */}
      <div
        className={`sticky top-0 z-30 backdrop-blur-xl border-b px-4 py-3 ${
          esTemaClaro
            ? 'bg-white/90 border-slate-200'
            : 'bg-[#090b10]/85 border-white/[0.08]'
        }`}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            <button
              onClick={() => setCategoriaActiva('todas')}
              style={categoriaActiva === 'todas' ? { backgroundColor: colorPrimario } : {}}
              className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap cursor-pointer ${
                categoriaActiva === 'todas'
                  ? 'text-white shadow-md'
                  : esTemaClaro
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-[#11151f] text-slate-300 hover:bg-[#171c29] border border-white/[0.07]'
              }`}
            >
              Menú Completo ({productos.length})
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
                      : esTemaClaro
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-[#11151f] text-slate-300 hover:bg-[#171c29] border border-white/[0.07]'
                  }`}
                >
                  {cat.nombre} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative sm:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el menú..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-full text-xs border focus:outline-none ${
                esTemaClaro
                  ? 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400'
                  : 'bg-[#11151f] border-white/10 text-white placeholder-slate-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* GRILLA DE PRODUCTOS */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-32">
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No encontramos platos con ese criterio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {productosFiltrados.map((prod) => {
              const cantidadEnCarrito =
                carrito.find((item) => item.producto.id === prod.id)?.cantidad || 0;

              return (
                <div
                  key={prod.id}
                  className={`${radiusClass} p-4 flex flex-col justify-between border transition-all duration-200 group ${
                    esTemaClaro
                      ? 'bg-white border-slate-200/90 shadow-sm hover:shadow-md'
                      : 'bg-[#11151f]/90 border-white/[0.08] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)] hover:border-white/15'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <h3
                        className={`brand-heading font-bold text-base leading-snug ${
                          esTemaClaro ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {prod.nombre}
                      </h3>
                      {prod.descripcion && (
                        <p
                          className={`text-xs line-clamp-3 leading-relaxed ${
                            esTemaClaro ? 'text-slate-600' : 'text-slate-400'
                          }`}
                        >
                          {prod.descripcion}
                        </p>
                      )}
                      <div
                        className={`text-base font-extrabold font-mono pt-1.5 ${
                          esTemaClaro ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {formatCurrency(prod.precio_venta)}
                      </div>
                    </div>

                    {prod.imagen_url && (
                      <img
                        src={prod.imagen_url}
                        alt={prod.nombre}
                        className={`w-24 h-24 sm:w-28 sm:h-28 ${radiusClass} object-cover border border-white/10 shrink-0`}
                      />
                    )}
                  </div>

                  {/* Controles de cantidad */}
                  <div
                    className={`mt-4 pt-3 border-t flex items-center justify-between ${
                      esTemaClaro ? 'border-slate-100' : 'border-white/[0.06]'
                    }`}
                  >
                    <span className="text-[11px] text-slate-500">
                      {cantidadEnCarrito > 0
                        ? `${cantidadEnCarrito} en tu pedido`
                        : 'Preparación en el momento'}
                    </span>

                    {cantidadEnCarrito > 0 ? (
                      <div
                        className={`flex items-center gap-2 px-2 py-1 rounded-xl border ${
                          esTemaClaro
                            ? 'bg-slate-100 border-slate-200'
                            : 'bg-[#090b10] border-white/10'
                        }`}
                      >
                        <button
                          onClick={() => modificarCantidad(prod.id, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-xs px-2">
                          {cantidadEnCarrito}
                        </span>
                        <button
                          onClick={() => modificarCantidad(prod.id, 1)}
                          style={{ backgroundColor: colorPrimario }}
                          className="w-7 h-7 rounded-lg text-white flex items-center justify-center cursor-pointer hover:opacity-90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => agregarAlCarrito(prod)}
                        style={{ backgroundColor: colorPrimario }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md hover:opacity-95 transition-all cursor-pointer"
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

      {/* BARRA FLOTANTE DEL CARRITO */}
      {cantidadItemsTotal > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40">
          <button
            onClick={() => setCarritoAbierto(true)}
            style={{ backgroundColor: colorPrimario }}
            className="w-full py-4 px-6 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.55)] flex items-center justify-between text-white font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-black/25 flex items-center justify-center text-xs font-mono font-bold">
                {cantidadItemsTotal}
              </div>
              <span className="text-sm font-bold tracking-tight">Revisar mi pedido</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold">
                {formatCurrency(totalCarrito)}
              </span>
              <ChevronRight className="w-5 h-5 opacity-80" />
            </div>
          </button>
        </div>
      )}

      {/* MODAL HORARIOS SEMANALES (Doble franja) */}
      {modalHorarios && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#11151f] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="w-5 h-5 text-amber-400" />
                <h3 className="font-heading font-bold text-base text-white">
                  Horarios de Atención
                </h3>
              </div>
              <button
                onClick={() => setModalHorarios(false)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              {DIAS_SEMANA_ORDEN.map((d) => {
                const info = horariosSemanales[d.key];
                return (
                  <div
                    key={d.key}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#090b10]/70 border border-white/[0.06]"
                  >
                    <span className="font-semibold text-slate-200">{d.label}</span>
                    {info?.activo && info.franjas?.length > 0 ? (
                      <div className="text-right font-mono text-slate-300 space-x-2">
                        {info.franjas.map((f, i) => (
                          <span
                            key={i}
                            className="inline-block bg-white/5 px-2 py-0.5 rounded border border-white/10"
                          >
                            {f.apertura} - {f.cierre}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setModalHorarios(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER DE CHECKOUT */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#11151f] border border-white/10 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-rose-500" />
                <h3 className="font-heading font-bold text-white text-base">
                  Finalizar Pedido
                </h3>
              </div>
              <button
                onClick={() => setCarritoAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              {checkoutError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/12 border border-rose-500/25 text-rose-200 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Lista de ítems */}
              <div className="space-y-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Detalle de Productos
                </span>
                {carrito.map((item) => (
                  <div
                    key={item.producto.id}
                    className="p-3.5 bg-[#090b10] rounded-2xl border border-white/[0.08] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">
                        {item.producto.nombre}
                      </span>
                      <span className="font-mono text-white font-bold">
                        {formatCurrency(item.producto.precio_venta * item.cantidad)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Aclaración (ej: Sin cebolla)"
                        value={item.aclaraciones}
                        onChange={(e) => modificarAclaracion(item.producto.id, e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#11151f] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 text-xs"
                      />

                      <div className="flex items-center gap-1.5 bg-[#11151f] px-2 py-1 rounded-xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => modificarCantidad(item.producto.id, -1)}
                          className="text-slate-400 hover:text-white p-1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-white px-1">
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => modificarCantidad(item.producto.id, 1)}
                          className="text-slate-400 hover:text-white p-1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center text-sm font-bold text-white pt-2 border-t border-white/10">
                  <span>Total a Pagar:</span>
                  <span className="text-rose-400 font-mono text-lg">
                    {formatCurrency(totalCarrito)}
                  </span>
                </div>
              </div>

              {/* Formulario de Entrega y Pago */}
              <form
                id="checkout-form"
                onSubmit={handleEnviarPedido}
                className="space-y-4 pt-3 border-t border-white/10"
              >
                <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Datos de Entrega y Pago
                </span>

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
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      placeholder="Ej: Mariana Gómez"
                      className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Teléfono (WhatsApp) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={clienteTelefono}
                      onChange={(e) => setClienteTelefono(e.target.value)}
                      placeholder="Ej: 11 4455-6677"
                      className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Modalidad de Entrega */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Modalidad de Entrega *
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTipoEntrega('envio')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        tipoEntrega === 'envio'
                          ? 'bg-rose-500/15 border-rose-500 text-white font-bold'
                          : 'bg-[#090b10] border-white/10 text-slate-400'
                      }`}
                    >
                      <Bike className="w-4 h-4 text-rose-400" />
                      <span>Envío a Domicilio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoEntrega('retiro')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        tipoEntrega === 'retiro'
                          ? 'bg-rose-500/15 border-rose-500 text-white font-bold'
                          : 'bg-[#090b10] border-white/10 text-slate-400'
                      }`}
                    >
                      <Store className="w-4 h-4 text-emerald-400" />
                      <span>Retiro en el Local</span>
                    </button>
                  </div>
                </div>

                {tipoEntrega === 'envio' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Calle y Número *
                      </label>
                      <input
                        type="text"
                        required
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                        placeholder="Ej: Av. Libertador 4520"
                        className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Piso, Depto o Referencias
                      </label>
                      <input
                        type="text"
                        value={referenciasDireccion}
                        onChange={(e) => setReferenciasDireccion(e.target.value)}
                        placeholder="Ej: Piso 4 B, portón negro"
                        className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Medio de Pago Preferido */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Medio de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'efectivo', label: 'Efectivo' },
                      { id: 'transferencia', label: 'Transferencia' },
                      { id: 'mercadopago', label: 'MercadoPago' },
                    ].map((mp) => (
                      <button
                        key={mp.id}
                        type="button"
                        onClick={() => setMedioPago(mp.id as MedioPago)}
                        className={`py-2 px-3 rounded-xl border text-center font-medium cursor-pointer transition-all ${
                          medioPago === mp.id
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-[#090b10] border-white/10 text-slate-400'
                        }`}
                      >
                        {mp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Observaciones Generales
                  </label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Ej: Abono con $20.000, timbre no funciona, etc."
                    className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
              </form>
            </div>

            {/* Pie del modal: Enviar por WhatsApp o bloqueo explicado */}
            <div className="p-4 border-t border-white/10 bg-[#090b10]">
              {puedeRecibirPedidos ? (
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={enviandoPedido}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>
                    {enviandoPedido ? 'Registrando Pedido...' : 'Enviar pedido por WhatsApp'}
                  </span>
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 px-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-75"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Envío de pedidos deshabilitado</span>
                  </button>
                  <p className="text-[11px] text-amber-300 text-center font-medium">
                    {motivoBloqueoPedido}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE PEDIDO */}
      {pedidoConfirmado && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#11151f] border border-white/10 rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl text-slate-100">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-emerald-400 font-bold block">
                Pedido Registrado
              </span>
              <h2 className="font-heading text-3xl font-extrabold text-white font-mono mt-1">
                #{pedidoConfirmado.numero_pedido}
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {negocio.mensaje_cierre ||
                  'Tu pedido fue guardado. Confirmá el envío del mensaje en la ventana de WhatsApp para finalizar.'}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <a
                href={pedidoConfirmado.whatsapp_url}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Reabrir WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(pedidoConfirmado.mensaje_texto);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#171c29] hover:bg-[#1e2434] border border-white/10 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiado ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copiado ? 'Resumen copiado' : 'Copiar resumen del pedido'}</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setPedidoConfirmado(null)}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Volver al menú
              </button>
            </div>
          </div>
        </div>
      )}

      <SuperAdminAccessFooter negocioNombre={negocio.nombre} />
    </div>
  );
}
