import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, verifySuperAdminPassword } from '@/lib/auth-server';

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

  const { adminSupabase, user } = auth;
  const { id: negocioId } = await params;

  try {
    const body = await req.json();
    const {
      accion = 'reset_password',
      usuario_id,
      nueva_password,
      superadmin_password,
      nuevo_email,
      nombre,
      telefono,
      role,
      activo,
    } = body;

    // 1. Registrar en auditoría el envío de credenciales por WhatsApp (Sección D)
    if (accion === 'registrar_envio_whatsapp') {
      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_send_credentials_whatsapp',
        metadata: {
          negocio_id: negocioId,
          target_user_id: usuario_id || null,
          target_email: nuevo_email || null,
          telefono_destino: telefono || null,
        },
      });
      return NextResponse.json({ success: true });
    }

    // 2. Activar / Desactivar usuario del negocio
    if (accion === 'toggle_activo') {
      if (!usuario_id) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }
      const { data: updated, error } = await adminSupabase
        .from('usuarios')
        .update({
          activo: Boolean(activo),
          updated_at: new Date().toISOString(),
        })
        .eq('id', usuario_id)
        .eq('negocio_id', negocioId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      if (updated.role === 'cadete') {
        await adminSupabase
          .from('cadetes')
          .update({ activo: Boolean(activo) })
          .eq('usuario_id', usuario_id)
          .eq('negocio_id', negocioId);
      }

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_toggle_user_status',
        metadata: {
          negocio_id: negocioId,
          target_user_id: usuario_id,
          target_email: updated.email,
          activo: Boolean(activo),
        },
      });

      return NextResponse.json({ success: true, usuario: updated });
    }

    // 3. Cambiar email o datos de usuario del negocio
    if (accion === 'cambiar_email') {
      if (!usuario_id || !nuevo_email || !nuevo_email.trim()) {
        return NextResponse.json(
          { error: 'ID de usuario y nuevo email son obligatorios.' },
          { status: 400 }
        );
      }

      const cleanEmail = nuevo_email.trim().toLowerCase();

      const { error: authErr } = await adminSupabase.auth.admin.updateUserById(usuario_id, {
        email: cleanEmail,
        email_confirm: true,
      });
      if (authErr) throw new Error(authErr.message);

      const updateFields: Record<string, unknown> = {
        email: cleanEmail,
        updated_at: new Date().toISOString(),
      };
      if (nombre !== undefined) updateFields.nombre = nombre.trim();
      if (telefono !== undefined) updateFields.telefono = telefono.trim() || null;

      const { data: updated, error: dbErr } = await adminSupabase
        .from('usuarios')
        .update(updateFields)
        .eq('id', usuario_id)
        .eq('negocio_id', negocioId)
        .select('*')
        .single();

      if (dbErr) throw new Error(dbErr.message);

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_change_user_email',
        metadata: {
          negocio_id: negocioId,
          target_user_id: usuario_id,
          nuevo_email: cleanEmail,
        },
      });

      return NextResponse.json({ success: true, usuario: updated });
    }

    // 4. Crear nuevo administrador (o vendedor/cadete) para el negocio
    if (accion === 'crear_usuario') {
      if (!nuevo_email || !nombre) {
        return NextResponse.json(
          { error: 'Nombre y email son obligatorios para crear el usuario.' },
          { status: 400 }
        );
      }

      const rolValido =
        role === 'vendedor' ? 'vendedor' : role === 'cadete' ? 'cadete' : 'admin';
      const passwordGenerada = nueva_password || generarPasswordMomentanea();
      const cleanEmail = nuevo_email.trim().toLowerCase();

      const { data: authData, error: createErr } =
        await adminSupabase.auth.admin.createUser({
          email: cleanEmail,
          password: passwordGenerada,
          email_confirm: true,
          user_metadata: {
            nombre: nombre.trim(),
            role: rolValido,
            negocio_id: negocioId,
          },
        });

      if (createErr || !authData.user) {
        return NextResponse.json(
          { error: createErr?.message || 'No se pudo crear el usuario en Auth' },
          { status: 400 }
        );
      }

      const { data: nuevoUsr, error: usrErr } = await adminSupabase
        .from('usuarios')
        .insert({
          id: authData.user.id,
          negocio_id: negocioId,
          email: cleanEmail,
          nombre: nombre.trim(),
          telefono: telefono?.trim() || null,
          role: rolValido,
          must_change_password: true,
          activo: true,
        })
        .select('*')
        .single();

      if (usrErr) {
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(usrErr.message);
      }

      if (rolValido === 'cadete') {
        await adminSupabase.from('cadetes').insert({
          negocio_id: negocioId,
          tipo: 'propio',
          usuario_id: authData.user.id,
          nombre: nombre.trim(),
          telefono_whatsapp: telefono?.trim() || '',
          es_predeterminado: false,
          activo: true,
        });
      }

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_create_business_user',
        metadata: {
          negocio_id: negocioId,
          target_user_id: authData.user.id,
          target_email: cleanEmail,
          role: rolValido,
        },
      });

      return NextResponse.json({
        success: true,
        usuario: nuevoUsr,
        password_momentanea: passwordGenerada,
      });
    }

    // 5. ACCIÓN SENSIBLE: Resetear contraseña de un usuario del negocio
    // Exige validar la contraseña actual del Súper Administrador (Sección A y D)
    const passCheck = await verifySuperAdminPassword(user.email || '', superadmin_password);
    if (!passCheck.valid) {
      return NextResponse.json({ error: passCheck.error }, { status: 403 });
    }

    let targetUserId = usuario_id;

    if (!targetUserId) {
      const { data: adminUser } = await adminSupabase
        .from('usuarios')
        .select('id, email')
        .eq('negocio_id', negocioId)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (!adminUser) {
        return NextResponse.json(
          { error: 'No se encontró un administrador para este negocio' },
          { status: 404 }
        );
      }
      targetUserId = adminUser.id;
    }

    const passwordGenerada =
      nueva_password && String(nueva_password).length >= 6
        ? String(nueva_password)
        : generarPasswordMomentanea();

    // Actualizar contraseña en Auth (hasheada)
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(
      targetUserId,
      {
        password: passwordGenerada,
      }
    );

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Forzar must_change_password = true
    const { data: usuarioActualizado, error: userError } = await adminSupabase
      .from('usuarios')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .eq('negocio_id', negocioId)
      .select('id, email, nombre, telefono, role, must_change_password, activo')
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Registrar en auditoría (NUNCA se guarda la contraseña en texto plano)
    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: user.id,
      email: user.email,
      evento: 'superadmin_reset_password',
      metadata: {
        negocio_id: negocioId,
        target_user_id: targetUserId,
        target_email: usuarioActualizado.email,
        target_role: usuarioActualizado.role,
      },
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
