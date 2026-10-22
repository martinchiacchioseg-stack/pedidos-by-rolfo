import Link from 'next/link';
import {
  UtensilsCrossed,
  MessageCircle,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Store,
  Navigation,
  Receipt,
  CalendarClock,
} from 'lucide-react';
import { SuperAdminAccessFooter } from '@/components/shared/SuperAdminAccessFooter';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white relative overflow-hidden">
      {/* Resplandor ambiental */}
      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[780px] h-[360px] bg-rose-600/12 blur-[140px] pointer-events-none rounded-full" />

      {/* Navegación superior */}
      <nav className="border-b border-white/[0.07] bg-[#090b10]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="font-heading font-extrabold text-lg tracking-tight text-white">
              Pedidos by <span className="text-rose-500 font-mono">ROLΦ</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-[#171c29] hover:bg-[#1e2434] border border-white/10 transition-colors"
            >
              Ingresar al Panel
            </Link>
            <Link
              href="/n/rolfo-pizzas-burgers"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
            >
              <span>Ver Carta Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Sistema Integral Multinegocio • Menú Digital, Cadetería GPS y Caja
        </div>

        <h1 className="font-heading text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
          Tu marca gastronómica con pedidos directos a <span className="text-emerald-400">WhatsApp</span> y gestión total.
        </h1>

        <p className="mt-6 text-sm sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Catálogo con identidad propia, apertura automática por horarios de doble franja, carga de pedidos manuales, app exclusiva para cadetes con registro GPS al entregar, reportes de ventas y cierre de caja diario.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/n/rolfo-pizzas-burgers"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/25 transition-all flex items-center justify-center gap-2.5"
          >
            <Store className="w-4 h-4" />
            <span>Explorar Demo (ROLΦ Pizzas & Burgers)</span>
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#11151f] hover:bg-[#171c29] border border-white/10 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <span>Acceso Administradores y Cadetes</span>
          </Link>
        </div>
      </section>

      {/* Pilares del Sistema */}
      <section className="py-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-[#11151f]/90 border border-white/[0.08] p-7 rounded-3xl space-y-3.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.35)]">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-base font-bold text-white">
              Pedidos Online, Manuales y Avisos WhatsApp
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recibí pedidos desde el catálogo web o cargalos en mostrador/teléfono. Avisá al cliente con un toque cuando su pedido está listo o en camino con plantillas editables.
            </p>
          </div>

          <div className="bg-[#11151f]/90 border border-white/[0.08] p-7 rounded-3xl space-y-3.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.35)]">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/12 border border-sky-500/25 text-sky-400 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-base font-bold text-white">
              Cadetería Propia (PWA + GPS) y Externa
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Asigná envíos a empresas externas por WhatsApp o a tus propios cadetes con su app móvil exclusiva, alertas en vivo y captura de ubicación GPS al entregar.
            </p>
          </div>

          <div className="bg-[#11151f]/90 border border-white/[0.08] p-7 rounded-3xl space-y-3.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.35)]">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/12 border border-amber-500/25 text-amber-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-base font-bold text-white">
              Ventas Automáticas, Reportes y Caja
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cada pedido entregado se transforma en venta automáticamente. Consultá métricas por medio de pago, ganancia estimada según recetas y realizá el cierre de caja diario.
            </p>
          </div>

          <div className="bg-[#11151f]/90 border border-white/[0.08] p-7 rounded-3xl space-y-3.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.35)]">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/12 border border-purple-500/25 text-purple-400 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-base font-bold text-white">
              Apertura Manual o Automática por Franjas
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configurá hasta dos turnos por día (mediodía y noche) o usá el interruptor rápido de un toque en el encabezado para abrir o pausar la recepción de pedidos.
            </p>
          </div>

          <div className="bg-[#11151f]/90 border border-white/[0.08] p-7 rounded-3xl space-y-3.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.35)]">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/12 border border-rose-500/25 text-rose-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-base font-bold text-white">
              Identidad de Marca por Comercio
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Combinaciones tipográficas curadas, paleta de colores personalizada, estilo de bordes y tema claro u oscuro para que cada local luzca como una marca única.
            </p>
          </div>

          <div className="bg-[#11151f]/90 border border-white/[0.08] p-7 rounded-3xl space-y-3.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.35)]">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-base font-bold text-white">
              Aislamiento Multi-Inquilino y Backups
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Seguridad Row Level Security en PostgreSQL por negocio, roles diferenciados (Admin, Vendedor, Cadete) y exportación/restauración íntegra en JSON.
            </p>
          </div>
        </div>
      </section>

      <SuperAdminAccessFooter />
    </div>
  );
}
