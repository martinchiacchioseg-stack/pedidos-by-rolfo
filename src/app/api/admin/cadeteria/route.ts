import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET() {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile, negocio } = auth;

  const { data: cadetes, error } = await adminSupabase
    .from('cadetes')
    .select('*, usuario:usuarios(id, email, nombre, activo, must_change_password, acepto_privacidad_gps)')
    .eq('negocio_id', profile.negocio_id)
    .order('es_predeterminado', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    cadetes: cadetes || [],
    negocio,
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const {
      tipo,
      nombre,
      telefono_whatsapp,
      es_predeterminado,
      email,
      password_momentanea,
    } = body;

    if (!nombre || !nombre.trim() || !telefono_whatsapp || !telefono_whatsapp.trim()) {
      return NextResponse.json(
        { error: 'El nombre y el número de WhatsApp son obligatorios.' },
        { status: 400 }
      );
    }

    const tipoValido = tipo === 'externa' ? 'externa' : 'propio';
    let usuarioId: string | null = null;

    if (tipoValido === 'propio') {
      if (!email || !email.trim() || !password_momentanea || password_momentanea.length < 6) {
        return NextResponse.json(
          {
            error:
              'Para un cadete propio debés indicar email de acceso y una contraseña momentánea (mínimo 6 caracteres).',
          },
          { status: 400 }
        );
      }

      // Crear cuenta en Supabase Auth
      const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password_momentanea,
        email_confirm: true,
        user_metadata: {
          nombre: nombre.trim(),
          role: 'cadete',
        },
      });

      if (authErr || !authData.user) {
        return NextResponse.json(
          { error: authErr?.message || 'No se pudo crear el usuario del cadete' },
          { status: 400 }
        );
      }

      usuarioId = authData.user.id;

      // Insertar perfil en public.usuarios con must_change_password = true
      const { error: usrErr } = await adminSupabase.from('usuarios').upsert({
        id: usuarioId,
        negocio_id: profile.negocio_id,
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        telefono: telefono_whatsapp.trim(),
        role: 'cadete',
        must_change_password: true,
        activo: true,
      });

      if (usrErr) {
        await adminSupabase.auth.admin.deleteUser(usuarioId);
        throw new Error(usrErr.message);
      }
    }

    // Si es predeterminado, desmarcar los anteriores del mismo negocio
    if (es_predeterminado) {
      await adminSupabase
        .from('cadetes')
        .update({ es_predeterminado: false })
        .eq('negocio_id', profile.negocio_id);
    }

    const { data: nuevoCadete, error: cadErr } = await adminSupabase
      .from('cadetes')
      .insert({
        negocio_id: profile.negocio_id,
        tipo: tipoValido,
        usuario_id: usuarioId,
        nombre: nombre.trim(),
        telefono_whatsapp: telefono_whatsapp.trim(),
        es_predeterminado: Boolean(es_predeterminado),
        activo: true,
      })
      .select('*, usuario:usuarios(id, email, nombre, activo, must_change_password, acepto_privacidad_gps)')
      .single();

    if (cadErr) {
      if (usuarioId) {
        await adminSupabase.auth.admin.deleteUser(usuarioId);
      }
      throw new Error(cadErr.message);
    }

    return NextResponse.json({
      success: true,
      cadete: nuevoCadete,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al registrar cadete';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const {
      id,
      nombre,
      telefono_whatsapp,
      activo,
      es_predeterminado,
      nueva_password_momentanea,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de cadete requerido' }, { status: 400 });
    }

    const { data: actual } = await adminSupabase
      .from('cadetes')
      .select('*')
      .eq('id', id)
      .eq('negocio_id', profile.negocio_id)
      .single();

    if (!actual) {
      return NextResponse.json({ error: 'Cadete no encontrado' }, { status: 404 });
    }

    if (es_predeterminado) {
      await adminSupabase
        .from('cadetes')
        .update({ es_predeterminado: false })
        .eq('negocio_id', profile.negocio_id);
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (telefono_whatsapp !== undefined) updateData.telefono_whatsapp = telefono_whatsapp.trim();
    if (activo !== undefined) updateData.activo = Boolean(activo);
    if (es_predeterminado !== undefined) updateData.es_predeterminado = Boolean(es_predeterminado);

    const { data: updated, error: updErr } = await adminSupabase
      .from('cadetes')
      .update(updateData)
      .eq('id', id)
      .eq('negocio_id', profile.negocio_id)
      .select('*, usuario:usuarios(id, email, nombre, activo, must_change_password, acepto_privacidad_gps)')
      .single();

    if (updErr) throw new Error(updErr.message);

    // Sincronizar con public.usuarios si es cadete propio
    if (actual.usuario_id) {
      const userUpd: Record<string, unknown> = {};
      if (nombre !== undefined) userUpd.nombre = nombre.trim();
      if (telefono_whatsapp !== undefined) userUpd.telefono = telefono_whatsapp.trim();
      if (activo !== undefined) userUpd.activo = Boolean(activo);

      if (nueva_password_momentanea && nueva_password_momentanea.length >= 6) {
        const { error: passErr } = await adminSupabase.auth.admin.updateUserById(
          actual.usuario_id,
          { password: nueva_password_momentanea }
        );
        if (passErr) throw new Error(passErr.message);
        userUpd.must_change_password = true;
      }

      if (Object.keys(userUpd).length > 0) {
        await adminSupabase
          .from('usuarios')
          .update(userUpd)
          .eq('id', actual.usuario_id)
          .eq('negocio_id', profile.negocio_id);
      }
    }

    return NextResponse.json({
      success: true,
      cadete: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al actualizar cadete';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
