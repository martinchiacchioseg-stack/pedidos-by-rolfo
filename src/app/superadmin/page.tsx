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
  Activity,
  Users,
  ShieldAlert,
  Play,
  FileSpreadsheet,
  Send,
  History,
  HardDrive,
  Sparkles,
  Eye,
  Edit3,
  Power,
  ChevronRight,
  Clock,
} from 'lucide-react';
import {
  Plan,
  Negocio,
  Usuario,
  BackupNegocio,
  DiagnosticoNegocio,
  ControlDiagnostico,
  AuditoriaAcceso,
} from '@/types/database';
import {
  formatCurrency,
  formatDate,
  formatShortDate,
  slugify,
  limpiarNumeroWhatsApp,
} from '@/lib/utils';

interface NegocioEnriquecido extends Negocio {
  plan?: Plan;
  admin_user?: Usuario | null;
  usuarios?: Usuario[];
  dias_restantes: number;
  estado_vencimiento: 'vigente' | 'por_vencer' | 'vencido';
  salud_estado?: 'verde' | 'amarillo' | 'rojo' | 'sin_diagnosticar';
  ultimo_backup_at?: string | null;
  dias_sin_backup?: number | null;
  alerta_sin_backup?: boolean;
}

interface UsuarioEnriquecido extends Usuario {
  ultimo_ingreso?: string | null;
}

interface EstadoMantenimientoDB {
  conteo_tablas: {
    categorias: number;
    productos: number;
    ingredientes: number;
    pedidos: number;
    pedidos_prueba: number;
    pedido_items: number;
    ventas: number;
    usuarios: number;
    cadetes: number;
    entregas: number;
    cierres_caja: number;
  };
  almacenamiento: {
    imagenes_referenciadas: number;
    espacio_usado_bytes: number;
    imagenes_sin_uso_storage: string[];
  };
  ultimo_backup_at: string | null;
  integridad: {
    total_inconsistencias: number;
    productos_sin_categoria_valida: Array<{ id: string; nombre: string }>;
    ingredientes_sin_producto: Array<{ id: string; nombre: string }>;
    pedidos_sin_items: Array<{ id: string; numero_pedido: number; estado: string }>;
    items_producto_eliminado: Array<{ id: string; nombre_producto: string }>;
    ventas_sin_pedido: Array<{ id: string; total: number }>;
    pedidos_con_total_desfasado: Array<{ id: string; numero_pedido: number; total_actual: number }>;
    ventas_con_total_desfasado: Array<{ id: string; pedido_id: string; total_actual: number }>;
    pedidos_entregados_sin_venta: Array<{ id: string; numero_pedido: number; total: number }>;
    ventas_duplicadas: Array<{ id: string; pedido_id: string }>;
    entregas_sin_cadete_valido: Array<{ id: string; numero_pedido: number }>;
    cierres_caja_desfasados: Array<{ id: string; fecha_referencia: string; total_vendido: number }>;
    usuarios_sin_rol_valido: Array<{ id: string; email: string; role: string }>;
    telefonos_sin_normalizar: Array<{ tabla: string; id: string; valor: string }>;
    imagenes_sin_uso: string[];
    pedidos_de_prueba: Array<{ id: string; numero_pedido: number }>;
  };
}

type FichaTab =
  | 'resumen'
  | 'plan'
  | 'usuarios'
  | 'diagnostico'
  | 'basedatos'
  | 'backups'
  | 'historial';

