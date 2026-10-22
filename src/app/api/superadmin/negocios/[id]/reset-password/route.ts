import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';

function generarPasswordMomentanea(longitud = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < longitud; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { id: negocioId } = await params;

  try {
    const body = await req.json();
    const { usuario_id, nueva_password } = body;

    let targetUserId = usuario_id;

    // Si no se especifica usuario, buscar al admin del negocio
    if (!targetUserId) {
      const { data: adminUser } = await adminSupabase
        .from('usuarios')
        .select('id, email')
        .eq('negocio_id', negocioId)
        .eq('role', 'admin')
        .single();

      if (!adminUser) {
        return NextResponse.json({ error: 'No se encontró un administrador para este negocio' }, { status: 404 });
      }
      targetUserId = adminUser.id;
    }

    const passwordGenerada = nueva_password || generarPasswordMomentanea();

    // 1. Actualizar contraseña en Auth
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
      password: passwordGenerada,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // 2. Forzar must_change_password = true
    const { data: usuarioActualizado, error: userError } = await adminSupabase
      .from('usuarios')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .select('id, email, nombre, role')
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Registrar en auditoría
    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_reset_password',
      metadata: { target_user_id: targetUserId, negocio_id: negocioId },
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Contraseña momentánea generada con éxito.',
      password_momentanea: passwordGenerada,
      usuario: usuarioActualizado,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
