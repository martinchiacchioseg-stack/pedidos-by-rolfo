import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdmin,
  verifySuperAdminPassword,
  construirYGuardarBackupNegocio,
} from '@/lib/auth-server';
import { calcularDiasRestantes, getEstadoVencimiento, slugify } from '@/lib/utils';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { id } = await params;

  try {
    const { data: negocio, error: negErr } = await adminSupabase
      .from('negocios')
      .select('*, plan:planes(*)')
      .eq('id', id)
      .single();

    if (negErr || !negocio) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }

    // Usuarios del negocio
    const { data: usuariosDb } = await adminSupabase
      .from('usuarios')
      .select('*')
      .eq('negocio_id', id)
      .order('created_at', { ascending: true });

    // Enriquecer con last_sign_in_at desde Supabase Auth
    const { data: authUsersData } = await adminSupabase.auth.admin.listUsers();
    const authMap = new Map(
      (authUsersData?.users || []).map((u) => [u.id, u.last_sign_in_at || null])
    );

    const usuariosEnriquecidos = (usuariosDb || []).map((u) => ({
      ...u,
      ultimo_ingreso: authMap.get(u.id) || null,
    }));

    // Backups realizados en este negocio
    let backups: Array<Record<string, unknown>> = [];
    try {
      const { data: bks } = await adminSupabase
        .from('backups_negocio')
        .select(
          'id, negocio_id, negocio_nombre, negocio_slug, version, tipo, descripcion, tamano_bytes, creado_por_email, estadisticas, created_at'
        )
        .eq('negocio_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (bks) backups = bks;
    } catch {
      // Resiliente si aún no se migró la tabla
    }

    // Historial de diagnósticos
    let diagnosticos: Array<Record<string, unknown>> = [];
    try {
      const { data: diags } = await adminSupabase
        .from('diagnosticos_negocio')
        .select('*')
        .eq('negocio_id', id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (diags) diagnosticos = diags;
    } catch {
      // Resiliente
    }

    // Historial de auditoría de este negocio (por columna negocio_id o metadata->negocio_id)
    const { data: todasAuditorias } = await adminSupabase
      .from('auditoria_accesos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    const auditoriaNegocio = (todasAuditorias || []).filter(
      (a: { negocio_id?: string | null; metadata?: Record<string, unknown> | null }) =>
        a.negocio_id === id || a.metadata?.negocio_id === id
    );

    const diasRestantes = calcularDiasRestantes(negocio.fecha_vencimiento);
    const estadoVencimiento = getEstadoVencimiento(diasRestantes);

    return NextResponse.json({
      negocio: {
        ...negocio,
        dias_restantes: diasRestantes,
        estado_vencimiento: estadoVencimiento,
      },
      usuarios: usuariosEnriquecidos,
      backups,
      diagnosticos,
      auditoria: auditoriaNegocio,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
      banner_url,
      slogan,
      telefono,
      whatsapp_numero,
      direccion_local,
      color_primario,
      color_secundario,
      tipografia_id,
      abierto_manual,
      modo_apertura,
      horarios,
      horarios_semanales,
      tiempo_preparacion_min,
      mensaje_bienvenida,
      mensaje_cierre,
      plan_id,
      fecha_vencimiento,
      dias_a_extender,
      renovar_un_toque,
      activo,
      motivo_cambio,
    } = body;

    // Obtener estado previo del negocio para el historial de cambios
    const { data: currentNegocio, error: fetchErr } = await adminSupabase
      .from('negocios')
      .select('*, plan:planes(*)')
      .eq('id', id)
      .single();

    if (fetchErr || !currentNegocio) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url || null;
    if (banner_url !== undefined) updates.banner_url = banner_url || null;
    if (slogan !== undefined) updates.slogan = slogan || null;
    if (telefono !== undefined) updates.telefono = telefono || null;
    if (whatsapp_numero !== undefined) updates.whatsapp_numero = whatsapp_numero || null;
    if (direccion_local !== undefined) updates.direccion_local = direccion_local || null;
    if (color_primario !== undefined) updates.color_primario = color_primario;
    if (color_secundario !== undefined) updates.color_secundario = color_secundario;
    if (tipografia_id !== undefined) updates.tipografia_id = tipografia_id;
    if (abierto_manual !== undefined) updates.abierto_manual = Boolean(abierto_manual);
    if (modo_apertura !== undefined) updates.modo_apertura = modo_apertura;
    if (horarios !== undefined) updates.horarios = horarios;
    if (horarios_semanales !== undefined) updates.horarios_semanales = horarios_semanales;
    if (tiempo_preparacion_min !== undefined)
      updates.tiempo_preparacion_min = Number(tiempo_preparacion_min) || 30;
    if (mensaje_bienvenida !== undefined) updates.mensaje_bienvenida = mensaje_bienvenida;
    if (mensaje_cierre !== undefined) updates.mensaje_cierre = mensaje_cierre;
    if (plan_id !== undefined) updates.plan_id = plan_id || null;
    if (activo !== undefined) updates.activo = Boolean(activo);

    if (slug) {
      const cleanSlug = slugify(slug);
      const { data: existing } = await adminSupabase
        .from('negocios')
        .select('id')
        .eq('slug', cleanSlug)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `El slug '${cleanSlug}' ya pertenece a otro negocio.` },
          { status: 400 }
        );
      }
      updates.slug = cleanSlug;
    }

    // Cálculo de fecha de vencimiento (sumar/restar días, renovar con 1 toque, o fecha exacta)
    if (renovar_un_toque) {
      let diasPlan = currentNegocio.plan?.duracion_dias || 30;
      if (plan_id && plan_id !== currentNegocio.plan_id) {
        const { data: nuevoPlan } = await adminSupabase
          .from('planes')
          .select('duracion_dias')
          .eq('id', plan_id)
          .single();
        if (nuevoPlan) diasPlan = nuevoPlan.duracion_dias;
      }
      const baseMs = currentNegocio.fecha_vencimiento
        ? Math.max(new Date(currentNegocio.fecha_vencimiento).getTime(), Date.now())
        : Date.now();
      const nuevaFecha = new Date(baseMs + diasPlan * 24 * 60 * 60 * 1000);
      updates.fecha_vencimiento = nuevaFecha.toISOString();
      updates.activo = true; // Al renovar se reactiva automáticamente (Sección C)
    } else if (dias_a_extender !== undefined && dias_a_extender !== null && dias_a_extender !== '') {
      const deltaDias = parseInt(String(dias_a_extender), 10);
      if (!Number.isNaN(deltaDias)) {
        const baseDate = currentNegocio.fecha_vencimiento
          ? new Date(
              deltaDias > 0
                ? Math.max(new Date(currentNegocio.fecha_vencimiento).getTime(), Date.now())
                : new Date(currentNegocio.fecha_vencimiento).getTime()
            )
          : new Date();
        baseDate.setDate(baseDate.getDate() + deltaDias);
        updates.fecha_vencimiento = baseDate.toISOString();
        if (calcularDiasRestantes(updates.fecha_vencimiento as string) > 0 && activo === undefined) {
          updates.activo = true;
        }
      }
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

    // Registrar historial detallado en auditoría
    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_update_negocio',
      metadata: {
        negocio_id: id,
        negocio_nombre: updated.nombre,
        motivo: motivo_cambio || 'Actualización desde ficha del Súper Admin',
        antes: {
          plan_id: currentNegocio.plan_id,
          fecha_vencimiento: currentNegocio.fecha_vencimiento,
          activo: currentNegocio.activo,
        },
        despues: {
          plan_id: updated.plan_id,
          fecha_vencimiento: updated.fecha_vencimiento,
          activo: updated.activo,
        },
        campos_modificados: Object.keys(updates).filter((k) => k !== 'updated_at'),
      },
    });

    return NextResponse.json({ success: true, negocio: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, user } = auth;
  const { id } = await params;

  try {
    let body: { confirmacion_nombre?: string; superadmin_password?: string } = {};
    try {
      body = await req.json();
    } catch {
      // body vacío
    }

    // 1. Obtener negocio para validar nombre exacto
    const { data: negocio } = await adminSupabase
      .from('negocios')
      .select('id, nombre, slug')
      .eq('id', id)
      .single();

    if (!negocio) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }

    if (
      body.confirmacion_nombre !== undefined &&
      body.confirmacion_nombre.trim() !== negocio.nombre.trim()
    ) {
      return NextResponse.json(
        { error: `Debés escribir exactamente el nombre del negocio ("${negocio.nombre}") para confirmar.` },
        { status: 400 }
      );
    }

    // 2. Re-validar contraseña del Súper Admin (Sección A)
    const passCheck = await verifySuperAdminPassword(
      user.email || '',
      body.superadmin_password
    );
    if (!passCheck.valid) {
      return NextResponse.json({ error: passCheck.error }, { status: 403 });
    }

    // 3. Generar backup previo de seguridad antes de eliminar
    let backupPrevio = null;
    try {
      const resBackup = await construirYGuardarBackupNegocio(adminSupabase, id, {
        tipo: 'pre_eliminacion',
        descripcion: `Backup automático previo a eliminación de ${negocio.nombre}`,
        userId: user.id,
        userEmail: user.email,
        persistirEnTabla: false,
      });
      backupPrevio = resBackup.backupPayload;
    } catch {
      // Continuar
    }

    // 4. Buscar usuarios del negocio para eliminarlos de Auth
    const { data: usuarios } = await adminSupabase
      .from('usuarios')
      .select('id')
      .eq('negocio_id', id);

    if (usuarios && usuarios.length > 0) {
      for (const u of usuarios) {
        await adminSupabase.auth.admin.deleteUser(u.id);
      }
    }

    // 5. Eliminar negocio
    const { error } = await adminSupabase.from('negocios').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: user.id,
      email: user.email,
      evento: 'superadmin_delete_negocio',
      metadata: {
        negocio_id: id,
        negocio_nombre: negocio.nombre,
        slug: negocio.slug,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Negocio eliminado correctamente',
      backup_previo: backupPrevio,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