export default function SuperAdminDashboard() {
  const [negocios, setNegocios] = useState<NegocioEnriquecido[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [ultimosBackups, setUltimosBackups] = useState<BackupNegocio[]>([]);
  const [auditoriaGlobal, setAuditoriaGlobal] = useState<AuditoriaAcceso[]>([]);
  const [intentosFallidos24h, setIntentosFallidos24h] = useState(0);
  const [loading, setLoading] = useState(true);

  // Buscador global (negocios y usuarios por nombre o mail) y filtros (Sección B e I)
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<
    'todos' | 'vigente' | 'por_vencer' | 'vencido' | 'suspendido' | 'problemas_salud'
  >('todos');

  // Ficha Única del Negocio Seleccionado y sus 7 Pestañas (Sección H)
  const [negocioFicha, setNegocioFicha] = useState<NegocioEnriquecido | null>(null);
  const [fichaTab, setFichaTab] = useState<FichaTab>('resumen');
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaUsuarios, setFichaUsuarios] = useState<UsuarioEnriquecido[]>([]);
  const [fichaBackups, setFichaBackups] = useState<BackupNegocio[]>([]);
  const [fichaDiagnosticos, setFichaDiagnosticos] = useState<DiagnosticoNegocio[]>([]);
  const [fichaAuditoria, setFichaAuditoria] = useState<AuditoriaAcceso[]>([]);
  const [fichaDB, setFichaDB] = useState<EstadoMantenimientoDB | null>(null);

  // Estado del formulario Resumen de la Ficha
  const [editNegocioForm, setEditNegocioForm] = useState({
    nombre: '',
    slug: '',
    logo_url: '',
    whatsapp_numero: '',
    telefono: '',
    direccion_local: '',
    color_primario: '#F59E0B',
    color_secundario: '#09090B',
    tiempo_preparacion_min: 30,
    abierto_manual: true,
    modo_apertura: 'manual',
    mensaje_bienvenida: '',
    mensaje_cierre: '',
  });
  const [resumenFeedback, setResumenFeedback] = useState<string | null>(null);

  // Estado de Plan y Validez en Ficha
  const [planSeleccionadoId, setPlanSeleccionadoId] = useState('');
  const [diasManualesDelta, setDiasManualesDelta] = useState('30');
  const [fechaExactaVencimiento, setFechaExactaVencimiento] = useState('');
  const [motivoCambioPlan, setMotivoCambioPlan] = useState('');
  const [planFeedback, setPlanFeedback] = useState<string | null>(null);

  // Estado de Gestión de Usuarios dentro de la Ficha
  const [nuevoUsrNombre, setNuevoUsrNombre] = useState('');
  const [nuevoUsrEmail, setNuevoUsrEmail] = useState('');
  const [nuevoUsrTel, setNuevoUsrTel] = useState('');
  const [nuevoUsrRole, setNuevoUsrRole] = useState<'admin' | 'vendedor' | 'cadete'>('admin');
  const [nuevoUsrPass, setNuevoUsrPass] = useState('');
  const [editEmailModal, setEditEmailModal] = useState<{
    usuario: UsuarioEnriquecido;
    nuevoEmail: string;
    nombre: string;
    telefono: string;
  } | null>(null);

  // Modal de Resetear Contraseña (con validación de contraseña del Súper Admin)
  const [resetPassTarget, setResetPassTarget] = useState<{
    negocioId: string;
    negocioNombre: string;
    negocioSlug: string;
    usuario?: UsuarioEnriquecido | null;
  } | null>(null);
  const [resetCustomPass, setResetCustomPass] = useState('');
  const [resetSuperAdminPass, setResetSuperAdminPass] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  // Modal de Credenciales Únicas (Se muestra UNA sola vez al crear negocio o resetear clave + WhatsApp editable)
  const [credencialesUnicasModal, setCredencialesUnicasModal] = useState<{
    titulo: string;
    negocioId: string;
    negocioNombre: string;
    slug: string;
    usuarioId?: string;
    nombreUsuario: string;
    email: string;
    telefono: string;
    passwordMomentanea: string;
    mensajeWhatsApp: string;
  } | null>(null);
  const [copiadoCredencial, setCopiadoCredencial] = useState(false);

  // Modal de Aviso de Vencimiento por WhatsApp (Sección I)
  const [avisoVencimientoModal, setAvisoVencimientoModal] = useState<{
    negocio: NegocioEnriquecido;
    telefono: string;
    mensaje: string;
  } | null>(null);

  // Diagnóstico y Prueba de Flujo Completo en la Ficha (Sección F)
  const [diagnosticoActual, setDiagnosticoActual] = useState<{
    semaforo: 'verde' | 'amarillo' | 'rojo';
    puntaje: number;
    resumen: string;
    controles: ControlDiagnostico[];
    fecha: string;
  } | null>(null);
  const [ejecutandoDiagnostico, setEjecutandoDiagnostico] = useState(false);
  const [ejecutandoFlujoPrueba, setEjecutandoFlujoPrueba] = useState(false);
  const [resultadoFlujoPrueba, setResultadoFlujoPrueba] = useState<{
    exito_global: boolean;
    pasos: Array<{ paso: number; nombre: string; exito: boolean; detalle: string }>;
  } | null>(null);

  // Mantenimiento de Base de Datos (Sección G: 1. Simulación -> 2. Confirmación + Clave -> 3. Backup Previo -> 4. Ejecución -> 5. Resumen)
  const [fechaDepuracionAntiguos, setFechaDepuracionAntiguos] = useState('');
  const [simulacionMantenimiento, setSimulacionMantenimiento] = useState<{
    accion: string;
    titulo: string;
    registros_afectados: number;
    descripcion: string;
    requiereConfirmarNombre: boolean;
  } | null>(null);
  const [mantSuperAdminPass, setMantSuperAdminPass] = useState('');
  const [mantConfirmNombre, setMantConfirmNombre] = useState('');
  const [mantError, setMantError] = useState<string | null>(null);
  const [resumenUltimaOperacionDB, setResumenUltimaOperacionDB] = useState<{
    que_se_encontro: string;
    que_se_corrigio: string;
    que_quedo_pendiente: string;
    backup_seguridad_previo_id: string | null;
  } | null>(null);

  // Backups y Restauración / Clonación en la Ficha (Sección E)
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<{
    version: string;
    fecha_exportacion: string;
    negocio_origen: string;
    negocio_destino: string;
    es_clonacion: boolean;
    resumen: Record<string, number>;
    estado_actual_destino: Record<string, number>;
  } | null>(null);
  const [restoreConfirmNombre, setRestoreConfirmNombre] = useState('');
  const [restoreSuperAdminPass, setRestoreSuperAdminPass] = useState('');
  const [restoreNegocioDestinoId, setRestoreNegocioDestinoId] = useState('');
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Modales Globales (Nuevo Negocio, Planes, Auditoría Global, Eliminar Negocio)
  const [modalNuevoNegocio, setModalNuevoNegocio] = useState(false);
  const [modalPlanes, setModalPlanes] = useState(false);
  const [modalAuditoriaGlobal, setModalAuditoriaGlobal] = useState(false);
  const [modalEliminar, setModalEliminar] = useState<NegocioEnriquecido | null>(null);
  const [eliminarConfirmNombre, setEliminarConfirmNombre] = useState('');
  const [eliminarSuperAdminPass, setEliminarSuperAdminPass] = useState('');
  const [eliminarError, setEliminarError] = useState<string | null>(null);

  // Formulario Nuevo Negocio
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoSlug, setNuevoSlug] = useState('');
  const [nuevoLogo, setNuevoLogo] = useState('');
  const [nuevoPlanId, setNuevoPlanId] = useState('');
  const [nuevosDiasPersonalizados, setNuevosDiasPersonalizados] = useState('');
  const [nuevoAdminEmail, setNuevoAdminEmail] = useState('');
  const [nuevoAdminNombre, setNuevoAdminNombre] = useState('');
  const [nuevoAdminTelefono, setNuevoAdminTelefono] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState(
    'Admin@' + Math.floor(1000 + Math.random() * 9000)
  );
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Formulario Crear / Editar Plan
  const [planEditando, setPlanEditando] = useState<Plan | null>(null);
  const [planNombre, setPlanNombre] = useState('');
  const [planDias, setPlanDias] = useState('30');
  const [planPrecio, setPlanPrecio] = useState('15000');
  const [planDescripcion, setPlanDescripcion] = useState('');

  const fileInputId = useId();

  const armarMensajeCredenciales = (params: {
    negocioNombre: string;
    slug: string;
    email: string;
    passwordMomentanea: string;
  }) => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://pedidos-by-rolfo.vercel.app';
    return (
      `Hola! Te compartimos tus credenciales de acceso para *${params.negocioNombre}* en *Pedidos by ROLΦ*:\n\n` +
      `• Panel de ingreso: ${origin}/login\n` +
      `• Catálogo público: ${origin}/n/${params.slug}\n` +
      `• Usuario (Email): ${params.email}\n` +
      `• Contraseña momentánea: ${params.passwordMomentanea}\n\n` +
      `Importante: Por seguridad, en tu primer ingreso el sistema te pedirá definir tu propia contraseña personal.`
    );
  };

  // Cargar listado de negocios, planes, últimos backups y auditoría
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resNeg, resPlanes] = await Promise.all([
        fetch('/api/superadmin/negocios?auditoria=1'),
        fetch('/api/superadmin/planes'),
      ]);

      if (resNeg.ok) {
        const data = await resNeg.json();
        setNegocios(data.negocios || []);
        setUltimosBackups(data.ultimos_backups || []);
        setAuditoriaGlobal(data.auditoria_reciente || []);
        setIntentosFallidos24h(data.intentos_fallidos_recientes || 0);
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

  // Abrir la Ficha Única de un Negocio y cargar todos sus módulos
  const abrirFichaNegocio = useCallback(
    async (neg: NegocioEnriquecido, tabInicial: FichaTab = 'resumen') => {
      setNegocioFicha(neg);
      setFichaTab(tabInicial);
      setFichaLoading(true);
      setResumenFeedback(null);
      setPlanFeedback(null);
      setResultadoFlujoPrueba(null);
      setSimulacionMantenimiento(null);
      setResumenUltimaOperacionDB(null);
      setBackupPreview(null);
      setBackupFileContent(null);
      setRestoreFeedback(null);
      setRestoreError(null);
      setRestoreNegocioDestinoId(neg.id);

      setEditNegocioForm({
        nombre: neg.nombre || '',
        slug: neg.slug || '',
        logo_url: neg.logo_url || '',
        whatsapp_numero: neg.whatsapp_numero || '',
        telefono: neg.telefono || '',
        direccion_local: neg.direccion_local || '',
        color_primario: neg.color_primario || '#F59E0B',
        color_secundario: neg.color_secundario || '#09090B',
        tiempo_preparacion_min: neg.tiempo_preparacion_min || 30,
        abierto_manual: neg.abierto_manual !== false,
        modo_apertura: neg.modo_apertura || 'manual',
        mensaje_bienvenida: neg.mensaje_bienvenida || '',
        mensaje_cierre: neg.mensaje_cierre || '',
      });
      setPlanSeleccionadoId(neg.plan_id || '');
      setFechaExactaVencimiento(
        neg.fecha_vencimiento ? neg.fecha_vencimiento.slice(0, 10) : ''
      );

      try {
        const [resDetalle, resMant] = await Promise.all([
          fetch(`/api/superadmin/negocios/${neg.id}`),
          fetch(`/api/superadmin/negocios/${neg.id}/mantenimiento`),
        ]);

        if (resDetalle.ok) {
          const det = await resDetalle.json();
          if (det.negocio) setNegocioFicha(det.negocio);
          setFichaUsuarios(det.usuarios || []);
          setFichaBackups(det.backups || []);
          setFichaDiagnosticos(det.diagnosticos || []);
          setFichaAuditoria(det.auditoria || []);
          if (det.diagnosticos && det.diagnosticos.length > 0) {
            const ult = det.diagnosticos[0];
            setDiagnosticoActual({
              semaforo: ult.semaforo,
              puntaje: ult.puntaje,
              resumen: ult.resumen,
              controles: ult.controles || [],
              fecha: ult.created_at,
            });
          } else {
            setDiagnosticoActual(null);
          }
        }

        if (resMant.ok) {
          const dbData = await resMant.json();
          setFichaDB(dbData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFichaLoading(false);
      }
    },
    []
  );

  // Crear negocio y mostrar credenciales por única vez
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
          plan_id: nuevoPlanId || planes[0]?.id || null,
          duracion_dias_personalizada: nuevosDiasPersonalizados || undefined,
          admin_email: nuevoAdminEmail,
          admin_nombre: nuevoAdminNombre,
          admin_telefono: nuevoAdminTelefono,
          password_momentanea: nuevoPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear negocio');

      setModalNuevoNegocio(false);
      setNuevoNombre('');
      setNuevoSlug('');
      setNuevoLogo('');
      setNuevosDiasPersonalizados('');
      setNuevoAdminEmail('');
      setNuevoAdminNombre('');
      setNuevoAdminTelefono('');
      setNuevoPassword('Admin@' + Math.floor(1000 + Math.random() * 9000));
      await fetchData();

      if (data.credenciales_unicas) {
        const c = data.credenciales_unicas;
        setCredencialesUnicasModal({
          titulo: `Credenciales Iniciales — ${c.negocio_nombre}`,
          negocioId: data.negocio.id,
          negocioNombre: c.negocio_nombre,
          slug: c.slug,
          nombreUsuario: c.nombre,
          email: c.email,
          telefono: c.telefono || '',
          passwordMomentanea: c.password_momentanea,
          mensajeWhatsApp: armarMensajeCredenciales({
            negocioNombre: c.negocio_nombre,
            slug: c.slug,
            email: c.email,
            passwordMomentanea: c.password_momentanea,
          }),
        });
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Guardar Resumen en la Ficha del Negocio
  const handleGuardarResumenNegocio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocioFicha) return;
    setFormSubmitting(true);
    setResumenFeedback(null);

    try {
      const res = await fetch(`/api/superadmin/negocios/${negocioFicha.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editNegocioForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar negocio');

      setResumenFeedback('Datos del negocio actualizados correctamente.');
      await fetchData();
      abrirFichaNegocio({ ...negocioFicha, ...data.negocio }, 'resumen');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Actualizar Plan, Días o Estado Activo/Suspendido
  const handleActualizarPlanYValidez = async (payload: Record<string, unknown>) => {
    const targetId = (payload.negocio_id as string) || negocioFicha?.id;
    if (!targetId) return;
    setFormSubmitting(true);
    setPlanFeedback(null);

    try {
      const res = await fetch(`/api/superadmin/negocios/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error actualizando vigencia');

      setPlanFeedback('Vigencia y plan actualizados con éxito.');
      await fetchData();
      if (negocioFicha && negocioFicha.id === targetId) {
        abrirFichaNegocio({ ...negocioFicha, ...data.negocio }, fichaTab);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error actualizando plan');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Ejecutar Diagnóstico de un negocio o de todos
  const handleDiagnosticar = async (neg?: NegocioEnriquecido | 'todos') => {
    const targetId = neg === 'todos' ? 'todos' : neg?.id || negocioFicha?.id;
    if (!targetId) return;

    setEjecutandoDiagnostico(true);
    try {
      const res = await fetch(`/api/superadmin/negocios/${targetId}/mantenimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'diagnosticar' }),
      });
      const data = await res.json();
      if (res.ok) {
        if (targetId !== 'todos' && data.diagnostico) {
          setDiagnosticoActual(data.diagnostico);
        }
        await fetchData();
        if (negocioFicha && targetId === negocioFicha.id) {
          abrirFichaNegocio(negocioFicha, 'diagnostico');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEjecutandoDiagnostico(false);
    }
  };

  // Ejecutar Prueba del Flujo Completo (Simulación End-to-End con es_prueba = true)
  const handleProbarFlujoCompleto = async () => {
    if (!negocioFicha) return;
    setEjecutandoFlujoPrueba(true);
    setResultadoFlujoPrueba(null);

    try {
      const res = await fetch(
        `/api/superadmin/negocios/${negocioFicha.id}/mantenimiento`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'probar_flujo_completo' }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setResultadoFlujoPrueba({
          exito_global: data.exito_global,
          pasos: data.pasos || [],
        });
      } else {
        alert(data.error || 'Error ejecutando prueba de flujo');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEjecutandoFlujoPrueba(false);
    }
  };

  // Paso 1 de Mantenimiento DB: Simular (Modo Preview)
  const handleSimularMantenimientoDB = async (
    accion: string,
    titulo: string,
    requiereConfirmarNombre = false
  ) => {
    if (!negocioFicha) return;
    setMantError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(
        `/api/superadmin/negocios/${negocioFicha.id}/mantenimiento`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion,
            modo: 'preview',
            fecha_limite: fechaDepuracionAntiguos || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo simular la operación');
        return;
      }

      setMantSuperAdminPass('');
      setMantConfirmNombre('');
      setSimulacionMantenimiento({
        accion,
        titulo,
        registros_afectados: data.registros_afectados || 0,
        descripcion: data.descripcion || '',
        requiereConfirmarNombre,
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Pasos 2, 3, 4 y 5 de Mantenimiento DB: Confirmar con clave del Súper Admin + Backup automático previo + Ejecución
  const handleEjecutarMantenimientoDBConfirmado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocioFicha || !simulacionMantenimiento) return;
    setMantError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(
        `/api/superadmin/negocios/${negocioFicha.id}/mantenimiento`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: simulacionMantenimiento.accion,
            modo: 'execute',
            superadmin_password: mantSuperAdminPass,
            confirmacion_nombre: mantConfirmNombre,
            fecha_limite: fechaDepuracionAntiguos || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMantError(data.error || 'Error ejecutando operación');
        return;
      }

      setSimulacionMantenimiento(null);
      setResumenUltimaOperacionDB(data.resumen_operacion || null);
      if (data.estado_actualizado) {
        setFichaDB((prev) =>
          prev ? { ...prev, ...data.estado_actualizado } : data.estado_actualizado
        );
      }
      await fetchData();
    } catch {
      setMantError('Error de conexión con el servidor');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirmar Reseteo de Contraseña con validación de contraseña del Súper Admin
  const handleConfirmarResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassTarget) return;
    setResetError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(
        `/api/superadmin/negocios/${resetPassTarget.negocioId}/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'reset_password',
            usuario_id: resetPassTarget.usuario?.id,
            nueva_password: resetCustomPass.trim() || undefined,
            superadmin_password: resetSuperAdminPass,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || 'Error al resetear contraseña');
        return;
      }

      const usr = data.usuario;
      const targetNegocioNombre = resetPassTarget.negocioNombre;
      const targetSlug = resetPassTarget.negocioSlug;

      setResetPassTarget(null);
      setResetCustomPass('');
      setResetSuperAdminPass('');
      await fetchData();
      if (negocioFicha && negocioFicha.id === resetPassTarget.negocioId) {
        abrirFichaNegocio(negocioFicha, fichaTab);
      }

      // Mostrar credenciales por ÚNICA VEZ con botón de copiar y WhatsApp editable
      setCredencialesUnicasModal({
        titulo: `Nueva Contraseña Momentánea — ${usr.nombre}`,
        negocioId: resetPassTarget.negocioId,
        negocioNombre: targetNegocioNombre,
        slug: targetSlug,
        usuarioId: usr.id,
        nombreUsuario: usr.nombre,
        email: usr.email,
        telefono: usr.telefono || '',
        passwordMomentanea: data.password_momentanea,
        mensajeWhatsApp: armarMensajeCredenciales({
          negocioNombre: targetNegocioNombre,
          slug: targetSlug,
          email: usr.email,
          passwordMomentanea: data.password_momentanea,
        }),
      });
    } catch {
      setResetError('Error de red al procesar el reseteo.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Crear nuevo usuario en la pestaña Usuarios de la Ficha
  const handleCrearUsuarioEnFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocioFicha) return;
    setFormSubmitting(true);

    try {
      const res = await fetch(
        `/api/superadmin/negocios/${negocioFicha.id}/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'crear_usuario',
            nombre: nuevoUsrNombre,
            nuevo_email: nuevoUsrEmail,
            telefono: nuevoUsrTel,
            role: nuevoUsrRole,
            nueva_password: nuevoUsrPass.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al crear usuario');
        return;
      }

      setNuevoUsrNombre('');
      setNuevoUsrEmail('');
      setNuevoUsrTel('');
      setNuevoUsrPass('');
      abrirFichaNegocio(negocioFicha, 'usuarios');

      setCredencialesUnicasModal({
        titulo: `Credenciales de Nuevo Usuario (${data.usuario.role})`,
        negocioId: negocioFicha.id,
        negocioNombre: negocioFicha.nombre,
        slug: negocioFicha.slug,
        usuarioId: data.usuario.id,
        nombreUsuario: data.usuario.nombre,
        email: data.usuario.email,
        telefono: data.usuario.telefono || '',
        passwordMomentanea: data.password_momentanea,
        mensajeWhatsApp: armarMensajeCredenciales({
          negocioNombre: negocioFicha.nombre,
          slug: negocioFicha.slug,
          email: data.usuario.email,
          passwordMomentanea: data.password_momentanea,
        }),
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Activar / Desactivar usuario desde la Ficha
  const handleToggleUsuarioFicha = async (u: UsuarioEnriquecido) => {
    if (!negocioFicha) return;
    await fetch(`/api/superadmin/negocios/${negocioFicha.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'toggle_activo',
        usuario_id: u.id,
        activo: !u.activo,
      }),
    });
    abrirFichaNegocio(negocioFicha, 'usuarios');
  };

  // Guardar cambio de email de usuario
  const handleGuardarCambioEmailUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocioFicha || !editEmailModal) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(
        `/api/superadmin/negocios/${negocioFicha.id}/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'cambiar_email',
            usuario_id: editEmailModal.usuario.id,
            nuevo_email: editEmailModal.nuevoEmail,
            nombre: editEmailModal.nombre,
            telefono: editEmailModal.telefono,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error cambiando email');
        return;
      }
      setEditEmailModal(null);
      abrirFichaNegocio(negocioFicha, 'usuarios');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Enviar credenciales por WhatsApp (wa.me) y registrar en auditoría
  const handleEnviarCredencialesWhatsApp = async () => {
    if (!credencialesUnicasModal) return;
    const cleanPhone = limpiarNumeroWhatsApp(credencialesUnicasModal.telefono);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(credencialesUnicasModal.mensajeWhatsApp)}`
      : `https://wa.me/?text=${encodeURIComponent(credencialesUnicasModal.mensajeWhatsApp)}`;

    window.open(url, '_blank', 'noopener,noreferrer');

    await fetch(
      `/api/superadmin/negocios/${credencialesUnicasModal.negocioId}/reset-password`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'registrar_envio_whatsapp',
          usuario_id: credencialesUnicasModal.usuarioId,
          nuevo_email: credencialesUnicasModal.email,
          telefono: cleanPhone,
        }),
      }
    );
  };

  // Cargar archivo de backup para vista previa en la pestaña Backups
  const handleArchivoBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !negocioFicha) return;
    setRestoreError(null);
    setRestoreFeedback(null);

    const targetId = restoreNegocioDestinoId || negocioFicha.id;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        setBackupFileContent(text);
        const parsed = JSON.parse(text);

        const res = await fetch(`/api/superadmin/negocios/${targetId}/backup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup: parsed, modo: 'preview' }),
        });
        const data = await res.json();
        if (res.ok) {
          setBackupPreview(data);
          setRestoreConfirmNombre('');
          setRestoreSuperAdminPass('');
        } else {
          setRestoreError(data.error || 'Formato de archivo inválido');
        }
      } catch {
        setRestoreError('El archivo seleccionado no es un JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  // Ejecutar Restauración o Clonación con confirmación de nombre + contraseña del Súper Admin + backup previo automático
  const handleEjecutarRestauracion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFileContent || !negocioFicha || !backupPreview) return;
    setRestoreError(null);
    setFormSubmitting(true);

    const targetId = restoreNegocioDestinoId || negocioFicha.id;
    const esClon = targetId !== negocioFicha.id || backupPreview.es_clonacion;

    try {
      const parsed = JSON.parse(backupFileContent);
      const res = await fetch(`/api/superadmin/negocios/${targetId}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup: parsed,
          modo: esClon ? 'clonar' : 'restore',
          confirmacion_nombre: restoreConfirmNombre,
          superadmin_password: restoreSuperAdminPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRestoreError(data.error || 'Error al restaurar backup');
        return;
      }

      setRestoreFeedback(data.mensaje);
      setBackupFileContent(null);
      setBackupPreview(null);
      setRestoreConfirmNombre('');
      setRestoreSuperAdminPass('');
      await fetchData();
      abrirFichaNegocio(negocioFicha, 'backups');
    } catch {
      setRestoreError('Error procesando la restauración');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Eliminar negocio con confirmación de nombre + contraseña del Súper Admin
  const handleEliminarNegocio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEliminar) return;
    setEliminarError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(`/api/superadmin/negocios/${modalEliminar.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmacion_nombre: eliminarConfirmNombre,
          superadmin_password: eliminarSuperAdminPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEliminarError(data.error || 'No se pudo eliminar el negocio');
        return;
      }

      if (negocioFicha?.id === modalEliminar.id) {
        setNegocioFicha(null);
      }
      setModalEliminar(null);
      setEliminarConfirmNombre('');
      setEliminarSuperAdminPass('');
      fetchData();
    } catch {
      setEliminarError('Error de red al eliminar negocio');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Guardar / Actualizar Plan de suscripción
  const handleGuardarPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const method = planEditando ? 'PUT' : 'POST';
      const res = await fetch('/api/superadmin/planes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: planEditando?.id,
          nombre: planNombre,
          duracion_dias: Number(planDias) || 30,
          precio: Number(planPrecio) || 0,
          descripcion: planDescripcion,
          activo: true,
        }),
      });
      if (res.ok) {
        setPlanEditando(null);
        setPlanNombre('');
        setPlanDias('30');
        setPlanPrecio('15000');
        setPlanDescripcion('');
        fetchData();
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Exportar Auditoría a CSV
  const exportarAuditoriaCSV = (registros: AuditoriaAcceso[], sufijo = 'global') => {
    const headers = ['Fecha', 'Evento', 'Usuario / Email', 'Negocio ID', 'Detalles JSON'];
    const rows = registros.map((a) =>
      [
        formatDate(a.created_at),
        a.evento,
        `"${(a.email || 'Sistema').replace(/"/g, '""')}"`,
        a.metadata?.negocio_id || '-',
        `"${JSON.stringify(a.metadata || {}).replace(/"/g, '""')}"`,
      ].join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-superadmin-${sufijo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Métricas del Dashboard
  const totalNegocios = negocios.length;
  const activosVigentes = negocios.filter(
    (n) => n.activo && n.estado_vencimiento === 'vigente'
  ).length;
  const porVencer = negocios.filter(
    (n) => n.activo && n.estado_vencimiento === 'por_vencer'
  ).length;
  const vencidosOSuspendidos = negocios.filter(
    (n) => !n.activo || n.estado_vencimiento === 'vencido'
  ).length;
  const conProblemasSalud = negocios.filter(
    (n) => n.salud_estado === 'rojo' || n.salud_estado === 'amarillo'
  ).length;

  // Filtrado de negocios + Buscador Global (incluye búsqueda por usuarios de cualquier negocio)
  const qGlobal = search.trim().toLowerCase();
  const negociosFiltrados = negocios.filter((n) => {
    const matchNegocio =
      n.nombre.toLowerCase().includes(qGlobal) ||
      n.slug.toLowerCase().includes(qGlobal);
    const matchUsuario = (n.usuarios || []).some(
      (u) =>
        u.nombre?.toLowerCase().includes(qGlobal) ||
        u.email?.toLowerCase().includes(qGlobal)
    );

    if (qGlobal && !matchNegocio && !matchUsuario) return false;

    if (filtroEstado === 'todos') return true;
    if (filtroEstado === 'vigente') return n.activo && n.estado_vencimiento === 'vigente';
    if (filtroEstado === 'por_vencer')
      return n.activo && n.estado_vencimiento === 'por_vencer';
    if (filtroEstado === 'vencido') return n.estado_vencimiento === 'vencido';
    if (filtroEstado === 'suspendido') return !n.activo;
    if (filtroEstado === 'problemas_salud')
      return n.salud_estado === 'rojo' || n.salud_estado === 'amarillo';

    return true;
  });

  // Coincidencias directas de usuarios en el buscador global
  const usuariosCoincidentesGlobal = qGlobal
    ? negocios.flatMap((n) =>
        (n.usuarios || [])
          .filter(
            (u) =>
              u.nombre?.toLowerCase().includes(qGlobal) ||
              u.email?.toLowerCase().includes(qGlobal)
          )
          .map((u) => ({ usuario: u, negocio: n }))
      )
    : [];

  const renderSemaforoSaludBadge = (
    estado?: 'verde' | 'amarillo' | 'rojo' | 'sin_diagnosticar'
  ) => {
    if (estado === 'verde') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/90 text-emerald-300 border border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Saludable
        </span>
      );
    }
    if (estado === 'amarillo') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/90 text-amber-300 border border-amber-800">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Atención
        </span>
      );
    }
    if (estado === 'rojo') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/90 text-rose-300 border border-rose-800">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          Crítico
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
        Sin diagnosticar
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Alerta de seguridad ante intentos fallidos repetidos de login al Súper Admin (Sección A) */}
      {intentosFallidos24h > 0 && (
        <div className="bg-amber-950/50 border border-amber-700/70 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Aviso de Seguridad:</strong> Se registraron{' '}
              <strong>{intentosFallidos24h}</strong> intento(s) fallido(s) de acceso al
              panel del Súper Administrador en las últimas 24 horas.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setModalAuditoriaGlobal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-neutral-950 font-bold cursor-pointer shrink-0"
          >
            Revisar Auditoría
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas del Dashboard Inicial (Sección H) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Total Negocios
            </span>
            <Store className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {totalNegocios}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Aislados con RLS</p>
        </div>

        <div className="bg-neutral-900/90 border border-emerald-900/40 rounded-2xl p-5">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Activos Vigentes
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-300 font-mono">
            {activosVigentes}
          </div>
          <p className="text-[11px] text-emerald-500/80 mt-1">Catálogo operativo</p>
        </div>

        <div className="bg-neutral-900/90 border border-amber-900/40 rounded-2xl p-5">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Por Vencer (≤7d)
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300 font-mono">
            {porVencer}
          </div>
          <p className="text-[11px] text-amber-500/80 mt-1">Próximos a renovar</p>
        </div>

        <div className="bg-neutral-900/90 border border-rose-900/40 rounded-2xl p-5">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Vencidos / Susp.
            </span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-300 font-mono">
            {vencidosOSuspendidos}
          </div>
          <p className="text-[11px] text-rose-500/80 mt-1">Servicio bloqueado</p>
        </div>

        <div className="bg-neutral-900/90 border border-sky-900/40 rounded-2xl p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-sky-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Alertas de Salud
            </span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-extrabold text-sky-300 font-mono">
            {conProblemasSalud}
          </div>
          <p className="text-[11px] text-sky-500/80 mt-1">Con observaciones</p>
        </div>
      </div>

      {/* Barra de Buscador Global, Filtros y Acciones Globales */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscador global: negocio, slug, nombre de usuario o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={ejecutandoDiagnostico}
            onClick={() => handleDiagnosticar('todos')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-800/70 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${ejecutandoDiagnostico ? 'animate-spin' : ''}`} />
            <span>
              {ejecutandoDiagnostico ? 'Diagnosticando...' : 'Diagnosticar Todos'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.open('/api/superadmin/negocios/todos/backup', '_blank')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-sky-300 bg-sky-950/60 hover:bg-sky-900/70 border border-sky-800/70 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup Todos los Negocios</span>
          </button>

          <button
            type="button"
            onClick={() => setModalAuditoriaGlobal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Auditoría ({auditoriaGlobal.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setModalPlanes(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-rose-400" />
            <span>Planes</span>
          </button>

          <button
            type="button"
            onClick={() => setModalNuevoNegocio(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Negocio</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Filtro de la Lista de Negocios */}
      <div className="flex items-center gap-1.5 bg-neutral-900 p-1.5 border border-neutral-800 rounded-2xl overflow-x-auto text-xs w-fit">
        {(
          [
            { id: 'todos', label: 'Todos' },
            { id: 'vigente', label: 'Activos Vigentes' },
            { id: 'por_vencer', label: 'Por Vencer' },
            { id: 'vencido', label: 'Vencidos' },
            { id: 'suspendido', label: 'Suspendidos' },
            { id: 'problemas_salud', label: 'Con Problemas de Salud' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroEstado(f.id)}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
              filtroEstado === f.id
                ? 'bg-rose-600 text-white font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Resultados rápidos de Usuarios si se buscó un email o nombre en el buscador global */}
      {usuariosCoincidentesGlobal.length > 0 && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-rose-400" />
            Usuarios encontrados en el buscador global ({usuariosCoincidentesGlobal.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {usuariosCoincidentesGlobal.map(({ usuario, negocio }) => (
              <div
                key={usuario.id}
                onClick={() => abrirFichaNegocio(negocio, 'usuarios')}
                className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-rose-500/60 flex items-center justify-between text-xs cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-bold text-white">{usuario.nombre}</div>
                  <div className="font-mono text-neutral-400 text-[11px]">{usuario.email}</div>
                  <div className="text-[10px] text-rose-400 mt-0.5">
                    Negocio: {negocio.nombre} ({usuario.role})
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla Principal de Negocios Clientes */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              Listado de Negocios y Centro de Control
            </h2>
            <p className="text-xs text-neutral-400">
              Elegí cualquier negocio para abrir su Ficha Única de Mantenimiento, Diagnóstico, Base de Datos, Usuarios y Backups
            </p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            title="Refrescar datos"
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {negociosFiltrados.length === 0 ? (
          <div className="text-center py-14 px-4">
            <Store className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-neutral-300">
              No se encontraron negocios con ese criterio
            </h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950/70 text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="px-5 py-3.5">Negocio & URL</th>
                  <th className="px-5 py-3.5">Plan & Vigencia</th>
                  <th className="px-5 py-3.5">Salud Operativa</th>
                  <th className="px-5 py-3.5">Último Backup</th>
                  <th className="px-5 py-3.5">Administrador</th>
                  <th className="px-5 py-3.5 text-right">Acciones Rápidas y Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {negociosFiltrados.map((neg) => (
                  <tr
                    key={neg.id}
                    className={`hover:bg-neutral-800/40 transition-colors ${
                      negocioFicha?.id === neg.id ? 'bg-rose-950/20' : ''
                    }`}
                  >
                    {/* Negocio */}
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
                          <div className="font-bold text-white flex items-center gap-2">
                            {neg.nombre}
                            {!neg.activo && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-950 border border-red-800 text-red-300 font-bold">
                                SUSPENDIDO
                              </span>
                            )}
                          </div>
                          <a
                            href={`/n/${neg.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-mono text-neutral-400 hover:text-rose-400 inline-flex items-center gap-1"
                          >
                            /n/{neg.slug}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Plan & Vigencia */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-neutral-200">
                          {neg.plan?.nombre || 'Plan Personalizado'}
                        </div>
                        <div className="flex items-center gap-2">
                          {neg.estado_vencimiento === 'vigente' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                              {neg.dias_restantes}d restantes
                            </span>
                          )}
                          {neg.estado_vencimiento === 'por_vencer' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800">
                              {neg.dias_restantes}d (Por vencer)
                            </span>
                          )}
                          {neg.estado_vencimiento === 'vencido' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800">
                              Vencido ({Math.abs(neg.dias_restantes)}d)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          Vence: {formatShortDate(neg.fecha_vencimiento)}
                        </div>
                      </div>
                    </td>

                    {/* Semáforo de Salud (Sección F) */}
                    <td className="px-5 py-4">
                      {renderSemaforoSaludBadge(neg.salud_estado)}
                    </td>

                    {/* Último Backup + Alerta >7 días sin backup (Sección I) */}
                    <td className="px-5 py-4 text-xs">
                      {neg.ultimo_backup_at ? (
                        <div>
                          <div className="font-mono text-neutral-200">
                            {formatShortDate(neg.ultimo_backup_at)}
                          </div>
                          {neg.alerta_sin_backup ? (
                            <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Más de 7 días sin backup
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400">Al día</span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-800/60">
                          <AlertTriangle className="w-3 h-3" />
                          Sin backup
                        </span>
                      )}
                    </td>

                    {/* Administrador */}
                    <td className="px-5 py-4 text-xs">
                      <div className="font-medium text-neutral-200">
                        {neg.admin_user?.email || 'Sin admin'}
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        {(neg.usuarios || []).length} usuario(s) en total
                      </span>
                    </td>

                    {/* Acciones Rápidas y Botón de Ficha Única */}
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={() => abrirFichaNegocio(neg, 'resumen')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Abrir Ficha</span>
                        </button>

                        {/* Renovar con 1 toque */}
                        <button
                          type="button"
                          onClick={() =>
                            handleActualizarPlanYValidez({
                              negocio_id: neg.id,
                              renovar_un_toque: true,
                              motivo_cambio: 'Renovación rápida desde listado',
                            })
                          }
                          title="Renovar suscripción con 1 toque"
                          className="p-2 text-neutral-300 hover:text-emerald-400 bg-neutral-800/80 hover:bg-neutral-800 rounded-xl cursor-pointer"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>

                        {/* Avisar vencimiento por WhatsApp (Sección I) */}
                        {neg.dias_restantes <= 7 && (
                          <button
                            type="button"
                            onClick={() =>
                              setAvisoVencimientoModal({
                                negocio: neg,
                                telefono:
                                  neg.admin_user?.telefono || neg.whatsapp_numero || '',
                                mensaje:
                                  `Hola! Te escribimos desde *Pedidos by ROLΦ* para avisarte que la suscripción de *${neg.nombre}* ` +
                                  (neg.dias_restantes > 0
                                    ? `vence en *${neg.dias_restantes} día(s)* (${formatShortDate(neg.fecha_vencimiento)}).`
                                    : `se encuentra vencida desde el ${formatShortDate(neg.fecha_vencimiento)}.`) +
                                  `\n\nRespondenos por este medio con tu comprobante de renovación para extender tu validez de inmediato y mantener activo tu catálogo y panel.`,
                              })
                            }
                            title="Avisar vencimiento por WhatsApp"
                            className="p-2 text-amber-400 hover:bg-amber-950/60 bg-neutral-800/80 rounded-xl cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}

                        {/* Diagnosticar rápido */}
                        <button
                          type="button"
                          onClick={() => abrirFichaNegocio(neg, 'diagnostico')}
                          title="Diagnosticar negocio"
                          className="p-2 text-neutral-300 hover:text-sky-400 bg-neutral-800/80 hover:bg-neutral-800 rounded-xl cursor-pointer"
                        >
                          <Activity className="w-4 h-4" />
                        </button>

                        {/* Hacer Backup rápido */}
                        <button
                          type="button"
                          onClick={() => {
                            window.open(
                              `/api/superadmin/negocios/${neg.id}/backup`,
                              '_blank'
                            );
                            setTimeout(fetchData, 1500);
                          }}
                          title="Descargar Backup JSON"
                          className="p-2 text-neutral-300 hover:text-purple-400 bg-neutral-800/80 hover:bg-neutral-800 rounded-xl cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Eliminar negocio */}
                        <button
                          type="button"
                          onClick={() => {
                            setModalEliminar(neg);
                            setEliminarConfirmNombre('');
                            setEliminarSuperAdminPass('');
                            setEliminarError(null);
                          }}
                          title="Eliminar negocio"
                          className="p-2 text-neutral-400 hover:text-rose-400 bg-neutral-800/80 hover:bg-neutral-800 rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================================== */}
      {/* FICHA ÚNICA E INTEGRAL DEL NEGOCIO ELEGIDO (7 PESTAÑAS - SECCIONES B a H)     */}
      {/* ============================================================================== */}
      {negocioFicha && (
        <div className="bg-neutral-900 border-2 border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden scroll-mt-20">
          {/* Cabecera de la Ficha Única */}
          <div className="p-6 bg-neutral-950/90 border-b border-neutral-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {negocioFicha.logo_url ? (
                <img
                  src={negocioFicha.logo_url}
                  alt={negocioFicha.nombre}
                  className="w-14 h-14 rounded-2xl object-cover border border-neutral-700"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-xl font-extrabold">
                  {negocioFicha.nombre.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-extrabold text-white">
                    Ficha de Mantenimiento: {negocioFicha.nombre}
                  </h2>
                  {renderSemaforoSaludBadge(negocioFicha.salud_estado)}
                  {!negocioFicha.activo && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800">
                      SUSPENDIDO
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-400 mt-1 flex flex-wrap items-center gap-3 font-mono">
                  <span>ID: {negocioFicha.id}</span>
                  <span>•</span>
                  <a
                    href={`/n/${negocioFicha.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-rose-400 hover:underline inline-flex items-center gap-1"
                  >
                    /n/{negocioFicha.slug}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => abrirFichaNegocio(negocioFicha, fichaTab)}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fichaLoading ? 'animate-spin' : ''}`} />
                <span>Refrescar Ficha</span>
              </button>
              <button
                type="button"
                onClick={() => setNegocioFicha(null)}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 cursor-pointer"
              >
                Cerrar Ficha ✕
              </button>
            </div>
          </div>

          {/* Barra de las 7 Pestañas de la Ficha (Sección H) */}
          <div className="bg-neutral-950/60 border-b border-neutral-800 px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto text-xs">
            {(
              [
                { id: 'resumen', label: '1. Resumen y Datos', icon: Store },
                { id: 'plan', label: '2. Plan y Validez', icon: Calendar },
                { id: 'usuarios', label: `3. Usuarios (${fichaUsuarios.length})`, icon: Users },
                { id: 'diagnostico', label: '4. Diagnóstico y Flujo', icon: Activity },
                { id: 'basedatos', label: '5. Base de Datos', icon: Database },
                { id: 'backups', label: `6. Backups (${fichaBackups.length})`, icon: HardDrive },
                { id: 'historial', label: `7. Historial (${fichaAuditoria.length})`, icon: History },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = fichaTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFichaTab(t.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Contenido de la Pestaña Activa */}
          <div className="p-6">
            {/* ==================================================================== */}
            {/* PESTAÑA 1: RESUMEN Y EDICIÓN DE DATOS DEL NEGOCIO (Sección B)         */}
            {/* ==================================================================== */}
            {fichaTab === 'resumen' && (
              <form onSubmit={handleGuardarResumenNegocio} className="space-y-6">
                {resumenFeedback && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{resumenFeedback}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      Nombre del Negocio *
                    </label>
                    <input
                      type="text"
                      required
                      value={editNegocioForm.nombre}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({ ...p, nombre: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      Slug URL Pública (/n/...) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editNegocioForm.slug}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({
                          ...p,
                          slug: slugify(e.target.value),
                        }))
                      }
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      WhatsApp de Recepción de Pedidos
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 5491155551234"
                      value={editNegocioForm.whatsapp_numero}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({
                          ...p,
                          whatsapp_numero: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      Dirección del Local
                    </label>
                    <input
                      type="text"
                      value={editNegocioForm.direccion_local}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({
                          ...p,
                          direccion_local: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      Logo URL
                    </label>
                    <input
                      type="text"
                      value={editNegocioForm.logo_url}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({ ...p, logo_url: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      Tiempo Prep. Promedio (min)
                    </label>
                    <input
                      type="number"
                      value={editNegocioForm.tiempo_preparacion_min}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({
                          ...p,
                          tiempo_preparacion_min: Number(e.target.value) || 30,
                        }))
                      }
                      className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      Mensaje de Bienvenida
                    </label>
                    <textarea
                      rows={2}
                      value={editNegocioForm.mensaje_bienvenida}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({
                          ...p,
                          mensaje_bienvenida: e.target.value,
                        }))
                      }
                      className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">
                      Mensaje de Cierre
                    </label>
                    <textarea
                      rows={2}
                      value={editNegocioForm.mensaje_cierre}
                      onChange={(e) =>
                        setEditNegocioForm((p) => ({
                          ...p,
                          mensaje_cierre: e.target.value,
                        }))
                      }
                      className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleActualizarPlanYValidez({
                          activo: !negocioFicha.activo,
                          motivo_cambio: negocioFicha.activo
                            ? 'Suspensión manual del negocio'
                            : 'Reactivación manual del negocio',
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                        negocioFicha.activo
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>
                        {negocioFicha.activo ? 'Suspender Negocio' : 'Reactivar Negocio'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setModalEliminar(negocioFicha);
                        setEliminarConfirmNombre('');
                        setEliminarSuperAdminPass('');
                        setEliminarError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-950/60 text-rose-300 border border-rose-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Negocio</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {formSubmitting ? 'Guardando...' : 'Guardar Cambios del Negocio'}
                  </button>
                </div>
              </form>
            )}

            {/* ==================================================================== */}
            {/* PESTAÑA 2: PLAN Y VALIDEZ EN DÍAS (Sección C)                        */}
            {/* ==================================================================== */}
            {fichaTab === 'plan' && (
              <div className="space-y-6">
                {planFeedback && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200">
                    {planFeedback}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Estado Actual de Vigencia */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <span className="text-xs font-bold text-neutral-400 uppercase block">
                      Estado de Vigencia Actual
                    </span>
                    <div className="text-3xl font-black text-white font-mono">
                      {negocioFicha.dias_restantes} días
                    </div>
                    <div className="text-xs text-neutral-400">
                      Fecha de vencimiento:{' '}
                      <strong className="text-white font-mono">
                        {formatShortDate(negocioFicha.fecha_vencimiento)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      disabled={formSubmitting}
                      onClick={() =>
                        handleActualizarPlanYValidez({
                          plan_id: planSeleccionadoId || negocioFicha.plan_id,
                          renovar_un_toque: true,
                          motivo_cambio: 'Renovación con un toque desde Ficha',
                        })
                      }
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                      Renovar Ahora con 1 Toque (+Plan)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setAvisoVencimientoModal({
                          negocio: negocioFicha,
                          telefono:
                            negocioFicha.admin_user?.telefono ||
                            negocioFicha.whatsapp_numero ||
                            '',
                          mensaje:
                            `Hola! Te escribimos desde *Pedidos by ROLΦ* sobre la suscripción de *${negocioFicha.nombre}*. ` +
                            `Actualmente contás con *${negocioFicha.dias_restantes} día(s)* de vigencia (vencimiento: ${formatShortDate(negocioFicha.fecha_vencimiento)}).`,
                        })
                      }
                      className="w-full py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-amber-400 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Avisar Vencimiento por WhatsApp</span>
                    </button>
                  </div>

                  {/* Controles Manuales de Plan, Días (+/-) y Fecha Exacta */}
                  <div className="lg:col-span-2 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white">
                      Asignar Plan, Sumar/Restar Días o Fijar Fecha Exacta
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-neutral-400 block mb-1">
                          Cambiar Plan Asignado
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={planSeleccionadoId}
                            onChange={(e) => setPlanSeleccionadoId(e.target.value)}
                            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
                          >
                            {planes.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} ({p.duracion_dias}d — {formatCurrency(p.precio)})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              handleActualizarPlanYValidez({
                                plan_id: planSeleccionadoId,
                                motivo_cambio: `Cambio de plan`,
                              })
                            }
                            className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-neutral-400 block mb-1">
                          Sumar o Restar Días Manualmente (ej: 15 o -7)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={diasManualesDelta}
                            onChange={(e) => setDiasManualesDelta(e.target.value)}
                            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleActualizarPlanYValidez({
                                dias_a_extender: Number(diasManualesDelta),
                                motivo_cambio:
                                  motivoCambioPlan ||
                                  `Ajuste manual de ${diasManualesDelta} días`,
                              })
                            }
                            className="px-3.5 py-2 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold cursor-pointer"
                          >
                            Sumar/Restar
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-neutral-400 block mb-1">
                          Fijar Fecha de Vencimiento Exacta
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={fechaExactaVencimiento}
                            onChange={(e) => setFechaExactaVencimiento(e.target.value)}
                            className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleActualizarPlanYValidez({
                                fecha_vencimiento: `${fechaExactaVencimiento}T23:59:59.000-03:00`,
                                motivo_cambio:
                                  motivoCambioPlan ||
                                  `Fecha exacta fijada en ${fechaExactaVencimiento}`,
                              })
                            }
                            className="px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold cursor-pointer"
                          >
                            Fijar Fecha
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-neutral-400 block mb-1">
                          Nota / Motivo para el Historial
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Pago trimestral por transferencia..."
                          value={motivoCambioPlan}
                          onChange={(e) => setMotivoCambioPlan(e.target.value)}
                          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Historial de Cambios de Plan y Vigencia */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase">
                    Historial de Cambios de Vigencia y Suscripción
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {fichaAuditoria
                      .filter((a) => a.evento === 'superadmin_update_negocio')
                      .map((a) => (
                        <div
                          key={a.id}
                          className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
                        >
                          <div>
                            <strong className="text-white">
                              {String(a.metadata?.motivo || 'Actualización de vigencia')}
                            </strong>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              Por: {a.email}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-neutral-500">
                            {formatDate(a.created_at)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PESTAÑA 3: USUARIOS Y CONTRASEÑAS DEL NEGOCIO (Sección D)            */}
            {/* ==================================================================== */}
            {fichaTab === 'usuarios' && (
              <div className="space-y-6">
                <div className="overflow-x-auto bg-neutral-950 border border-neutral-800 rounded-2xl">
                  <table className="w-full text-left text-xs text-neutral-300">
                    <thead className="bg-neutral-900 text-neutral-400 uppercase border-b border-neutral-800">
                      <tr>
                        <th className="p-3.5">Nombre y Email</th>
                        <th className="p-3.5">Rol</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5">Último Ingreso</th>
                        <th className="p-3.5">Contraseña</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {fichaUsuarios.map((u) => (
                        <tr key={u.id}>
                          <td className="p-3.5">
                            <div className="font-bold text-white">{u.nombre}</div>
                            <div className="font-mono text-neutral-400">{u.email}</div>
                            {u.telefono && (
                              <div className="font-mono text-[11px] text-emerald-400">
                                WA: {u.telefono}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 uppercase font-bold text-[11px]">
                            <span
                              className={`px-2 py-0.5 rounded-full border ${
                                u.role === 'admin'
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                  : u.role === 'cadete'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                  : 'bg-sky-950/80 text-sky-300 border-sky-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {u.activo ? (
                              <span className="text-emerald-400 font-semibold">Activo</span>
                            ) : (
                              <span className="text-rose-400 font-semibold">Desactivado</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-neutral-400">
                            {u.ultimo_ingreso ? formatDate(u.ultimo_ingreso) : 'Sin ingresos aún'}
                          </td>
                          <td className="p-3.5">
                            {u.must_change_password ? (
                              <span className="text-amber-400 font-semibold">
                                Clave momentánea (obligado a cambiar)
                              </span>
                            ) : (
                              <span className="text-emerald-400">Personalizada (Hasheada)</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setResetPassTarget({
                                    negocioId: negocioFicha.id,
                                    negocioNombre: negocioFicha.nombre,
                                    negocioSlug: negocioFicha.slug,
                                    usuario: u,
                                  });
                                  setResetCustomPass('');
                                  setResetSuperAdminPass('');
                                  setResetError(null);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Resetear Clave</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditEmailModal({
                                    usuario: u,
                                    nuevoEmail: u.email,
                                    nombre: u.nombre,
                                    telefono: u.telefono || '',
                                  })
                                }
                                title="Editar email o teléfono"
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleUsuarioFicha(u)}
                                className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                                  u.activo
                                    ? 'bg-rose-950/60 text-rose-300'
                                    : 'bg-emerald-950/60 text-emerald-300'
                                }`}
                              >
                                {u.activo ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Crear nuevo Administrador (o Vendedor/Cadete) para este negocio */}
                <form
                  onSubmit={handleCrearUsuarioEnFicha}
                  className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4"
                >
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-rose-500" />
                    Crear Nuevo Administrador o Usuario para {negocioFicha.nombre}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Nombre y apellido *"
                      value={nuevoUsrNombre}
                      onChange={(e) => setNuevoUsrNombre(e.target.value)}
                      className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email de acceso *"
                      value={nuevoUsrEmail}
                      onChange={(e) => setNuevoUsrEmail(e.target.value)}
                      className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="WhatsApp (ej: 54911...)"
                      value={nuevoUsrTel}
                      onChange={(e) => setNuevoUsrTel(e.target.value)}
                      className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                    />
                    <select
                      value={nuevoUsrRole}
                      onChange={(e) =>
                        setNuevoUsrRole(e.target.value as 'admin' | 'vendedor' | 'cadete')
                      }
                      className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
                    >
                      <option value="admin">Rol: Administrador</option>
                      <option value="vendedor">Rol: Vendedor</option>
                      <option value="cadete">Rol: Cadete</option>
                    </select>
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Crear y Generar Clave
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PESTAÑA 4: DIAGNÓSTICO Y PRUEBA DEL FLUJO COMPLETO (Sección F)       */}
            {/* ==================================================================== */}
            {fichaTab === 'diagnostico' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Diagnóstico Automático y Prueba del Flujo End-to-End
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Verifica cuenta, plan, configuración, catálogo, cadetería, URL pública e integridad, o simula un pedido completo de punta a punta sin afectar ventas reales.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={ejecutandoDiagnostico}
                      onClick={() => handleDiagnosticar(negocioFicha)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Activity
                        className={`w-4 h-4 ${ejecutandoDiagnostico ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {ejecutandoDiagnostico
                          ? 'Diagnosticando...'
                          : 'Diagnosticar Negocio'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={ejecutandoFlujoPrueba}
                      onClick={handleProbarFlujoCompleto}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-neutral-950" />
                      <span>
                        {ejecutandoFlujoPrueba
                          ? 'Simulando flujo...'
                          : 'Probar Flujo Completo'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Resultado de "Probar Flujo Completo" paso por paso */}
                {resultadoFlujoPrueba && (
                  <div
                    className={`p-5 rounded-2xl border space-y-3 ${
                      resultadoFlujoPrueba.exito_global
                        ? 'bg-emerald-950/30 border-emerald-800/80'
                        : 'bg-rose-950/30 border-rose-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Resultado de Prueba del Flujo Completo (Simulación Aislada con Auto-Limpieza)
                      </h4>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          resultadoFlujoPrueba.exito_global
                            ? 'bg-emerald-500 text-neutral-950'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {resultadoFlujoPrueba.exito_global
                          ? 'FLUJO 100% OPERATIVO'
                          : 'CON ERRORES'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {resultadoFlujoPrueba.pasos.map((p) => (
                        <div
                          key={p.paso}
                          className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-2.5 text-xs"
                        >
                          {p.exito ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-bold text-white">
                              Paso {p.paso}: {p.nombre}
                            </div>
                            <p className="text-neutral-400 text-[11px] mt-0.5">
                              {p.detalle}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Informe de Diagnóstico con Semáforo y Botones de Acción */}
                {diagnosticoActual ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {renderSemaforoSaludBadge(diagnosticoActual.semaforo)}
                        <div>
                          <div className="text-xs font-bold text-white">
                            {diagnosticoActual.resumen}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            Puntaje de salud: {diagnosticoActual.puntaje}/100 • Ejecutado:{' '}
                            {formatDate(diagnosticoActual.fecha)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {diagnosticoActual.controles.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-white">{c.titulo}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  c.estado === 'ok'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : c.estado === 'advertencia'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                                }`}
                              >
                                {c.estado}
                              </span>
                            </div>
                            <p className="text-neutral-400 leading-relaxed">{c.detalle}</p>
                          </div>

                          {c.accion_sugerida && (
                            <button
                              type="button"
                              onClick={() => {
                                if (c.accion_codigo === 'ir_plan') setFichaTab('plan');
                                else if (c.accion_codigo === 'ir_usuarios')
                                  setFichaTab('usuarios');
                                else if (c.accion_codigo === 'ir_db')
                                  setFichaTab('basedatos');
                                else setFichaTab('resumen');
                              }}
                              className="self-start px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-400 border border-neutral-700 font-semibold cursor-pointer"
                            >
                              {c.accion_sugerida} →
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-neutral-950 border border-neutral-800 text-center text-xs text-neutral-400">
                    Hacé clic en <strong>&quot;Diagnosticar Negocio&quot;</strong> para ejecutar todos los controles automáticos.
                  </div>
                )}

                {/* Historial de Diagnósticos del Negocio */}
                {fichaDiagnosticos.length > 0 && (
                  <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase">
                      Historial de Diagnósticos Ejecutados ({fichaDiagnosticos.length})
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {fichaDiagnosticos.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-neutral-900 border border-neutral-800"
                        >
                          <div className="flex items-center gap-2">
                            {renderSemaforoSaludBadge(d.semaforo)}
                            <span className="text-neutral-300">{d.resumen}</span>
                          </div>
                          <span className="font-mono text-[11px] text-neutral-500">
                            {formatDate(d.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================================================================== */}
            {/* PESTAÑA 5: MANTENIMIENTO DE LA BASE DE DATOS POR NEGOCIO (Sección G) */}
            {/* ==================================================================== */}
            {fichaTab === 'basedatos' && fichaDB && (
              <div className="space-y-6">
                {/* Resumen final de la última operación realizada */}
                {resumenUltimaOperacionDB && (
                  <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-700/80 text-xs space-y-1.5">
                    <div className="font-bold text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Resumen de Operación de Base de Datos Completada
                    </div>
                    <div>
                      <strong className="text-neutral-300">Qué se encontró:</strong>{' '}
                      {resumenUltimaOperacionDB.que_se_encontro}
                    </div>
                    <div>
                      <strong className="text-emerald-300">Qué se corrigió:</strong>{' '}
                      {resumenUltimaOperacionDB.que_se_corrigio}
                    </div>
                    <div>
                      <strong className="text-neutral-300">Qué quedó pendiente:</strong>{' '}
                      {resumenUltimaOperacionDB.que_quedo_pendiente}
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono">
                      Backup automático de seguridad previo ID:{' '}
                      {resumenUltimaOperacionDB.backup_seguridad_previo_id || 'Generado'}
                    </div>
                  </div>
                )}

                {/* 1. Estado General: Cantidad de registros por tabla y espacio en Storage */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Productos', val: fichaDB.conteo_tablas.productos },
                    { label: 'Ingredientes', val: fichaDB.conteo_tablas.ingredientes },
                    { label: 'Pedidos', val: fichaDB.conteo_tablas.pedidos },
                    { label: 'Ventas', val: fichaDB.conteo_tablas.ventas },
                    { label: 'Usuarios', val: fichaDB.conteo_tablas.usuarios },
                    { label: 'Cadetes / Entregas', val: `${fichaDB.conteo_tablas.cadetes} / ${fichaDB.conteo_tablas.entregas}` },
                    { label: 'Cierres de Caja', val: fichaDB.conteo_tablas.cierres_caja },
                    { label: 'Categorías', val: fichaDB.conteo_tablas.categorias },
                    {
                      label: 'Imágenes Usadas',
                      val: fichaDB.almacenamiento.imagenes_referenciadas,
                    },
                    {
                      label: 'Storage Usado',
                      val: `${(fichaDB.almacenamiento.espacio_usado_bytes / 1024).toFixed(1)} KB`,
                    },
                    {
                      label: 'Hallazgos Integridad',
                      val: fichaDB.integridad.total_inconsistencias,
                    },
                    {
                      label: 'Último Backup',
                      val: fichaDB.ultimo_backup_at
                        ? formatShortDate(fichaDB.ultimo_backup_at)
                        : 'Nunca',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800"
                    >
                      <span className="text-[11px] text-neutral-400 block">
                        {item.label}
                      </span>
                      <span className="text-base font-extrabold text-white font-mono">
                        {item.val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 2. Verificación de Integridad (Solo Lectura) */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Eye className="w-4 h-4 text-sky-400" />
                      Verificación de Integridad Referencial y Contable (Modo Solo Lectura)
                    </h3>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        fichaDB.integridad.total_inconsistencias === 0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {fichaDB.integridad.total_inconsistencias} inconsistencia(s) detectada(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                    {[
                      {
                        label: 'Pedidos entregados sin venta registrada',
                        count: fichaDB.integridad.pedidos_entregados_sin_venta.length,
                      },
                      {
                        label: 'Ventas con total distinto a suma de ítems',
                        count: fichaDB.integridad.ventas_con_total_desfasado.length,
                      },
                      {
                        label: 'Pedidos con total distinto a suma de ítems',
                        count: fichaDB.integridad.pedidos_con_total_desfasado.length,
                      },
                      {
                        label: 'Ventas duplicadas para un mismo pedido',
                        count: fichaDB.integridad.ventas_duplicadas.length,
                      },
                      {
                        label: 'Ventas huérfanas sin pedido existente',
                        count: fichaDB.integridad.ventas_sin_pedido.length,
                      },
                      {
                        label: 'Ingredientes huérfanos sin producto',
                        count: fichaDB.integridad.ingredientes_sin_producto.length,
                      },
                      {
                        label: 'Productos sin categoría válida',
                        count: fichaDB.integridad.productos_sin_categoria_valida.length,
                      },
                      {
                        label: 'Pedidos vacíos sin ítems',
                        count: fichaDB.integridad.pedidos_sin_items.length,
                      },
                      {
                        label: 'Entregas sin cadete válido',
                        count: fichaDB.integridad.entregas_sin_cadete_valido.length,
                      },
                      {
                        label: 'Cierres de caja con diferencia frente a ventas',
                        count: fichaDB.integridad.cierres_caja_desfasados.length,
                      },
                      {
                        label: 'Teléfonos con formato sin normalizar',
                        count: fichaDB.integridad.telefonos_sin_normalizar.length,
                      },
                      {
                        label: 'Imágenes en Storage sin uso',
                        count: fichaDB.integridad.imagenes_sin_uso.length,
                      },
                    ].map((chk) => (
                      <div
                        key={chk.label}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          chk.count > 0
                            ? 'bg-amber-950/30 border-amber-800/70 text-amber-200'
                            : 'bg-neutral-900/70 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        <span>{chk.label}</span>
                        <span className="font-mono font-bold">{chk.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Reparaciones, Limpieza y Depuración (Cada una simula primero, pide clave y hace backup previo) */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      Operaciones de Reparación, Limpieza y Mantenimiento de Base de Datos
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Toda operación muestra primero una simulación de registros afectados, exige tu contraseña de Súper Admin y genera un backup automático de seguridad antes de ejecutarse.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        handleSimularMantenimientoDB(
                          'reparar_totales',
                          'Recalcular Totales de Pedidos, Ventas y Costos de Receta'
                        )
                      }
                      className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1 cursor-pointer"
                    >
                      <div className="font-bold text-white">
                        1. Recalcular Totales y Costos
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Corrige pedidos y ventas cuyo total no coincide con sus ítems y actualiza costos de recetas.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSimularMantenimientoDB(
                          'regenerar_ventas_faltantes',
                          'Regenerar Ventas Faltantes de Pedidos Entregados'
                        )
                      }
                      className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1 cursor-pointer"
                    >
                      <div className="font-bold text-white">
                        2. Regenerar Ventas Faltantes
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Crea las ventas faltantes de pedidos entregados y elimina ventas duplicadas.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSimularMantenimientoDB(
                          'eliminar_huerfanos_y_referencias',
                          'Eliminar Registros Huérfanos y Reparar Referencias Rotas'
                        )
                      }
                      className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1 cursor-pointer"
                    >
                      <div className="font-bold text-white">
                        3. Limpiar Huérfanos y Referencias
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Elimina ingredientes sin producto, ventas sin pedido y repara referencias rotas.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSimularMantenimientoDB(
                          'normalizar_telefonos',
                          'Normalizar Formatos de Números de Teléfono y WhatsApp'
                        )
                      }
                      className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1 cursor-pointer"
                    >
                      <div className="font-bold text-white">
                        4. Normalizar Teléfonos
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Limpia guiones, espacios y símbolos en teléfonos del negocio, cadetes y pedidos.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSimularMantenimientoDB(
                          'eliminar_imagenes_sin_uso',
                          'Eliminar Imágenes Huérfanas sin Uso en Storage'
                        )
                      }
                      className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1 cursor-pointer"
                    >
                      <div className="font-bold text-white">
                        5. Limpiar Imágenes sin Uso
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Elimina archivos del bucket de Storage que ningún producto utiliza.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSimularMantenimientoDB(
                          'limpiar_datos_prueba',
                          'Limpiar Pedidos de Prueba y Cancelados sin Venta'
                        )
                      }
                      className="p-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left space-y-1 cursor-pointer"
                    >
                      <div className="font-bold text-white">
                        6. Limpiar Datos de Prueba
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Borra pedidos marcados como prueba (es_prueba) y órdenes canceladas sin venta.
                      </p>
                    </button>
                  </div>

                  {/* Depuración por antigüedad y Reinicio de Configuración (Con confirmación reforzada) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-800">
                    <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2.5">
                      <div className="text-xs font-bold text-amber-300">
                        Depuración por Antigüedad (Preserva Cierres de Caja y Ventas Contabilizadas)
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={fechaDepuracionAntiguos}
                          onChange={(e) => setFechaDepuracionAntiguos(e.target.value)}
                          className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleSimularMantenimientoDB(
                              'depurar_pedidos_antiguos',
                              'Depuración de Pedidos Antiguos No Contabilizados',
                              true
                            )
                          }
                          className="px-3.5 py-2 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold cursor-pointer"
                        >
                          Simular Depuración
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-rose-300">
                          Reinicio de Configuración a Valores por Defecto
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Restablece colores, horarios y plantillas con confirmación reforzada.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleSimularMantenimientoDB(
                            'reiniciar_configuracion',
                            'Reiniciar Configuración del Negocio a Valores de Fábrica',
                            true
                          )
                        }
                        className="px-3.5 py-2 rounded-xl bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Simular Reinicio
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PESTAÑA 6: BACKUPS, RESTAURACIÓN Y CLONACIÓN (Sección E)             */}
            {/* ==================================================================== */}
            {fichaTab === 'backups' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Generar Backup y Lista Histórica */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Backups de {negocioFicha.nombre}
                        </h3>
                        <p className="text-xs text-neutral-400">
                          Incluye productos, recetas, usuarios, cadetes, pedidos, ventas, caja, entregas GPS y marca.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          window.open(
                            `/api/superadmin/negocios/${negocioFicha.id}/backup`,
                            '_blank'
                          );
                          setTimeout(() => abrirFichaNegocio(negocioFicha, 'backups'), 1500);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>Generar Backup Ahora</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {fichaBackups.length === 0 ? (
                        <p className="text-xs text-neutral-500 py-4 text-center">
                          Todavía no hay backups guardados en el historial de este negocio.
                        </p>
                      ) : (
                        fichaBackups.map((b) => (
                          <div
                            key={b.id}
                            className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>{formatDate(b.created_at)}</span>
                                <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-sky-300 uppercase">
                                  {b.tipo}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-400 font-mono">
                                Tamaño: {(b.tamano_bytes / 1024).toFixed(1)} KB • v{b.version}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                window.open(
                                  `/api/superadmin/negocios/${negocioFicha.id}/backup?backup_id=${b.id}`,
                                  '_blank'
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Descargar</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Restaurar o Clonar en otro negocio */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-400" />
                      Restaurar Backup o Clonar en Otro Negocio
                    </h3>

                    {restoreFeedback && (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200">
                        {restoreFeedback}
                      </div>
                    )}
                    {restoreError && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                        {restoreError}
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-neutral-400 block mb-1">
                        Negocio Destino (elegí otro si deseás CLONAR el backup en otro negocio)
                      </label>
                      <select
                        value={restoreNegocioDestinoId}
                        onChange={(e) => setRestoreNegocioDestinoId(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
                      >
                        {negocios.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.id === negocioFicha.id
                              ? `${n.nombre} (Restaurar en este mismo negocio)`
                              : `${n.nombre} (CLONAR backup en este negocio)`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={fileInputId}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer border border-neutral-700"
                      >
                        <Upload className="w-4 h-4 text-purple-400" />
                        <span>Seleccionar Archivo .JSON de Backup...</span>
                      </label>
                      <input
                        id={fileInputId}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleArchivoBackup}
                        className="hidden"
                      />
                    </div>

                    {backupPreview && (
                      <form
                        onSubmit={handleEjecutarRestauracion}
                        className="p-4 rounded-2xl bg-neutral-900 border border-purple-800/60 space-y-3 text-xs"
                      >
                        <div className="font-bold text-purple-300">
                          {backupPreview.es_clonacion
                            ? `MODO CLONACIÓN: Origen "${backupPreview.negocio_origen}" → Destino "${backupPreview.negocio_destino}"`
                            : `MODO RESTAURACIÓN: "${backupPreview.negocio_destino}" (v${backupPreview.version})`}
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
                          {Object.entries(backupPreview.resumen).map(([k, val]) => (
                            <div key={k} className="bg-neutral-950 p-2 rounded-lg">
                              <span className="block text-white font-bold font-mono">
                                {val}
                              </span>
                              <span className="text-[10px] text-neutral-400 capitalize">
                                {k.replace('_', ' ')}
                              </span>
                              <span className="block text-[9px] text-neutral-500">
                                (actual: {backupPreview.estado_actual_destino?.[k] ?? 0})
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/60 text-[11px] text-sky-200">
                          Antes de aplicar los cambios, el servidor guardará automáticamente un{' '}
                          <strong>backup de seguridad del estado actual</strong>.
                        </div>

                        <div>
                          <label className="block text-[11px] text-neutral-300 mb-1">
                            Escribí el nombre exacto del negocio destino (
                            <strong>{backupPreview.negocio_destino}</strong>) *
                          </label>
                          <input
                            type="text"
                            required
                            value={restoreConfirmNombre}
                            onChange={(e) => setRestoreConfirmNombre(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-neutral-300 mb-1">
                            Tu contraseña de Súper Administrador *
                          </label>
                          <input
                            type="password"
                            required
                            value={restoreSuperAdminPass}
                            onChange={(e) => setRestoreSuperAdminPass(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={formSubmitting}
                          className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer disabled:opacity-50"
                        >
                          {formSubmitting
                            ? 'Procesando...'
                            : backupPreview.es_clonacion
                            ? 'Confirmar Clonación con Backup Previo'
                            : 'Confirmar Restauración con Backup Previo'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PESTAÑA 7: HISTORIAL Y AUDITORÍA DEL NEGOCIO (Sección A.5)           */}
            {/* ==================================================================== */}
            {fichaTab === 'historial' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Registro de Auditoría de {negocioFicha.nombre}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Trazabilidad completa de acciones sobre este negocio (sin contraseñas en texto plano).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      exportarAuditoriaCSV(fichaAuditoria, negocioFicha.slug)
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-bold cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Exportar CSV</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {fichaAuditoria.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-6 text-center">
                      No hay eventos de auditoría registrados para este negocio.
                    </p>
                  ) : (
                    fichaAuditoria.map((a) => (
                      <div
                        key={a.id}
                        className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-rose-400">
                            {a.evento}
                          </div>
                          <div className="text-neutral-300">
                            Ejecutado por: <strong>{a.email || 'Sistema'}</strong>
                          </div>
                          {a.metadata && (
                            <div className="text-[11px] text-neutral-500 font-mono break-all">
                              {JSON.stringify(a.metadata)}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-neutral-500 shrink-0">
                          {formatDate(a.created_at)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: SIMULACIÓN Y CONFIRMACIÓN DE MANTENIMIENTO DB (SECCIÓN G - 5 PASOS)     */}
      {/* ============================================================================== */}
      {simulacionMantenimiento && negocioFicha && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleEjecutarMantenimientoDBConfirmado}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-white text-base">
                Vista Previa (Simulación): {simulacionMantenimiento.titulo}
              </h3>
              <button
                type="button"
                onClick={() => setSimulacionMantenimiento(null)}
                className="text-neutral-500 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {mantError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {mantError}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Negocio seleccionado:</span>
                <strong className="text-white">{negocioFicha.nombre}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Registros afectados en simulación:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                  {simulacionMantenimiento.registros_afectados}
                </span>
              </div>
              <p className="text-neutral-300 pt-2 border-t border-neutral-800 leading-relaxed">
                {simulacionMantenimiento.descripcion}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 text-[11px] text-sky-200">
              Al confirmar, el sistema generará primero un <strong>backup automático de seguridad</strong> del estado actual y registrará el resultado en la auditoría.
            </div>

            {simulacionMantenimiento.requiereConfirmarNombre && (
              <div>
                <label className="block text-xs text-neutral-300 mb-1">
                  Confirmación reforzada: escribí exactamente{' '}
                  <strong>{negocioFicha.nombre}</strong> *
                </label>
                <input
                  type="text"
                  required
                  value={mantConfirmNombre}
                  onChange={(e) => setMantConfirmNombre(e.target.value)}
                  className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-neutral-300 mb-1">
                Ingresá tu contraseña de Súper Administrador para autorizar *
              </label>
              <input
                type="password"
                required
                value={mantSuperAdminPass}
                onChange={(e) => setMantSuperAdminPass(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSimulacionMantenimiento(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {formSubmitting
                  ? 'Ejecutando con Backup Previo...'
                  : 'Confirmar y Ejecutar Operación'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: CREDENCIALES MOSTRADAS UNA SOLA VEZ + ENVÍO POR WHATSAPP (Sección B y D) */}
      {/* ============================================================================== */}
      {credencialesUnicasModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-emerald-700/60 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="font-bold text-white text-base">
                  {credencialesUnicasModal.titulo}
                </h3>
                <p className="text-[11px] text-amber-400">
                  Por seguridad, esta contraseña momentánea se muestra UNA sola vez.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCredencialesUnicasModal(null)}
                className="text-neutral-500 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Usuario (Email):</span>
                <span className="font-mono font-bold text-white">
                  {credencialesUnicasModal.email}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Contraseña Momentánea:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black text-amber-300 bg-neutral-900 px-3 py-1 rounded-lg border border-neutral-700 select-all">
                    {credencialesUnicasModal.passwordMomentanea}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        credencialesUnicasModal.passwordMomentanea
                      );
                      setCopiadoCredencial(true);
                      setTimeout(() => setCopiadoCredencial(false), 2000);
                    }}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                  >
                    {copiadoCredencial ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Teléfono WhatsApp del destinatario
              </label>
              <input
                type="text"
                placeholder="Ej: 5491155551234"
                value={credencialesUnicasModal.telefono}
                onChange={(e) =>
                  setCredencialesUnicasModal((p) =>
                    p ? { ...p, telefono: e.target.value } : null
                  )
                }
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Mensaje editable para enviar por WhatsApp (wa.me)
              </label>
              <textarea
                rows={6}
                value={credencialesUnicasModal.mensajeWhatsApp}
                onChange={(e) =>
                  setCredencialesUnicasModal((p) =>
                    p ? { ...p, mensajeWhatsApp: e.target.value } : null
                  )
                }
                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCredencialesUnicasModal(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleEnviarCredencialesWhatsApp}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Credenciales por WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: RESETEAR CONTRASEÑA (PIDE CONTRASEÑA DEL SÚPER ADMIN - Sección A y D)   */}
      {/* ============================================================================== */}
      {resetPassTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmarResetPassword}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-white text-base">
                Resetear Contraseña — {resetPassTarget.usuario?.nombre || 'Administrador'}
              </h3>
              <button
                type="button"
                onClick={() => setResetPassTarget(null)}
                className="text-neutral-500 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {resetError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {resetError}
              </div>
            )}

            <p className="text-xs text-neutral-400">
              Se generará una contraseña momentánea para{' '}
              <strong className="text-white">{resetPassTarget.usuario?.email}</strong> y quedará obligado a cambiarla en su próximo ingreso.
            </p>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Contraseña momentánea (dejá vacío para generarla automáticamente)
              </label>
              <input
                type="text"
                placeholder="Automática segura (10 caracteres)"
                value={resetCustomPass}
                onChange={(e) => setResetCustomPass(e.target.value)}
                className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-300 font-semibold block mb-1">
                Tu contraseña de Súper Administrador *
              </label>
              <input
                type="password"
                required
                value={resetSuperAdminPass}
                onChange={(e) => setResetSuperAdminPass(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetPassTarget(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {formSubmitting ? 'Generando...' : 'Confirmar y Generar Clave'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: EDITAR EMAIL / TELÉFONO DE USUARIO DEL NEGOCIO                          */}
      {/* ============================================================================== */}
      {editEmailModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleGuardarCambioEmailUsuario}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-bold text-white text-base">
              Editar Usuario — {editEmailModal.usuario.nombre}
            </h3>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Nombre</label>
              <input
                type="text"
                required
                value={editEmailModal.nombre}
                onChange={(e) =>
                  setEditEmailModal((p) => (p ? { ...p, nombre: e.target.value } : null))
                }
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Email de Acceso</label>
              <input
                type="email"
                required
                value={editEmailModal.nuevoEmail}
                onChange={(e) =>
                  setEditEmailModal((p) =>
                    p ? { ...p, nuevoEmail: e.target.value } : null
                  )
                }
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                value={editEmailModal.telefono}
                onChange={(e) =>
                  setEditEmailModal((p) =>
                    p ? { ...p, telefono: e.target.value } : null
                  )
                }
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditEmailModal(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: AVISAR VENCIMIENTO POR WHATSAPP (Sección I)                             */}
      {/* ============================================================================== */}
      {avisoVencimientoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-white text-base">
                Avisar Vencimiento por WhatsApp — {avisoVencimientoModal.negocio.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setAvisoVencimientoModal(null)}
                className="text-neutral-500 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Teléfono WhatsApp del Administrador
              </label>
              <input
                type="text"
                value={avisoVencimientoModal.telefono}
                onChange={(e) =>
                  setAvisoVencimientoModal((p) =>
                    p ? { ...p, telefono: e.target.value } : null
                  )
                }
                placeholder="Ej: 5491155551234"
                className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Mensaje editable
              </label>
              <textarea
                rows={5}
                value={avisoVencimientoModal.mensaje}
                onChange={(e) =>
                  setAvisoVencimientoModal((p) =>
                    p ? { ...p, mensaje: e.target.value } : null
                  )
                }
                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAvisoVencimientoModal(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = limpiarNumeroWhatsApp(avisoVencimientoModal.telefono);
                  const url = clean
                    ? `https://wa.me/${clean}?text=${encodeURIComponent(avisoVencimientoModal.mensaje)}`
                    : `https://wa.me/?text=${encodeURIComponent(avisoVencimientoModal.mensaje)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                  setAvisoVencimientoModal(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-neutral-950 text-xs font-black cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Abrir WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: NUEVO NEGOCIO (Sección B)                                               */}
      {/* ============================================================================== */}
      {modalNuevoNegocio && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div>
                <h3 className="font-bold text-white text-base">Crear Nuevo Negocio</h3>
                <p className="text-xs text-neutral-400">
                  Al finalizar se mostrarán las credenciales por única vez para copiar o enviar por WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoNegocio(false)}
                className="text-neutral-500 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCrearNegocio} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-300 mb-1">
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoNombre}
                    onChange={(e) => {
                      setNuevoNombre(e.target.value);
                      if (!nuevoSlug) setNuevoSlug(slugify(e.target.value));
                    }}
                    placeholder="Ej: Pizzería Don ROLΦ"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-300 mb-1">
                    Slug URL (/n/...) *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoSlug}
                    onChange={(e) => setNuevoSlug(slugify(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-neutral-300 mb-1">Plan Inicial</label>
                  <select
                    value={nuevoPlanId}
                    onChange={(e) => setNuevoPlanId(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                  >
                    {planes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.duracion_dias}d)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-300 mb-1">
                    Días validez (opcional)
                  </label>
                  <input
                    type="number"
                    placeholder="Según plan"
                    value={nuevosDiasPersonalizados}
                    onChange={(e) => setNuevosDiasPersonalizados(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-300 mb-1">Logo URL</label>
                  <input
                    type="url"
                    value={nuevoLogo}
                    onChange={(e) => setNuevoLogo(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
                <span className="block text-xs font-bold text-rose-400 uppercase">
                  Usuario Administrador Inicial
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Email del Administrador *
                    </label>
                    <input
                      type="email"
                      required
                      value={nuevoAdminEmail}
                      onChange={(e) => setNuevoAdminEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Teléfono / WhatsApp del Admin (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 5491155551234"
                      value={nuevoAdminTelefono}
                      onChange={(e) => setNuevoAdminTelefono(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Nombre y Apellido
                    </label>
                    <input
                      type="text"
                      value={nuevoAdminNombre}
                      onChange={(e) => setNuevoAdminNombre(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Contraseña Momentánea *
                    </label>
                    <input
                      type="text"
                      required
                      value={nuevoPassword}
                      onChange={(e) => setNuevoPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-amber-300"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoNegocio(false)}
                  className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Creando...' : 'Crear Negocio y Ver Credenciales'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: GESTIÓN Y EDICIÓN DE PLANES (Sección C)                                 */}
      {/* ============================================================================== */}
      {modalPlanes && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-white text-base">
                Planes de Suscripción (Crear y Editar)
              </h3>
              <button
                type="button"
                onClick={() => setModalPlanes(false)}
                className="text-neutral-500 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {planes.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-white">
                      {p.nombre} ({p.duracion_dias} días — {formatCurrency(p.precio)})
                    </div>
                    <div className="text-neutral-400 text-[11px]">{p.descripcion}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanEditando(p);
                      setPlanNombre(p.nombre);
                      setPlanDias(String(p.duracion_dias));
                      setPlanPrecio(String(p.precio));
                      setPlanDescripcion(p.descripcion || '');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-semibold cursor-pointer"
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleGuardarPlan}
              className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3"
            >
              <div className="text-xs font-bold text-rose-400">
                {planEditando ? `Editando: ${planEditando.nombre}` : 'Crear Nuevo Plan'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Nombre del plan *"
                  value={planNombre}
                  onChange={(e) => setPlanNombre(e.target.value)}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
                />
                <input
                  type="number"
                  required
                  placeholder="Duración en días *"
                  value={planDias}
                  onChange={(e) => setPlanDias(e.target.value)}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                />
                <input
                  type="number"
                  placeholder="Precio ($)"
                  value={planPrecio}
                  onChange={(e) => setPlanPrecio(e.target.value)}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <input
                type="text"
                placeholder="Descripción opcional"
                value={planDescripcion}
                onChange={(e) => setPlanDescripcion(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white"
              />
              <div className="flex justify-end gap-2">
                {planEditando && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanEditando(null);
                      setPlanNombre('');
                      setPlanDias('30');
                      setPlanPrecio('15000');
                      setPlanDescripcion('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
                  >
                    Cancelar edición
                  </button>
                )}
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  {planEditando ? 'Actualizar Plan' : 'Agregar Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: AUDITORÍA GLOBAL CONSULTABLE Y EXPORTABLE (Sección A.5)                 */}
      {/* ============================================================================== */}
      {modalAuditoriaGlobal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="font-bold text-white text-base">
                  Registro de Auditoría Global del Sistema
                </h3>
                <p className="text-xs text-neutral-400">
                  Quién, cuándo, sobre qué negocio y qué acción realizó (ninguna contraseña se guarda en texto plano).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportarAuditoriaCSV(auditoriaGlobal, 'global')}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold cursor-pointer"
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={() => setModalAuditoriaGlobal(false)}
                  className="text-neutral-500 hover:text-white font-bold cursor-pointer px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {auditoriaGlobal.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-rose-400">{a.evento}</span> •{' '}
                    <span className="text-neutral-200">{a.email || 'Sistema'}</span>
                    {a.metadata && (
                      <div className="text-[11px] font-mono text-neutral-500 break-all">
                        {JSON.stringify(a.metadata)}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-neutral-500 shrink-0">
                    {formatDate(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: ELIMINAR NEGOCIO (EXIGE ESCRIBIR NOMBRE + CLAVE + OFRECE BACKUP PREVIO) */}
      {/* ============================================================================== */}
      {modalEliminar && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleEliminarNegocio}
            className="bg-neutral-900 border border-rose-900/80 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">
                  Eliminar Negocio: {modalEliminar.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEliminar(null)}
                className="text-neutral-500 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {eliminarError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                {eliminarError}
              </div>
            )}

            <p className="text-xs text-neutral-300 leading-relaxed">
              Esta acción eliminará el negocio <strong>{modalEliminar.nombre}</strong> y todos sus productos, pedidos, ventas y usuarios asociados.
            </p>

            <button
              type="button"
              onClick={() =>
                window.open(
                  `/api/superadmin/negocios/${modalEliminar.id}/backup`,
                  '_blank'
                )
              }
              className="w-full py-2.5 rounded-xl bg-sky-950/70 hover:bg-sky-900/70 border border-sky-700/70 text-sky-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Backup Completo Antes de Borrar</span>
            </button>

            <div>
              <label className="block text-xs text-neutral-300 mb-1">
                Escribí exactamente el nombre del negocio (
                <strong>{modalEliminar.nombre}</strong>) *
              </label>
              <input
                type="text"
                required
                value={eliminarConfirmNombre}
                onChange={(e) => setEliminarConfirmNombre(e.target.value)}
                className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-300 mb-1">
                Tu contraseña de Súper Administrador *
              </label>
              <input
                type="password"
                required
                value={eliminarSuperAdminPass}
                onChange={(e) => setEliminarSuperAdminPass(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEliminar(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  formSubmitting ||
                  eliminarConfirmNombre.trim() !== modalEliminar.nombre.trim()
                }
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer disabled:opacity-40"
              >
                {formSubmitting ? 'Eliminando...' : 'Eliminar Definitivamente'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
