'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import {
  Store,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  ExternalLink,
  KeyRound,
  Database,
  Trash2,
  Copy,
  Check,
  Search,
  Layers,
  Wrench,
  Download,
  Upload,
  Lock,
} from 'lucide-react';
import { Plan, Negocio, Usuario } from '@/types/database';
import { formatCurrency, formatShortDate, slugify } from '@/lib/utils';

interface NegocioEnriquecido extends Negocio {
  plan?: Plan;
  admin_user?: Usuario;
  dias_restantes: number;
  estado_vencimiento: 'vigente' | 'por_vencer' | 'vencido';
}

export default function SuperAdminDashboard() {
  const [negocios, setNegocios] = useState<NegocioEnriquecido[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'vigente' | 'por_vencer' | 'vencido'>('todos');

  // Modales
  const [modalNuevoNegocio, setModalNuevoNegocio] = useState(false);
  const [modalPlanes, setModalPlanes] = useState(false);
  const [modalExtender, setModalExtender] = useState<NegocioEnriquecido | null>(null);
  const [modalResetPass, setModalResetPass] = useState<NegocioEnriquecido | null>(null);
  const [modalMantenimiento, setModalMantenimiento] = useState<NegocioEnriquecido | null>(null);
  const [modalEliminar, setModalEliminar] = useState<NegocioEnriquecido | null>(null);

  // Estados de formularios
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoSlug, setNuevoSlug] = useState('');
  const [nuevoLogo, setNuevoLogo] = useState('');
  const [nuevoPlanId, setNuevoPlanId] = useState('');
  const [nuevoAdminEmail, setNuevoAdminEmail] = useState('');
  const [nuevoAdminNombre, setNuevoAdminNombre] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('Admin@' + Math.floor(1000 + Math.random() * 9000));
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estado para visualización de contraseña reseteada
  const [claveGenerada, setClaveGenerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Estados de mantenimiento & backup
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<{
    version?: string;
    fecha_exportacion?: string;
    negocio_origen?: string;
    resumen?: { categorias: number; productos: number; ingredientes: number; pedidos: number };
  } | null>(null);
  const [mantenimientoStatus, setMantenimientoStatus] = useState<string | null>(null);

  const fileInputId = useId();

  // Cargar Negocios y Planes
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resNeg, resPlanes] = await Promise.all([
        fetch('/api/superadmin/negocios'),
        fetch('/api/superadmin/planes'),
      ]);

      if (resNeg.ok) {
        const data = await resNeg.json();
        setNegocios(data.negocios || []);
      }
      if (resPlanes.ok) {
        const data = await resPlanes.json();
        setPlanes(data.planes || []);
      }
    } catch (err) {
      console.error('Error al cargar datos de súper admin:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manejar creación de negocio
  const handleCrearNegocio = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch('/api/superadmin/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoNombre,
          slug: nuevoSlug || slugify(nuevoNombre),
          logo_url: nuevoLogo || null,
          plan_id: nuevoPlanId || (planes[0]?.id || null),
          admin_email: nuevoAdminEmail,
          admin_nombre: nuevoAdminNombre,
          password_momentanea: nuevoPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear negocio');

      // Limpiar formulario y cerrar modal
      setModalNuevoNegocio(false);
      setNuevoNombre('');
      setNuevoSlug('');
      setNuevoLogo('');
      setNuevoAdminEmail('');
      setNuevoAdminNombre('');
      setNuevoPassword('Admin@' + Math.floor(1000 + Math.random() * 9000));
      fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Manejar extensión de vencimiento
  const handleExtenderVencimiento = async (negocioId: string, dias: number) => {
    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias_a_extender: dias }),
      });
      if (res.ok) {
        setModalExtender(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Manejar reseteo de contraseña
  const handleResetPassword = async (negocioId: string, userId?: string) => {
    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/negocios/${negocioId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaveGenerada(data.password_momentanea);
      } else {
        alert(data.error || 'Error al resetear contraseña');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Manejar exportación de backup
  const handleDescargarBackup = (negocio: NegocioEnriquecido) => {
    window.open(`/api/superadmin/negocios/${negocio.id}/backup`, '_blank');
  };

  // Manejar carga de archivo de backup para previsualización
  const handleArchivoBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        setBackupFileContent(text);
        const parsed = JSON.parse(text);

        // Previsualizar
        const res = await fetch(`/api/superadmin/negocios/${modalMantenimiento?.id}/backup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup: parsed, modo: 'preview' }),
        });
        const data = await res.json();
        if (res.ok) {
          setBackupPreview(data);
        } else {
          alert(data.error || 'Formato de archivo inválido');
        }
      } catch (err) {
        alert('El archivo seleccionado no es un JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  // Confirmar restauración
  const handleEjecutarRestauracion = async () => {
    if (!backupFileContent || !modalMantenimiento) return;
    setFormSubmitting(true);
    try {
      const parsed = JSON.parse(backupFileContent);
      const res = await fetch(`/api/superadmin/negocios/${modalMantenimiento.id}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: parsed, modo: 'restore' }),
      });
      const data = await res.json();
      if (res.ok) {
        setMantenimientoStatus('¡Restauración completada con éxito!');
        setBackupFileContent(null);
        setBackupPreview(null);
        fetchData();
      } else {
        alert(data.error || 'Error al restaurar');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Ejecutar acción de mantenimiento
  const handleAccionMantenimiento = async (accion: string) => {
    if (!modalMantenimiento) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/negocios/${modalMantenimiento.id}/mantenimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json();
      if (res.ok) {
        setMantenimientoStatus(data.mensaje);
        fetchData();
      } else {
        alert(data.error || 'Error en acción de mantenimiento');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Manejar eliminación de negocio
  const handleEliminarNegocio = async () => {
    if (!modalEliminar) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/negocios/${modalEliminar.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setModalEliminar(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Métricas
  const totalNegocios = negocios.length;
  const activosVigentes = negocios.filter((n) => n.activo && n.estado_vencimiento === 'vigente').length;
  const porVencer = negocios.filter((n) => n.activo && n.estado_vencimiento === 'por_vencer').length;
  const vencidos = negocios.filter((n) => !n.activo || n.estado_vencimiento === 'vencido').length;

  // Filtrado de negocios
  const negociosFiltrados = negocios.filter((n) => {
    const matchQuery =
      n.nombre.toLowerCase().includes(search.toLowerCase()) ||
      n.slug.toLowerCase().includes(search.toLowerCase()) ||
      (n.admin_user?.email && n.admin_user.email.toLowerCase().includes(search.toLowerCase()));

    if (!matchQuery) return false;

    if (filtroEstado === 'todos') return true;
    if (filtroEstado === 'vigente') return n.activo && n.estado_vencimiento === 'vigente';
    if (filtroEstado === 'por_vencer') return n.activo && n.estado_vencimiento === 'por_vencer';
    if (filtroEstado === 'vencido') return !n.activo || n.estado_vencimiento === 'vencido';

    return true;
  });

  return (
    <div className="space-y-8">
      {/* Tarjetas de Métricas Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Negocios</span>
            <Store className="w-5 h-5 text-neutral-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{totalNegocios}</div>
          <p className="text-xs text-neutral-500 mt-1">Registrados en la plataforma</p>
        </div>

        <div className="bg-neutral-900/80 border border-emerald-900/40 rounded-2xl p-5">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Vigentes</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-300">{activosVigentes}</div>
          <p className="text-xs text-emerald-500/80 mt-1">Catálogo online y activo</p>
        </div>

        <div className="bg-neutral-900/80 border border-amber-900/40 rounded-2xl p-5">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Por Vencer</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300">{porVencer}</div>
          <p className="text-xs text-amber-500/80 mt-1">Vencen en 7 días o menos</p>
        </div>

        <div className="bg-neutral-900/80 border border-rose-900/40 rounded-2xl p-5">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Vencidos / Pausados</span>
            <XCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-300">{vencidos}</div>
          <p className="text-xs text-rose-500/80 mt-1">Catálogo bloqueado</p>
        </div>
      </div>

      {/* Barra de Acciones y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por negocio, slug o mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Botones de filtro de estado */}
          <div className="bg-neutral-900 p-1 border border-neutral-800 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filtroEstado === 'todos' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroEstado('vigente')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filtroEstado === 'vigente' ? 'bg-emerald-950 text-emerald-300 font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Vigentes
            </button>
            <button
              onClick={() => setFiltroEstado('por_vencer')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filtroEstado === 'por_vencer' ? 'bg-amber-950 text-amber-300 font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Por Vencer
            </button>
            <button
              onClick={() => setFiltroEstado('vencido')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filtroEstado === 'vencido' ? 'bg-rose-950 text-rose-300 font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Vencidos
            </button>
          </div>

          <button
            onClick={() => setModalPlanes(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Layers className="w-4 h-4 text-rose-400" />
            <span>Gestionar Planes</span>
          </button>

          <button
            onClick={() => setModalNuevoNegocio(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/20 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Negocio</span>
          </button>
        </div>
      </div>

      {/* Lista de Negocios */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Listado de Negocios Clientes</h2>
            <p className="text-xs text-neutral-400">Control de vigencia, suscripciones, contraseñas y mantenimiento</p>
          </div>
          <button
            onClick={fetchData}
            title="Refrescar datos"
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {negociosFiltrados.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Store className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-neutral-300">No se encontraron negocios</h3>
            <p className="text-xs text-neutral-500 mt-1">Probá cambiando el filtro o creá un nuevo negocio.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950/60 text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="px-5 py-3.5">Negocio & URL</th>
                  <th className="px-5 py-3.5">Plan Asignado</th>
                  <th className="px-5 py-3.5">Semáforo / Vencimiento</th>
                  <th className="px-5 py-3.5">Administrador</th>
                  <th className="px-5 py-3.5 text-right">Herramientas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {negociosFiltrados.map((neg) => {
                  return (
                    <tr key={neg.id} className="hover:bg-neutral-800/30 transition-colors">
                      {/* Negocio & Slug */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {neg.logo_url ? (
                            <img
                              src={neg.logo_url}
                              alt={neg.nombre}
                              className="w-10 h-10 rounded-xl object-cover border border-neutral-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-rose-500 font-bold">
                              {neg.nombre.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {neg.nombre}
                              {!neg.activo && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-950 border border-red-800 text-red-300">
                                  SUSPENDIDO
                                </span>
                              )}
                            </div>
                            <a
                              href={`/n/${neg.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-mono text-neutral-400 hover:text-rose-400 inline-flex items-center gap-1 transition-colors"
                            >
                              /n/{neg.slug}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        <div className="text-xs">
                          <span className="font-medium text-neutral-200">
                            {neg.plan?.nombre || 'Plan Personalizado'}
                          </span>
                          {neg.plan && (
                            <div className="text-neutral-500 text-[11px]">
                              {formatCurrency(neg.plan.precio)} / {neg.plan.duracion_dias}d
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Semáforo / Días restantes */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {neg.estado_vencimiento === 'vigente' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                {neg.dias_restantes} días restantes
                              </span>
                            )}
                            {neg.estado_vencimiento === 'por_vencer' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/80">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                {neg.dias_restantes} días (Por Vencer)
                              </span>
                            )}
                            {neg.estado_vencimiento === 'vencido' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-800/80">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                Vencido ({Math.abs(neg.dias_restantes)}d atrás)
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-neutral-500">
                            Vence: {formatShortDate(neg.fecha_vencimiento)}
                          </span>
                        </div>
                      </td>

                      {/* Administrador */}
                      <td className="px-5 py-4">
                        <div className="text-xs">
                          <div className="font-medium text-neutral-200">
                            {neg.admin_user?.email || 'Sin usuario asignado'}
                          </div>
                          {neg.admin_user?.must_change_password ? (
                            <span className="inline-block mt-0.5 text-[10px] text-amber-400 font-mono">
                              * Clave provisoria pendiente
                            </span>
                          ) : (
                            <span className="inline-block mt-0.5 text-[10px] text-emerald-400 font-mono">
                              ✓ Clave activa
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Herramientas de acción */}
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Extender / Renovar */}
                          <button
                            onClick={() => setModalExtender(neg)}
                            title="Renovar o extender suscripción"
                            className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>

                          {/* Resetear Clave */}
                          <button
                            onClick={() => {
                              setModalResetPass(neg);
                              setClaveGenerada(null);
                            }}
                            title="Resetear contraseña momentánea"
                            className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Mantenimiento & Backup */}
                          <button
                            onClick={() => {
                              setModalMantenimiento(neg);
                              setMantenimientoStatus(null);
                              setBackupPreview(null);
                              setBackupFileContent(null);
                            }}
                            title="Mantenimiento y Backup de datos"
                            className="p-1.5 text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Database className="w-4 h-4" />
                          </button>

                          {/* Eliminar Negocio */}
                          <button
                            onClick={() => setModalEliminar(neg)}
                            title="Eliminar negocio"
                            className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================================== */}
      {/* MODAL: NUEVO NEGOCIO */}
      {/* ============================================================================== */}
      {modalNuevoNegocio && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-500 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Crear Nuevo Negocio</h3>
                  <p className="text-xs text-neutral-400">El número de WhatsApp lo cargará el admin del negocio.</p>
                </div>
              </div>
              <button
                onClick={() => setModalNuevoNegocio(false)}
                className="text-neutral-500 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCrearNegocio} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  value={nuevoNombre}
                  onChange={(e) => {
                    setNuevoNombre(e.target.value);
                    if (!nuevoSlug) setNuevoSlug(slugify(e.target.value));
                  }}
                  placeholder="ej: Pizzería Don ROLΦ"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">URL Pública / Slug *</label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-neutral-800/80 border border-r-0 border-neutral-800 rounded-l-xl text-xs font-mono text-neutral-400">
                    /n/
                  </span>
                  <input
                    type="text"
                    required
                    value={nuevoSlug}
                    onChange={(e) => setNuevoSlug(slugify(e.target.value))}
                    placeholder="pizzeria-don-rolfo"
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-r-xl text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Plan Inicial</label>
                  <select
                    value={nuevoPlanId}
                    onChange={(e) => setNuevoPlanId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {planes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.duracion_dias} días)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Logo URL (Opcional)</label>
                  <input
                    type="url"
                    value={nuevoLogo}
                    onChange={(e) => setNuevoLogo(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-2xl space-y-3">
                <span className="block text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Usuario Administrador Inicial
                </span>

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">Email del Administrador *</label>
                  <input
                    type="email"
                    required
                    value={nuevoAdminEmail}
                    onChange={(e) => setNuevoAdminEmail(e.target.value)}
                    placeholder="admin@pizzeriadonrolfo.com"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Nombre y Apellido</label>
                    <input
                      type="text"
                      value={nuevoAdminNombre}
                      onChange={(e) => setNuevoAdminNombre(e.target.value)}
                      placeholder="Juan Pérez"
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Contraseña Momentánea *</label>
                    <input
                      type="text"
                      required
                      value={nuevoPassword}
                      onChange={(e) => setNuevoPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-amber-300"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-neutral-500 italic">
                  * El administrador quedará obligado a cambiar esta contraseña en su primer inicio de sesión.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalNuevoNegocio(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Creando...' : 'Crear Negocio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: GESTIÓN DE PLANES */}
      {/* ============================================================================== */}
      {modalPlanes && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Planes de Suscripción</h3>
                  <p className="text-xs text-neutral-400">Configuración de periodicidad, precio y días de validez</p>
                </div>
              </div>
              <button
                onClick={() => setModalPlanes(false)}
                className="text-neutral-500 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 my-6">
              {planes.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-white">{p.nombre}</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">{p.descripcion}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-neutral-300">
                      <span className="text-rose-400 font-bold">{formatCurrency(p.precio)}</span>
                      <span>•</span>
                      <span>{p.duracion_dias} días de servicio</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    ACTIVO
                  </span>
                </div>
              ))}
            </div>

            <div className="text-right">
              <button
                onClick={() => setModalPlanes(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: EXTENDER VALIDEZ / RENOVAR */}
      {/* ============================================================================== */}
      {modalExtender && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-white text-base">Extender Validez</h3>
              <button onClick={() => setModalExtender(null)} className="text-neutral-500 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-neutral-400">
                Seleccioná los días a sumar a la suscripción de <strong className="text-white">{modalExtender.nombre}</strong>.
              </p>
              <div className="p-3 bg-neutral-950 rounded-xl text-xs flex justify-between">
                <span className="text-neutral-400">Vencimiento actual:</span>
                <span className="text-white font-mono">{formatShortDate(modalExtender.fecha_vencimiento)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  disabled={formSubmitting}
                  onClick={() => handleExtenderVencimiento(modalExtender.id, 30)}
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500 text-center transition-all cursor-pointer"
                >
                  <span className="block font-bold text-emerald-400 text-sm">+30 días</span>
                  <span className="text-[10px] text-neutral-500">1 Mes</span>
                </button>
                <button
                  disabled={formSubmitting}
                  onClick={() => handleExtenderVencimiento(modalExtender.id, 90)}
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500 text-center transition-all cursor-pointer"
                >
                  <span className="block font-bold text-emerald-400 text-sm">+90 días</span>
                  <span className="text-[10px] text-neutral-500">1 Trimestre</span>
                </button>
                <button
                  disabled={formSubmitting}
                  onClick={() => handleExtenderVencimiento(modalExtender.id, 365)}
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500 text-center transition-all cursor-pointer"
                >
                  <span className="block font-bold text-emerald-400 text-sm">+365 días</span>
                  <span className="text-[10px] text-neutral-500">1 Año</span>
                </button>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setModalExtender(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: RESETEAR CONTRASEÑA */}
      {/* ============================================================================== */}
      {modalResetPass && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-amber-400">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Resetear Contraseña</h3>
              </div>
              <button onClick={() => setModalResetPass(null)} className="text-neutral-500 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-neutral-400">
                Se generará una contraseña momentánea para el administrador de{' '}
                <strong className="text-white">{modalResetPass.nombre}</strong> ({modalResetPass.admin_user?.email}).
                Al iniciar sesión, el sistema le exigirá definir una nueva clave.
              </p>

              {claveGenerada ? (
                <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl text-center space-y-3">
                  <span className="text-xs text-amber-300 font-semibold block">Nueva Contraseña Provisoria:</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-lg font-bold text-white bg-black/50 px-3 py-1.5 rounded-xl border border-neutral-700 select-all">
                      {claveGenerada}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(claveGenerada);
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2000);
                      }}
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer"
                    >
                      {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-400/90">
                    Copiá esta clave y hacésela llegar al cliente de forma segura.
                  </p>
                </div>
              ) : (
                <div className="text-center pt-2">
                  <button
                    disabled={formSubmitting}
                    onClick={() => handleResetPassword(modalResetPass.id, modalResetPass.admin_user?.id)}
                    className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all cursor-pointer"
                  >
                    {formSubmitting ? 'Generando...' : 'Generar Contraseña Momentánea'}
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setModalResetPass(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: MANTENIMIENTO & BACKUP */}
      {/* ============================================================================== */}
      {modalMantenimiento && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Mantenimiento de Negocio</h3>
                  <p className="text-xs text-neutral-400">{modalMantenimiento.nombre}</p>
                </div>
              </div>
              <button onClick={() => setModalMantenimiento(null)} className="text-neutral-500 hover:text-white font-bold">
                ✕
              </button>
            </div>

            {mantenimientoStatus && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300">
                {mantenimientoStatus}
              </div>
            )}

            <div className="space-y-5 my-5">
              {/* Sección 1: Backup JSON */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Download className="w-4 h-4 text-sky-400" />
                    <span>Copia de Seguridad Completa (Backup JSON)</span>
                  </div>
                  <button
                    onClick={() => handleDescargarBackup(modalMantenimiento)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Backup</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Exporta productos, recetas, ingredientes, costos, pedidos, empleados y configuración.
                </p>
              </div>

              {/* Sección 2: Restaurar JSON */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                  <Upload className="w-4 h-4 text-purple-400" />
                  <span>Restaurar desde Archivo Backup</span>
                </div>
                <p className="text-[11px] text-neutral-400 mb-3">
                  Cargá un archivo .json generado previamente para restablecer el catálogo y configuración.
                </p>

                <div className="flex items-center gap-3">
                  <label htmlFor={fileInputId} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer border border-neutral-700">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Seleccionar Archivo JSON...</span>
                  </label>
                  <input
                    id={fileInputId}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleArchivoBackup}
                    className="hidden"
                  />
                </div>

                {/* Previsualización del archivo */}
                {backupPreview && (
                  <div className="mt-3 p-3 bg-neutral-900 border border-neutral-700 rounded-xl space-y-2">
                    <div className="text-xs font-semibold text-neutral-200">
                      Vista Previa: Negocio Origen &quot;{backupPreview.negocio_origen}&quot; (v{backupPreview.version})
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-neutral-950 p-2 rounded-lg">
                        <span className="block text-white font-bold">{backupPreview.resumen?.categorias}</span>
                        <span className="text-[10px] text-neutral-500">Categorías</span>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded-lg">
                        <span className="block text-white font-bold">{backupPreview.resumen?.productos}</span>
                        <span className="text-[10px] text-neutral-500">Productos</span>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded-lg">
                        <span className="block text-white font-bold">{backupPreview.resumen?.ingredientes}</span>
                        <span className="text-[10px] text-neutral-500">Ingredientes</span>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded-lg">
                        <span className="block text-white font-bold">{backupPreview.resumen?.pedidos}</span>
                        <span className="text-[10px] text-neutral-500">Pedidos</span>
                      </div>
                    </div>
                    <button
                      onClick={handleEjecutarRestauracion}
                      disabled={formSubmitting}
                      className="w-full mt-2 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 cursor-pointer"
                    >
                      {formSubmitting ? 'Restaurando...' : 'Confirmar y Restaurar Datos'}
                    </button>
                  </div>
                )}
              </div>

              {/* Sección 3: Acciones de Reparación / Mantenimiento */}
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span>Reparación Básica de Datos</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    disabled={formSubmitting}
                    onClick={() => handleAccionMantenimiento('recalcular_costos')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-700 cursor-pointer"
                  >
                    Recalcular Costos de Productos
                  </button>
                  <button
                    disabled={formSubmitting}
                    onClick={() => handleAccionMantenimiento('limpiar_pedidos_cancelados')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-700 cursor-pointer"
                  >
                    Purgar Pedidos Cancelados
                  </button>
                  <button
                    disabled={formSubmitting}
                    onClick={() => handleAccionMantenimiento('reiniciar_configuracion_visual')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-700 cursor-pointer"
                  >
                    Restablecer Colores Predeterminados
                  </button>
                </div>
              </div>
            </div>

            <div className="text-right">
              <button
                onClick={() => setModalMantenimiento(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: ELIMINAR NEGOCIO */}
      {/* ============================================================================== */}
      {modalEliminar && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-900/60 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 text-red-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-white text-base">¿Eliminar Negocio?</h3>
            </div>

            <p className="text-xs text-neutral-300 py-3">
              Estás a punto de eliminar definitivamente <strong className="text-white">{modalEliminar.nombre}</strong>.
              Esta acción borrará todos sus productos, pedidos, categorías y desvinculará a sus empleados.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                onClick={() => setModalEliminar(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                disabled={formSubmitting}
                onClick={handleEliminarNegocio}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {formSubmitting ? 'Eliminando...' : 'Sí, Eliminar Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
