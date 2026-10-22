import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { calcularDiasRestantes, getEstadoVencimiento, slugify } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const searchParams = req.nextUrl.searchParams;
  const incluirAuditoria = searchParams.get('auditoria') === '1';

  // Obtener negocios con sus planes y todos sus usuarios
  const { data: negocios, error } = await adminSupabase
    .from('negocios')
    .select(`
      *,
      plan:planes(*),
      usuarios(id, email, nombre, telefono, role, must_change_password, activo, created_at)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Consultar últimos backups y auditoría reciente de forma resiliente
  let ultimosBackups: Array<Record<string, unknown>> = [];
  try {
    const { data: bks } = await adminSupabase
      .from('backups_negocio')
      .select('id, negocio_id, negocio_nombre, negocio_slug, version, tipo, tamano_bytes, creado_por_email, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (bks) ultimosBackups = bks;
  } catch {
    // Si aún no corrió migración 003
  }

  const { data: auditoriaReciente } = await adminSupabase
    .from('auditoria_accesos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(incluirAuditoria ? 250 : 40);

  const ahoraMs = Date.now();
  const sieteDiasMs = 7 * 24 * 60 * 60 * 1000;

  // Mapa de último backup por negocio
  const mapaUltimoBackup = new Map<string, string>();
  for (const b of ultimosBackups) {
    const negId = String(b.negocio_id || '');
    if (negId && !mapaUltimoBackup.has(negId)) {
      mapaUltimoBackup.set(negId, String(b.created_at));
    }
  }

  const negociosConEstado = (negocios || []).map((neg) => {
    const diasRestantes = calcularDiasRestantes(neg.fecha_vencimiento);
    const estadoVencimiento = getEstadoVencimiento(diasRestantes);
    const adminUser =
      neg.usuarios?.find((u: { role: string }) => u.role === 'admin') || null;

    const ultimoBackup =
      neg.ultimo_backup_at || mapaUltimoBackup.get(neg.id) || null;
    const diasSinBackup = ultimoBackup
      ? Math.floor((ahoraMs - new Date(ultimoBackup).getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const alertaSinBackup =
      !ultimoBackup || ahoraMs - new Date(ultimoBackup).getTime() > sieteDiasMs;

    return {
      ...neg,
      dias_restantes: diasRestantes,
      estado_vencimiento: estadoVencimiento,
      admin_user: adminUser,
      ultimo_backup_at: ultimoBackup,
      dias_sin_backup: diasSinBackup,
      alerta_sin_backup: alertaSinBackup,
      salud_estado: neg.salud_estado || 'sin_diagnosticar',
    };
  });

  // Detectar intentos fallidos recientes de login al SuperAdmin (últimas 24h)
  const hace24h = nowMinusHours(24);
  const intentosFallidosRecientes = (auditoriaReciente || []).filter(
    (a) => a.evento === 'superadmin_login_failed' && a.created_at >= hace24h
  );

  return NextResponse.json({
    negocios: negociosConEstado,
    ultimos_backups: ultimosBackups,
    auditoria_reciente: auditoriaReciente || [],
    intentos_fallidos_recientes: intentosFallidosRecientes.length,
  });
}

function nowMinusHours(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;

  try {
    const body = await req.json();
    const {
      nombre,
      slug,
      logo_url,
      plan_id,
      duracion_dias_personalizada,
      admin_email,
      admin_nombre,
      admin_telefono,
      password_momentanea,
    } = body;

    if (!nombre || !admin_email || !password_momentanea) {
      return NextResponse.json(
        {
          error:
            'El nombre del negocio, email y contraseña momentánea del administrador son requeridos.',
        },
        { status: 400 }
      );
    }

    if (String(password_momentanea).length < 6) {
      return NextResponse.json(
        { error: 'La contraseña momentánea debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const cleanSlug = slugify(slug || nombre);

    // Comprobar slug único
    const { data: existingSlug } = await adminSupabase
      .from('negocios')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json(
        { error: `El slug '${cleanSlug}' ya se encuentra en uso por otro negocio.` },
        { status: 400 }
      );
    }

    // Calcular fecha de vencimiento según plan o días indicados
    let dias = 30;
    if (duracion_dias_personalizada) {
      dias = parseInt(String(duracion_dias_personalizada), 10) || 30;
    } else if (plan_id) {
      const { data: planData } = await adminSupabase
        .from('planes')
        .select('duracion_dias')
        .eq('id', plan_id)
        .single();
      if (planData) dias = planData.duracion_dias;
    }

    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + dias);

    // 1. Insertar el negocio
    const { data: nuevoNegocio, error: negError } = await adminSupabase
      .from('negocios')
      .insert({
        nombre: nombre.trim(),
        slug: cleanSlug,
        logo_url: logo_url || null,
        plan_id: plan_id || null,
        fecha_vencimiento: fechaVencimiento.toISOString(),
        activo: true,
      })
      .select()
      .single();

    if (negError) {
      return NextResponse.json({ error: negError.message }, { status: 500 });
    }

    // 2. Crear usuario administrador en Auth con contraseña momentánea (siempre hasheada en Auth)
    const { data: authUser, error: authUserError } =
      await adminSupabase.auth.admin.createUser({
        email: admin_email.trim().toLowerCase(),
        password: password_momentanea,
        email_confirm: true,
        user_metadata: {
          nombre: admin_nombre?.trim() || 'Administrador',
          role: 'admin',
          negocio_id: nuevoNegocio.id,
        },
      });

    if (authUserError || !authUser.user) {
      // Revertir creación de negocio
      await adminSupabase.from('negocios').delete().eq('id', nuevoNegocio.id);
      return NextResponse.json(
        { error: `Error creando usuario administrador: ${authUserError?.message}` },
        { status: 500 }
      );
    }

    // 3. Crear registro en public.usuarios con must_change_password = true
    const { error: usuarioError } = await adminSupabase.from('usuarios').insert({
      id: authUser.user.id,
      negocio_id: nuevoNegocio.id,
      email: admin_email.trim().toLowerCase(),
      nombre: admin_nombre?.trim() || 'Administrador',
      telefono: admin_telefono?.trim() || null,
      role: 'admin',
      must_change_password: true,
      activo: true,
    });

    if (usuarioError) {
      await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      await adminSupabase.from('negocios').delete().eq('id', nuevoNegocio.id);
      return NextResponse.json({ error: usuarioError.message }, { status: 500 });
    }

    // Registrar en auditoría (NUNCA se guarda la contraseña en texto plano)
    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_create_negocio',
      metadata: {
        negocio_id: nuevoNegocio.id,
        nombre: nuevoNegocio.nombre,
        slug: cleanSlug,
        admin_email: admin_email.trim().toLowerCase(),
        admin_telefono: admin_telefono?.trim() || null,
        dias_iniciales: dias,
      },
    });

    return NextResponse.json({
      success: true,
      negocio: nuevoNegocio,
      credenciales_unicas: {
        negocio_nombre: nuevoNegocio.nombre,
        slug: cleanSlug,
        email: admin_email.trim().toLowerCase(),
        nombre: admin_nombre?.trim() || 'Administrador',
        telefono: admin_telefono?.trim() || '',
        password_momentanea,
        must_change_password: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
