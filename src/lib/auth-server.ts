import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { createClient as createStatelessClient, SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export type VerifySuperAdminResult =
  | { authorized: false; response: NextResponse; user?: never; adminSupabase?: never }
  | { authorized: true; response?: never; user: User; adminSupabase: SupabaseClient };

export async function verifySuperAdmin(): Promise<VerifySuperAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('role, activo')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'superadmin' || !profile.activo) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Acceso denegado: Se requieren permisos de Súper Administrador' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user, adminSupabase: createAdminClient() };
}

/**
 * Re-valida la contraseña actual del Súper Administrador para acciones sensibles:
 * eliminar negocio, restaurar backup, resetear contraseñas, reparaciones y limpiezas de base de datos.
 */
export async function verifySuperAdminPassword(
  email: string,
  password?: string
): Promise<{ valid: boolean; error?: string }> {
  if (!password || !password.trim()) {
    return {
      valid: false,
      error: 'Esta acción sensible requiere ingresar tu contraseña de Súper Administrador.',
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { valid: false, error: 'Error de configuración del servidor Auth.' };
  }

  const tempClient = createStatelessClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await tempClient.auth.signInWithPassword({
    email,
    password: password.trim(),
  });

  if (error || !data.user) {
    return {
      valid: false,
      error: 'Contraseña de Súper Administrador incorrecta. Operación rechazada.',
    };
  }

  return { valid: true };
}

/**
 * Construye el payload JSON completo v2.0.0 de un negocio y lo persiste opcionalmente en public.backups_negocio.
 */
export async function construirYGuardarBackupNegocio(
  adminSupabase: SupabaseClient,
  negocioId: string,
  opciones: {
    tipo: 'manual' | 'pre_restauracion' | 'pre_mantenimiento' | 'pre_eliminacion' | 'global';
    descripcion?: string;
    userId?: string;
    userEmail?: string;
    persistirEnTabla?: boolean;
  }
) {
  const { data: negocio, error: negError } = await adminSupabase
    .from('negocios')
    .select('*')
    .eq('id', negocioId)
    .single();

  if (negError || !negocio) {
    throw new Error('Negocio no encontrado para generar backup.');
  }

  const [
    { data: categorias },
    { data: productos },
    { data: ingredientes },
    { data: usuarios },
    { data: cadetes },
    { data: pedidos },
    { data: ventas },
    { data: cierres_caja },
  ] = await Promise.all([
    adminSupabase.from('categorias').select('*').eq('negocio_id', negocioId).order('orden'),
    adminSupabase.from('productos').select('*').eq('negocio_id', negocioId).order('orden'),
    adminSupabase.from('ingredientes').select('*').eq('negocio_id', negocioId),
    adminSupabase
      .from('usuarios')
      .select(
        'id, email, nombre, telefono, role, activo, must_change_password, acepto_privacidad_gps, acepto_privacidad_at, created_at'
      )
      .eq('negocio_id', negocioId),
    adminSupabase.from('cadetes').select('*').eq('negocio_id', negocioId),
    adminSupabase
      .from('pedidos')
      .select('*, items:pedido_items(*)')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('ventas')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('fecha_venta', { ascending: false }),
    adminSupabase
      .from('cierres_caja')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('fecha_cierre', { ascending: false }),
  ]);

  const nowIso = new Date().toISOString();

  // Recolectar referencias de imágenes de marca y productos
  const imagenesReferencias = [
    negocio.logo_url,
    negocio.banner_url,
    ...(productos || []).map((p: { imagen_url?: string | null }) => p.imagen_url),
  ].filter(Boolean);

  const estadisticas = {
    categorias_count: categorias?.length || 0,
    productos_count: productos?.length || 0,
    ingredientes_count: ingredientes?.length || 0,
    usuarios_count: usuarios?.length || 0,
    cadetes_count: cadetes?.length || 0,
    pedidos_count: pedidos?.length || 0,
    ventas_count: ventas?.length || 0,
    cierres_caja_count: cierres_caja?.length || 0,
    imagenes_referencias_count: imagenesReferencias.length,
  };

  const backupPayload = {
    app: 'Pedidos by ROLΦ',
    version: '2.0.0',
    export_date: nowIso,
    tipo_backup: opciones.tipo,
    descripcion: opciones.descripcion || `Backup (${opciones.tipo})`,
    negocio: {
      id: negocio.id,
      plan_id: negocio.plan_id,
      nombre: negocio.nombre,
      slug: negocio.slug,
      logo_url: negocio.logo_url,
      banner_url: negocio.banner_url,
      slogan: negocio.slogan,
      color_primario: negocio.color_primario,
      color_secundario: negocio.color_secundario,
      tipografia_id: negocio.tipografia_id,
      tema_catalogo: negocio.tema_catalogo,
      estilo_bordes: negocio.estilo_bordes,
      telefono: negocio.telefono,
      whatsapp_numero: negocio.whatsapp_numero,
      direccion_local: negocio.direccion_local,
      abierto_manual: negocio.abierto_manual,
      modo_apertura: negocio.modo_apertura,
      horarios: negocio.horarios,
      horarios_semanales: negocio.horarios_semanales,
      tiempo_preparacion_min: negocio.tiempo_preparacion_min,
      momento_aviso_cadeteria: negocio.momento_aviso_cadeteria,
      minutos_antes_aviso: negocio.minutos_antes_aviso,
      avisar_cliente_en_camino: negocio.avisar_cliente_en_camino,
      plantillas_whatsapp: negocio.plantillas_whatsapp,
      mensaje_bienvenida: negocio.mensaje_bienvenida,
      mensaje_cierre: negocio.mensaje_cierre,
      fecha_vencimiento: negocio.fecha_vencimiento,
      activo: negocio.activo,
    },
    estadisticas,
    imagenes_referencias: imagenesReferencias,
    categorias: categorias || [],
    productos: productos || [],
    ingredientes: ingredientes || [],
    usuarios: usuarios || [],
    cadetes: cadetes || [],
    pedidos: pedidos || [],
    ventas: ventas || [],
    cierres_caja: cierres_caja || [],
  };

  const jsonString = JSON.stringify(backupPayload);
  const tamanoBytes = Buffer.byteLength(jsonString, 'utf8');

  let backupRecordId: string | null = null;

  if (opciones.persistirEnTabla !== false) {
    try {
      const { data: inserted } = await adminSupabase
        .from('backups_negocio')
        .insert({
          negocio_id: negocioId,
          negocio_nombre: negocio.nombre,
          negocio_slug: negocio.slug,
          version: '2.0.0',
          tipo: opciones.tipo,
          descripcion: opciones.descripcion || `Backup (${opciones.tipo})`,
          tamano_bytes: tamanoBytes,
          creado_por_id: opciones.userId || null,
          creado_por_email: opciones.userEmail || null,
          estadisticas,
          payload: backupPayload,
        })
        .select('id')
        .single();

      if (inserted) backupRecordId = inserted.id;

      await adminSupabase
        .from('negocios')
        .update({ ultimo_backup_at: nowIso })
        .eq('id', negocioId);
    } catch {
      // Continuar de forma resiliente si la tabla backups_negocio aún no fue migrada
    }
  }

  return {
    backupRecordId,
    tamanoBytes,
    backupPayload,
  };
}
