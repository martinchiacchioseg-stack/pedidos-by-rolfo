import Link from 'next/link';
import {
  UtensilsCrossed,
  MessageCircle,
  TrendingUp,
  ShieldCheck,
  Smartphone,
  Layers,
  ArrowRight,
  Store,
  CheckCircle2,
} from 'lucide-react';
import { SuperAdminAccessFooter } from '@/components/shared/SuperAdminAccessFooter';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Barra de Navegación */}
      <nav className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">
              Pedidos by <span className="text-rose-500 font-mono">ROLΦ</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
            >
              Acceso a mi Negocio
            </Link>
            <Link
              href="/n/rolfo-pizzas-burgers"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
            >
              <span>Ver Menú Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          Plataforma Multinegocio de Menú Digital & Checkout por WhatsApp
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
          Tus pedidos gastronómicos, directo a tu <span className="text-emerald-400">WhatsApp</span> sin comisiones.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Un catálogo digital mobile-first para tus clientes, control de recetas, costos de ingredientes, margen de ganancia comercial y gestión de pedidos en tiempo real para tu negocio.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/n/rolfo-pizzas-burgers"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>Explorar Demo (ROLΦ Pizzas & Burgers)</span>
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Ingresar al Panel Administrativo</span>
          </Link>
        </div>
      </section>

      {/* Características Destacadas */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Pedidos Directos por WhatsApp</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              El cliente elige, agrega notas a cada producto y el sistema le redacta automáticamente un mensaje claro con el número de pedido listo para enviar.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Costos & Márgenes de Ganancia</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cargá tus recetas e ingredientes con sus costos. El sistema calcula en vivo el costo de elaboración y el margen de ganancia de cada plato.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Arquitectura Multinegocio Segura</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Aislamiento total con Row Level Security (RLS) en PostgreSQL. Roles de administrador y vendedor, backup de datos descargable y control de suscripción.
            </p>
          </div>
        </div>
      </section>

      {/* Pie de Página con Acceso Oculto al Súper Administrador */}
      <SuperAdminAccessFooter />
    </div>
  );
}
