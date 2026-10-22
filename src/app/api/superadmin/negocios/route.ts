import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { calcularDiasRestantes, getEstadoVencimiento, slugify } from '@/lib/utils';

export async function GET() {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;

  // Obtener negocios con sus planes y usuarios administradores
  const { data: negocios, error } = await adminSupabase
    .from('negocios')
    .select(`
      *,
      plan:planes(*),
      usuarios(id, email, nombre, role, must_change_password, activo)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enriquecer con cálculo de días y semáforo
  const negociosConEstado = negocios.map((neg) => {
    const diasRestantes = calcularDiasRestantes(neg.fecha_vencimiento);
    const estadoVencimiento = getEstadoVencimiento(diasRestantes);
    const adminUser = neg.usuarios?.find((u: { role: string }) => u.role === 'admin') || null;

    return {
      ...neg,
      dias_restantes: diasRestantes,
      estado_vencimiento: estadoVencimiento,
      admin_user: adminUser,
    };
  });

  return NextResponse.json({ negocios: negociosConEstado });
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
      password_momentanea,
    } = body;

    if (!nombre || !admin_email || !password_momentanea) {
      return NextResponse.json(
        { error: 'El nombre del negocio, email y contraseña del administrador son requeridos.' },
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
        { error: `El slug '${cleanSlug}' ya se encuentra en uso.` },
        { status: 400 }
      );
    }

    // Calcular fecha de vencimiento según plan
    let dias = 30;
    if (duracion_dias_personalizada) {
      dias = parseInt(duracion_dias_personalizada, 10);
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
    // NOTA: El número de WhatsApp NO lo define el súper admin (lo carga el propio admin del negocio)
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

    // 2. Crear usuario administrador en Auth con contraseña momentánea
    const { data: authUser, error: authUserError } = await adminSupabase.auth.admin.createUser({
      email: admin_email.trim(),
      password: password_momentanea,
      email_confirm: true,
      user_metadata: {
        nombre: admin_nombre || 'Administrador',
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
      email: admin_email.trim(),
      nombre: admin_nombre || 'Administrador',
      role: 'admin',
      must_change_password: true, // OBLIGADO a cambiar en el primer ingreso
      activo: true,
    });

    if (usuarioError) {
      return NextResponse.json({ error: usuarioError.message }, { status: 500 });
    }

    // Registrar en auditoría
    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_create_negocio',
      metadata: { negocio_id: nuevoNegocio.id, nombre: nuevoNegocio.nombre, slug: cleanSlug },
    });

    return NextResponse.json({
      success: true,
      negocio: nuevoNegocio,
      admin: {
        id: authUser.user.id,
        email: admin_email,
        must_change_password: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
