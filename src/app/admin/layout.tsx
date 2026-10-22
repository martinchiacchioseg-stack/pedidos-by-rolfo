'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Bike,
  BarChart3,
  Vault,
  Power,
  BellRing,
  Clock,
} from 'lucide-react';
import { Usuario, Negocio, Pedido } from '@/types/database';
import { calcularDiasRestantes, getEstadoVencimiento } from '@/lib/utils';
import { calcularEstadoApertura } from '@/lib/horarios';

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
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [avisosCadeteriaPendientes, setAvisosCadeteriaPendientes] = useState<number>(0);

  const cargarEstadoNegocioYPendientes = useCallback(async () => {
    try {
      const [resCfg, resPed] = await Promise.all([
        fetch('/api/admin/configuracion'),
        fetch('/api/admin/pedidos'),
      ]);

      if (resCfg.ok) {
        const d = await resCfg.json();
        if (d.negocio) setNegocio(d.negocio);
      }

      if (resPed.ok) {
        const d = await resPed.json();
        const pedidos: Pedido[] = d.pedidos || [];
        const ahora = Date.now();
        const pendientes = pedidos.filter((p) => {
          if (p.tipo_entrega !== 'envio') return false;
          if (p.estado === 'entregado' || p.estado === 'cancelado') return false;
          if (p.cadeteria_avisada_at) return false;
          if (p.estado === 'listo') return true;
          if (p.aviso_programado_at && new Date(p.aviso_programado_at).getTime() <= ahora) {
            return true;
          }
          return false;
        });
        setAvisosCadeteriaPendientes(pendientes.length);
      }
    } catch {
      // Silencioso en refresco de cabecera
    }
  }, []);

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

      if (profile.role === 'cadete') {
        router.push('/cadete');
        return;
      }

      setUsuario(profile as Usuario);
      setNegocio(profile.negocio as Negocio);
      setLoading(false);
      cargarEstadoNegocioYPendientes();
    }

    loadSession();
  }, [router, cargarEstadoNegocioYPendientes]);

  // Refresco periódico de alertas pendientes de cadetería cada 25 segundos
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(cargarEstadoNegocioYPendientes, 25000);
    return () => clearInterval(interval);
  }, [loading, cargarEstadoNegocioYPendientes]);

  const handleToggleAbiertoManual = async () => {
    if (!negocio || togglingOpen) return;
    setTogglingOpen(true);
    try {
      const nuevoEstado = !(negocio.abierto_manual ?? true);
      const res = await fetch('/api/admin/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abierto_manual: nuevoEstado }),
      });
      if (res.ok) {
        const data = await res.json();
        setNegocio(data.negocio);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingOpen(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090b10] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Cargando consola de gestión...</span>
        </div>
      </div>
    );
  }

  const diasRestantes = negocio?.fecha_vencimiento
    ? calcularDiasRestantes(negocio.fecha_vencimiento)
    : 0;
  const estadoVencimiento = getEstadoVencimiento(diasRestantes);
  const estaVencido = !negocio?.activo || estadoVencimiento === 'vencido';
  const faltaWhatsApp = !negocio?.whatsapp_numero;
  const esAdmin = usuario?.role === 'admin' || usuario?.role === 'superadmin';

  const estadoApertura = negocio ? calcularEstadoApertura(negocio) : { abierto: true, proximoHorarioTexto: '' };
  const abiertoEfectivo = estadoApertura.abierto;

  const navItems = [
    { label: 'Pedidos & Mostrador', href: '/admin', icon: ShoppingBag },
    { label: 'Productos & Carta', href: '/admin/productos', icon: Layers },
    ...(esAdmin
      ? [
          { label: 'Cadetería & Envíos', href: '/admin/cadeteria', icon: Bike },
          { label: 'Reporte de Ventas', href: '/admin/reportes', icon: BarChart3 },
          { label: 'Cierre de Caja', href: '/admin/caja', icon: Vault },
          { label: 'Equipo & Roles', href: '/admin/empleados', icon: Users },
          { label: 'Configuración & Marca', href: '/admin/configuracion', icon: Settings },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar de Escritorio */}
      <aside className="hidden md:flex flex-col w-64 bg-[#11151f] border-r border-white/[0.07] shrink-0">
        <div className="p-5 border-b border-white/[0.07] flex items-center gap-3">
          {negocio?.logo_url ? (
            <img
              src={negocio.logo_url}
              alt={negocio.nombre}
              className="w-10 h-10 rounded-xl object-cover border border-white/15"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-sm font-bold text-white truncate">{negocio?.nombre}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                {usuario?.role}
              </span>
              <span className="text-[11px] text-slate-500 truncate">{usuario?.nombre}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.href === '/admin' && avisosCadeteriaPendientes > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950">
                    {avisosCadeteriaPendientes}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.07] space-y-3">
          {negocio && (
            <a
              href={`/n/${negocio.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#090b10] border border-white/10 text-xs font-mono text-slate-300 hover:border-rose-500/50 transition-colors group"
            >
              <span className="truncate">/n/{negocio.slug}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400" />
            </a>
          )}

          <div className="flex justify-between items-center text-[11px] text-slate-400 px-1">
            <span>Validez del plan:</span>
            <span
              className={`font-mono font-semibold ${
                diasRestantes <= 7 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {diasRestantes > 0 ? `${diasRestantes} días` : 'Vencido'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ENCABEZADO SUPERIOR CON INTERRUPTOR DE UN TOQUE ABIERTO/CERRADO Y AVISOS DE CADETERÍA */}
        <header className="sticky top-0 z-30 bg-[#11151f]/90 backdrop-blur-xl border-b border-white/[0.07] px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-white/5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Modo:{' '}
                <strong className="text-slate-200">
                  {negocio?.modo_apertura === 'automatico'
                    ? 'Automático por horarios'
                    : 'Manual'}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Contador de Avisos pendientes de cadetería (Sección H.2) */}
            {avisosCadeteriaPendientes > 0 && (
              <Link
                href="/admin?filtro=avisos_cadeteria"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-semibold transition-all"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span className="hidden sm:inline">Avisos cadetería:</span>
                <span className="font-mono font-bold bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[11px]">
                  {avisosCadeteriaPendientes}
                </span>
              </Link>
            )}

            {/* INTERRUPTOR DE UN SOLO TOQUE ABIERTO / CERRADO (Sección A) */}
            <button
              type="button"
              onClick={handleToggleAbiertoManual}
              disabled={togglingOpen}
              title="Tocá para abrir o cerrar la recepción de pedidos en el catálogo público"
              className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                abiertoEfectivo
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  abiertoEfectivo ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span>{abiertoEfectivo ? 'Local Abierto' : 'Local Cerrado'}</span>
              <Power className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </header>

        {/* Menú Móvil Desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#11151f] border-b border-white/10 p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                    active ? 'bg-rose-600 text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
            {negocio && (
              <a
                href={`/n/${negocio.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3.5 py-2.5 text-xs font-mono text-slate-300 bg-[#090b10] rounded-xl border border-white/10"
              >
                <span>Ver Catálogo Público</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-rose-300 bg-rose-500/15 rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}

        {/* Banner de Negocio Vencido */}
        {estaVencido && (
          <div className="bg-rose-950/90 border-b border-rose-800 p-3.5 text-rose-200 flex items-center justify-between gap-3 px-6">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold">Suscripción vencida.</span> El catálogo público no permite enviar pedidos hasta renovar el plan.
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-rose-800 text-[11px] font-semibold text-white whitespace-nowrap">
              Contactar Administración Central
            </span>
          </div>
        )}

        {/* Banner de WhatsApp Pendiente */}
        {faltaWhatsApp && !estaVencido && esAdmin && (
          <div className="bg-amber-950/90 border-b border-amber-800 p-3.5 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <strong className="font-bold">Número de WhatsApp pendiente: </strong>
                Configuralo para habilitar el botón de pedido online en tu carta digital.
              </div>
            </div>
            <Link
              href="/admin/configuracion"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs whitespace-nowrap transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Configurar WhatsApp</span>
            </Link>
          </div>
        )}

        {/* Contenido de la sección */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
