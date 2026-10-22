import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET() {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  const { data: empleados, error } = await adminSupabase
    .from('usuarios')
    .select('id, email, nombre, role, must_change_password, activo, created_at')
    .eq('negocio_id', profile.negocio_id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ empleados: empleados || [] });
}

export async function POST(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const { email, nombre, telefono, role, password_momentanea } = body;

    if (!email || !nombre || !password_momentanea) {
      return NextResponse.json({ error: 'Email, nombre y contraseña provisoria son requeridos' }, { status: 400 });
    }

    const rolAsignado = role === 'admin' ? 'admin' : role === 'cadete' ? 'cadete' : 'vendedor';

    // 1. Crear en Supabase Auth
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.trim(),
      password: password_momentanea,
      email_confirm: true,
      user_metadata: {
        nombre: nombre.trim(),
        role: rolAsignado,
        negocio_id: profile.negocio_id,
      },
    });

    if (authError || !authUser.user) {
      throw new Error(authError?.message || 'Error al crear usuario en autenticación');
    }

    // 2. Insertar en public.usuarios con must_change_password = true
    const { data: nuevoUsuario, error: userError } = await adminSupabase
      .from('usuarios')
      .insert({
        id: authUser.user.id,
        negocio_id: profile.negocio_id,
        email: email.trim(),
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        role: rolAsignado,
        must_change_password: true,
        activo: true,
      })
      .select()
      .single();

    if (userError) throw new Error(userError.message);

    // 3. Si es cadete, crear su ficha en public.cadetes
    if (rolAsignado === 'cadete') {
      await adminSupabase.from('cadetes').insert({
        negocio_id: profile.negocio_id,
        tipo: 'propio',
        usuario_id: authUser.user.id,
        nombre: nombre.trim(),
        telefono_whatsapp: telefono?.trim() || '',
        es_predeterminado: false,
        activo: true,
      });
    }

    return NextResponse.json({ success: true, empleado: nuevoUsuario });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const { empleado_id, accion, valor } = body;

    if (!empleado_id) {
      return NextResponse.json({ error: 'ID de empleado requerido' }, { status: 400 });
    }

    if (accion === 'toggle_activo') {
      const { data: updated, error } = await adminSupabase
        .from('usuarios')
        .update({ activo: Boolean(valor), updated_at: new Date().toISOString() })
        .eq('id', empleado_id)
        .eq('negocio_id', profile.negocio_id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, empleado: updated });
    }

    if (accion === 'reset_password') {
      const nuevaClave = valor || 'Clave@' + Math.floor(1000 + Math.random() * 9000);
      
      await adminSupabase.auth.admin.updateUserById(empleado_id, {
        password: nuevaClave,
      });

      const { data: updated, error } = await adminSupabase
        .from('usuarios')
        .update({ must_change_password: true, updated_at: new Date().toISOString() })
        .eq('id', empleado_id)
        .eq('negocio_id', profile.negocio_id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return NextResponse.json({
        success: true,
        password_momentanea: nuevaClave,
        empleado: updated,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
