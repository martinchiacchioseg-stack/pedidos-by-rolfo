'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  UtensilsCrossed,
  ShoppingBag,
  Layers,
  Users,
  Settings,
  LogOut,
  ExternalLink,
  AlertTriangle,
  Lock,
  PhoneCall,
  Menu,
  X,
} from 'lucide-react';
import { Usuario, Negocio } from '@/types/database';
import { calcularDiasRestantes, getEstadoVencimiento } from '@/lib/utils';

export default function BusinessAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('usuarios')
        .select('*, negocio:negocios(*)')
        .eq('id', user.id)
        .single();

      if (!profile || !profile.activo) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      if (profile.must_change_password) {
        router.push('/cambiar-clave');
        return;
      }

      setUsuario(profile as Usuario);
      setNegocio(profile.negocio as Negocio);
      setLoading(false);
    }

    loadSession();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span>Cargando panel de negocio...</span>
        </div>
      </div>
    );
  }

  const diasRestantes = negocio?.fecha_vencimiento ? calcularDiasRestantes(negocio.fecha_vencimiento) : 0;
  const estadoVencimiento = getEstadoVencimiento(diasRestantes);
  const estaVencido = !negocio?.activo || estadoVencimiento === 'vencido';
  const faltaWhatsApp = !negocio?.whatsapp_numero;
  const esAdmin = usuario?.role === 'admin' || usuario?.role === 'superadmin';

  const navItems = [
    { label: 'Pedidos', href: '/admin', icon: ShoppingBag },
    { label: 'Productos & Recetas', href: '/admin/productos', icon: Layers },
    ...(esAdmin ? [{ label: 'Empleados', href: '/admin/empleados', icon: Users }] : []),
    ...(esAdmin ? [{ label: 'Configuración', href: '/admin/configuracion', icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar para Escritorio */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0">
        {/* Cabecera del Negocio */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          {negocio?.logo_url ? (
            <img
              src={negocio.logo_url}
              alt={negocio.nombre}
              className="w-10 h-10 rounded-xl object-cover border border-slate-700"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-white truncate">{negocio?.nombre}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {usuario?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Navegación Principal */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Acceso al Catálogo Público y Estado */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          {negocio && (
            <a
              href={`/n/${negocio.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 hover:border-rose-500 transition-colors group"
            >
              <span className="truncate">/n/{negocio.slug}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400" />
            </a>
          )}

          <div className="text-[11px] text-slate-400">
            <div className="flex justify-between items-center mb-1">
              <span>Suscripción:</span>
              <span className={`font-semibold ${diasRestantes <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {diasRestantes > 0 ? `${diasRestantes} días` : 'Vencida'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-rose-300 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-900/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Cabecera Móvil */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {negocio?.logo_url ? (
            <img src={negocio.logo_url} alt={negocio.nombre} className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs font-bold">
              R
            </div>
          )}
          <span className="font-bold text-sm text-white truncate max-w-[180px]">{negocio?.nombre}</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Menú Móvil Desplegable */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  active ? 'bg-rose-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {negocio && (
            <a
              href={`/n/${negocio.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 text-xs font-mono text-slate-300 bg-slate-950 rounded-xl"
            >
              <span>Ver Catálogo Público</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-rose-300 bg-rose-950/40 rounded-xl"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Banner de ALERTA 1: Negocio Vencido */}
        {estaVencido && (
          <div className="bg-rose-950/90 border-b border-rose-800 p-4 text-rose-200 flex items-center justify-between gap-3 px-6">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-bold">Tu suscripción ha vencido.</span> El catálogo público se encuentra temporalmente deshabilitado para recibir pedidos.
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-rose-800 text-[11px] font-semibold text-white whitespace-nowrap">
              Contactá a Soporte para Renovar
            </span>
          </div>
        )}

        {/* Banner de ALERTA 2: Número de WhatsApp Pendiente */}
        {faltaWhatsApp && !estaVencido && esAdmin && (
          <div className="bg-amber-950/90 border-b border-amber-800 p-4 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div className="text-xs">
                <strong className="font-bold block sm:inline">¡Atención! Número de WhatsApp no configurado: </strong>
                Tus clientes pueden ver tus productos, pero no podrán enviarte pedidos hasta que ingreses tu número.
              </div>
            </div>
            <Link
              href="/admin/configuracion"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs whitespace-nowrap transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Configurar WhatsApp Ahora</span>
            </Link>
          </div>
        )}

        {/* Vista hija */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
