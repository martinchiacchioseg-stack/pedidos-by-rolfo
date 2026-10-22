import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';
import { limpiarNumeroWhatsApp, validarNumeroWhatsApp } from '@/lib/utils';

export async function GET() {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  const { data: negocio, error } = await adminSupabase
    .from('negocios')
    .select('*')
    .eq('id', profile.negocio_id)
    .single();

  if (error || !negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ negocio });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const {
      nombre,
      logo_url,
      color_primario,
      color_secundario,
      telefono,
      whatsapp_numero,
      horarios,
      mensaje_bienvenida,
      mensaje_cierre,
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (color_primario !== undefined) updates.color_primario = color_primario;
    if (color_secundario !== undefined) updates.color_secundario = color_secundario;
    if (telefono !== undefined) updates.telefono = telefono;
    if (horarios !== undefined) updates.horarios = horarios;
    if (mensaje_bienvenida !== undefined) updates.mensaje_bienvenida = mensaje_bienvenida;
    if (mensaje_cierre !== undefined) updates.mensaje_cierre = mensaje_cierre;

    // Validación estricta del número de WhatsApp si se envía
    if (whatsapp_numero !== undefined) {
      if (whatsapp_numero === null || whatsapp_numero === '') {
        updates.whatsapp_numero = null;
      } else {
        const clean = limpiarNumeroWhatsApp(whatsapp_numero);
        if (!validarNumeroWhatsApp(clean)) {
          return NextResponse.json(
            { error: 'El número de WhatsApp ingresado no tiene un formato internacional válido (ej: 5491112345678).' },
            { status: 400 }
          );
        }
        updates.whatsapp_numero = clean;
      }
    }

    const { data: updated, error } = await adminSupabase
      .from('negocios')
      .update(updates)
      .eq('id', profile.negocio_id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, negocio: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
