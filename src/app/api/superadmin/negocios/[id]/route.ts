import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { slugify } from '@/lib/utils';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { id } = await params;

  try {
    const body = await req.json();
    const {
      nombre,
      slug,
      logo_url,
      plan_id,
      fecha_vencimiento,
      dias_a_extender,
      activo,
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (plan_id !== undefined) updates.plan_id = plan_id;
    if (activo !== undefined) updates.activo = Boolean(activo);

    if (slug) {
      const cleanSlug = slugify(slug);
      // Validar que el slug no esté en uso por otro negocio
      const { data: existing } = await adminSupabase
        .from('negocios')
        .select('id')
        .eq('slug', cleanSlug)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: `El slug '${cleanSlug}' ya pertenece a otro negocio.` }, { status: 400 });
      }
      updates.slug = cleanSlug;
    }

    // Extensión o actualización de vencimiento
    if (dias_a_extender) {
      const { data: currentNegocio } = await adminSupabase
        .from('negocios')
        .select('fecha_vencimiento')
        .eq('id', id)
        .single();

      const baseDate = currentNegocio?.fecha_vencimiento
        ? new Date(Math.max(new Date(currentNegocio.fecha_vencimiento).getTime(), Date.now()))
        : new Date();

      baseDate.setDate(baseDate.getDate() + parseInt(dias_a_extender, 10));
      updates.fecha_vencimiento = baseDate.toISOString();
    } else if (fecha_vencimiento) {
      updates.fecha_vencimiento = new Date(fecha_vencimiento).toISOString();
    }

    const { data: updated, error } = await adminSupabase
      .from('negocios')
      .update(updates)
      .eq('id', id)
      .select('*, plan:planes(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_update_negocio',
      metadata: { negocio_id: id, updates },
    });

    return NextResponse.json({ success: true, negocio: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { id } = await params;

  try {
    // Buscar usuarios del negocio para eliminarlos de Auth también
    const { data: usuarios } = await adminSupabase
      .from('usuarios')
      .select('id')
      .eq('negocio_id', id);

    if (usuarios && usuarios.length > 0) {
      for (const u of usuarios) {
        await adminSupabase.auth.admin.deleteUser(u.id);
      }
    }

    // Eliminar negocio (cascada eliminará categorías, productos, pedidos, etc.)
    const { error } = await adminSupabase
      .from('negocios')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_delete_negocio',
      metadata: { negocio_id: id },
    });

    return NextResponse.json({ success: true, message: 'Negocio eliminado correctamente' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
