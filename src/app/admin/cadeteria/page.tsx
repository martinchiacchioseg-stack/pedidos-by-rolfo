'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bike,
  Plus,
  Star,
  KeyRound,
  Send,
  Building2,
  UserCheck,
  Clock,
  MapPin,
  Save,
  CheckCircle2,
  Power,
  ShieldCheck,
} from 'lucide-react';
import { Cadete, Negocio, MomentoAvisoCadeteria } from '@/types/database';
import {
  PLANTILLAS_WHATSAPP_DEFAULT,
  compilarPlantillaWhatsApp,
  abrirWhatsAppConTexto,
} from '@/lib/whatsapp';
import { Modal } from '@/components/ui/Modal';

export default function CadeteriaAdminPage() {
  const [cadetes, setCadetes] = useState<Cadete[]>([]);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  // Configuración operativa de cadetería
  const [configForm, setConfigForm] = useState({
    direccion_local: '',
    tiempo_preparacion_min: 30,
    momento_aviso_cadeteria: 'listo' as MomentoAvisoCadeteria,
    minutos_antes_aviso: 10,
    avisar_cliente_en_camino: true,
    tpl_cadeteria_externa: PLANTILLAS_WHATSAPP_DEFAULT.cadeteria_externa,
    tpl_cadete_propio: PLANTILLAS_WHATSAPP_DEFAULT.cadete_propio,
  });

  // Modal de Alta de Cadete / Empresa Externa
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [nuevoForm, setNuevoForm] = useState({
    tipo: 'propio' as 'propio' | 'externa',
    nombre: '',
    telefono_whatsapp: '',
    es_predeterminado: false,
    email: '',
    password_momentanea: '',
  });

  // Modal de Blanqueo de Contraseña para Cadete Propio
  const [resetModal, setResetModal] = useState<{
    open: boolean;
    cadete: Cadete | null;
    nuevaPassword: string;
  }>({
    open: false,
    cadete: null,
    nuevaPassword: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/cadeteria');
      if (res.ok) {
        const data = await res.json();
        setCadetes(data.cadetes || []);
        if (data.negocio) {
          const n: Negocio = data.negocio;
          setNegocio(n);
          setConfigForm({
            direccion_local: n.direccion_local || '',
            tiempo_preparacion_min: n.tiempo_preparacion_min ?? 30,
            momento_aviso_cadeteria: n.momento_aviso_cadeteria || 'listo',
            minutos_antes_aviso: n.minutos_antes_aviso ?? 10,
            avisar_cliente_en_camino: n.avisar_cliente_en_camino ?? true,
            tpl_cadeteria_externa:
              n.plantillas_whatsapp?.cadeteria_externa ||
              PLANTILLAS_WHATSAPP_DEFAULT.cadeteria_externa,
            tpl_cadete_propio:
              n.plantillas_whatsapp?.cadete_propio ||
              PLANTILLAS_WHATSAPP_DEFAULT.cadete_propio,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const crearCadete = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/cadeteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Error al registrar cadete');
        return;
      }
      setShowCreateModal(false);
      setNuevoForm({
        tipo: 'propio',
        nombre: '',
        telefono_whatsapp: '',
        es_predeterminado: false,
        email: '',
        password_momentanea: '',
      });
      fetchData();
    } catch {
      setFormError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const actualizarCadete = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/cadeteria', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      fetchData();
    }
  };

  const confirmarResetPassword = async () => {
    if (!resetModal.cadete || resetModal.nuevaPassword.length < 6) return;
    await actualizarCadete({
      id: resetModal.cadete.id,
      nueva_password_momentanea: resetModal.nuevaPassword,
    });
    setResetModal({ open: false, cadete: null, nuevaPassword: '' });
  };

  const probarAvisoWhatsApp = (cadete: Cadete) => {
    const tpl =
      cadete.tipo === 'externa'
        ? configForm.tpl_cadeteria_externa
        : configForm.tpl_cadete_propio;

    const pedidoPrueba = {
      numero_pedido: 9999,
      cliente_nombre: 'Juan Pérez (PRUEBA)',
      cliente_telefono: '1155554444',
      direccion: 'Av. Corrientes 1234, Piso 3B',
      referencias_direccion: 'Portón de rejas negras',
      medio_pago: 'efectivo' as const,
      monto_a_cobrar: 18500,
      total: 18500,
      observaciones: 'Mensaje de prueba de cadetería',
    };

    const texto = compilarPlantillaWhatsApp(tpl, pedidoPrueba, {
      ...negocio,
      direccion_local: configForm.direccion_local || negocio?.nombre || 'Local',
      tiempo_preparacion_min: configForm.tiempo_preparacion_min,
    });

    abrirWhatsAppConTexto(cadete.telefono_whatsapp, texto);
  };

  const guardarConfiguracionCadeteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio) return;
    try {
      setSavingConfig(true);
      setConfigMsg('');

      const res = await fetch('/api/admin/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...negocio,
          direccion_local: configForm.direccion_local,
          tiempo_preparacion_min: Number(configForm.tiempo_preparacion_min) || 30,
          momento_aviso_cadeteria: configForm.momento_aviso_cadeteria,
          minutos_antes_aviso: Number(configForm.minutos_antes_aviso) || 10,
          avisar_cliente_en_camino: configForm.avisar_cliente_en_camino,
          plantillas_whatsapp: {
            cliente_listo:
              negocio.plantillas_whatsapp?.cliente_listo ||
              PLANTILLAS_WHATSAPP_DEFAULT.cliente_listo,
            cliente_en_camino:
              negocio.plantillas_whatsapp?.cliente_en_camino ||
              PLANTILLAS_WHATSAPP_DEFAULT.cliente_en_camino,
            cadeteria_externa: configForm.tpl_cadeteria_externa,
            cadete_propio: configForm.tpl_cadete_propio,
          },
        }),
      });

      if (res.ok) {
        setConfigMsg('Configuración de cadetería guardada correctamente.');
        fetchData();
      }
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Bike className="w-6 h-6 text-amber-500" />
            Cadetería y Logística de Envíos
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Administrá tus cadetes propios (con App móvil y GPS al entregar) y empresas de cadetería externa por WhatsApp
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/10 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nuevo Cadete / Empresa Externa</span>
        </button>
      </div>

      {/* Listado de Cadetes y Empresas Externas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-xs text-zinc-400">
            Cargando cadetes y empresas de envío...
          </div>
        ) : cadetes.length === 0 ? (
          <div className="col-span-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-10 text-center space-y-2">
            <Bike className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Todavía no cargaste ningún cadete ni empresa externa
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Agregá cadetes propios (tendrán acceso a la vista móvil /cadete con GPS) o una empresa de cadetería externa para enviarle los pedidos listos por WhatsApp.
            </p>
          </div>
        ) : (
          cadetes.map((cadete) => (
            <div
              key={cadete.id}
              className={`bg-zinc-900/90 border rounded-2xl p-5 flex flex-col justify-between gap-4 ${
                cadete.es_predeterminado
                  ? 'border-amber-500/70 ring-1 ring-amber-500/20'
                  : 'border-zinc-800'
              } ${!cadete.activo ? 'opacity-60' : ''}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        cadete.tipo === 'externa'
                          ? 'bg-indigo-950/60 border-indigo-800 text-indigo-400'
                          : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                      }`}
                    >
                      {cadete.tipo === 'externa' ? (
                        <Building2 className="w-5 h-5" />
                      ) : (
                        <UserCheck className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {cadete.nombre}
                      </h3>
                      <span className="text-[11px] text-zinc-400">
                        {cadete.tipo === 'externa'
                          ? 'Empresa de Cadetería Externa'
                          : 'Cadete Propio (App + GPS)'}
                      </span>
                    </div>
                  </div>

                  {cadete.es_predeterminado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      Predeterminado
                    </span>
                  )}
                </div>

                <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">WhatsApp:</span>
                    <span className="font-mono text-zinc-200">
                      {cadete.telefono_whatsapp}
                    </span>
                  </div>
                  {cadete.tipo === 'propio' && cadete.usuario && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Usuario App:</span>
                        <span className="font-mono text-zinc-300 truncate max-w-[170px]">
                          {cadete.usuario.email}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Privacidad GPS:</span>
                        <span className="text-[11px] flex items-center gap-1 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {cadete.usuario.acepto_privacidad_gps
                            ? 'Aceptada'
                            : 'Pendiente 1° ingreso'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Acciones de la tarjeta */}
              <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => probarAvisoWhatsApp(cadete)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/60 font-semibold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Probar WhatsApp</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {!cadete.es_predeterminado && cadete.activo && (
                    <button
                      type="button"
                      onClick={() =>
                        actualizarCadete({ id: cadete.id, es_predeterminado: true })
                      }
                      title="Marcar como predeterminado para envíos"
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {cadete.tipo === 'propio' && (
                    <button
                      type="button"
                      onClick={() =>
                        setResetModal({
                          open: true,
                          cadete,
                          nuevaPassword: '',
                        })
                      }
                      title="Blanquear contraseña momentánea"
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      actualizarCadete({ id: cadete.id, activo: !cadete.activo })
                    }
                    title={cadete.activo ? 'Desactivar' : 'Reactivar'}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      cadete.activo
                        ? 'bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300'
                        : 'bg-emerald-950 text-emerald-300'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Configuración de Tiempos, Dirección de Retiro y Plantillas de Cadetería (Secciones H.2 y H.3) */}
      <form
        onSubmit={guardarConfiguracionCadeteria}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Reglas de Aviso a Cadetería y Plantillas de Despacho
            </h2>
            <p className="text-xs text-zinc-400">
              Definí cuándo alertar al operador para pedir cadete y el formato del mensaje con link a Google Maps
            </p>
          </div>
          {configMsg && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              {configMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Dirección del Local (punto de retiro)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Ej: Av. Santa Fe 3200, Palermo"
                value={configForm.direccion_local}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    direccion_local: e.target.value,
                  }))
                }
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Tiempo promedio de preparación (minutos)
            </label>
            <input
              type="number"
              min={5}
              max={180}
              value={configForm.tiempo_preparacion_min}
              onChange={(e) =>
                setConfigForm((prev) => ({
                  ...prev,
                  tiempo_preparacion_min: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              ¿Cuándo avisar a la cadetería?
            </label>
            <select
              value={configForm.momento_aviso_cadeteria}
              onChange={(e) =>
                setConfigForm((prev) => ({
                  ...prev,
                  momento_aviso_cadeteria: e.target.value as MomentoAvisoCadeteria,
                }))
              }
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            >
              <option value="al_aceptar">Al pasar el pedido a &quot;En preparación&quot;</option>
              <option value="minutos_antes">X minutos antes de que esté listo</option>
              <option value="listo">Cuando el pedido pasa a &quot;Listo&quot;</option>
              <option value="manual">Solo manualmente</option>
            </select>
          </div>
        </div>

        {configForm.momento_aviso_cadeteria === 'minutos_antes' && (
          <div className="max-w-xs">
            <label className="text-xs font-semibold text-amber-400 block mb-1">
              Minutos de anticipación antes de que esté listo
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={configForm.minutos_antes_aviso}
              onChange={(e) =>
                setConfigForm((prev) => ({
                  ...prev,
                  minutos_antes_aviso: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Plantilla WhatsApp — Empresa de Cadetería Externa
            </label>
            <textarea
              rows={5}
              value={configForm.tpl_cadeteria_externa}
              onChange={(e) =>
                setConfigForm((prev) => ({
                  ...prev,
                  tpl_cadeteria_externa: e.target.value,
                }))
              }
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Plantilla WhatsApp — Cadete Propio
            </label>
            <textarea
              rows={5}
              value={configForm.tpl_cadete_propio}
              onChange={(e) =>
                setConfigForm((prev) => ({
                  ...prev,
                  tpl_cadete_propio: e.target.value,
                }))
              }
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="text-[11px] text-zinc-500">
          Variables disponibles:{' '}
          <code className="text-amber-400">
            {'{numero_pedido} {negocio} {direccion_retiro} {nombre} {telefono} {direccion} {referencias} {link_mapa} {medio_pago} {monto_a_cobrar} {observaciones} {hora_estimada}'}
          </code>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingConfig}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'Guardando...' : 'Guardar Reglas y Plantillas'}</span>
          </button>
        </div>
      </form>

      {/* MODAL: Alta de Cadete o Empresa Externa */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Registrar Cadete o Empresa de Cadetería"
      >
        <form onSubmit={crearCadete} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNuevoForm((p) => ({ ...p, tipo: 'propio' }))}
              className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${
                nuevoForm.tipo === 'propio'
                  ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 font-bold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              <div className="font-bold">Cadete Propio</div>
              <div className="text-[11px] opacity-80">
                Con usuario, App móvil /cadete y GPS al entregar
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNuevoForm((p) => ({ ...p, tipo: 'externa' }))}
              className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${
                nuevoForm.tipo === 'externa'
                  ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 font-bold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              <div className="font-bold">Empresa Externa</div>
              <div className="text-[11px] opacity-80">
                Sin usuario en el sistema; recibe avisos por WhatsApp
              </div>
            </button>
          </div>

          <div>
            <label className="text-xs text-zinc-300 block mb-1">
              {nuevoForm.tipo === 'externa'
                ? 'Nombre de la Empresa de Cadetería *'
                : 'Nombre y Apellido del Cadete *'}
            </label>
            <input
              type="text"
              required
              placeholder={
                nuevoForm.tipo === 'externa'
                  ? 'Ej: MotoExpress Palermo'
                  : 'Ej: Lucas Gómez'
              }
              value={nuevoForm.nombre}
              onChange={(e) =>
                setNuevoForm((p) => ({ ...p, nombre: e.target.value }))
              }
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-300 block mb-1">
              Número de WhatsApp (con código de país, ej: 54911...) *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: 5491144556677"
              value={nuevoForm.telefono_whatsapp}
              onChange={(e) =>
                setNuevoForm((p) => ({ ...p, telefono_whatsapp: e.target.value }))
              }
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
            />
          </div>

          {nuevoForm.tipo === 'propio' && (
            <div className="space-y-3 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800">
              <div className="text-xs font-bold text-emerald-400">
                Credenciales de Acceso a la Vista del Cadete (/cadete)
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Email del Cadete *
                </label>
                <input
                  type="email"
                  required
                  placeholder="cadete@tunegocio.com"
                  value={nuevoForm.email}
                  onChange={(e) =>
                    setNuevoForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Contraseña Momentánea (mín. 6 caracteres) *
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  placeholder="Ej: Moto2026!"
                  value={nuevoForm.password_momentanea}
                  onChange={(e) =>
                    setNuevoForm((p) => ({
                      ...p,
                      password_momentanea: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                />
                <span className="text-[11px] text-zinc-500 block mt-1">
                  En su primer ingreso el sistema lo obligará a definir su propia contraseña personal.
                </span>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={nuevoForm.es_predeterminado}
              onChange={(e) =>
                setNuevoForm((p) => ({
                  ...p,
                  es_predeterminado: e.target.checked,
                }))
              }
              className="rounded border-zinc-700"
            />
            <span>Asignar por defecto a los nuevos pedidos con envío</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Registrando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Blanqueo de contraseña de cadete propio */}
      <Modal
        open={resetModal.open}
        onClose={() =>
          setResetModal({ open: false, cadete: null, nuevaPassword: '' })
        }
        title={`Blanquear Contraseña — ${resetModal.cadete?.nombre || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">
            Ingresá una nueva contraseña momentánea. Cuando el cadete inicie sesión, deberá cambiarla obligatoriamente.
          </p>
          <input
            type="text"
            placeholder="Nueva contraseña momentánea (mín. 6 caracteres)"
            value={resetModal.nuevaPassword}
            onChange={(e) =>
              setResetModal((p) => ({ ...p, nuevaPassword: e.target.value }))
            }
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setResetModal({ open: false, cadete: null, nuevaPassword: '' })
              }
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarResetPassword}
              disabled={resetModal.nuevaPassword.length < 6}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              Actualizar Contraseña
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
