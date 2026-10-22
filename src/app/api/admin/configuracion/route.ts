import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';
import { limpiarNumeroWhatsApp, validarNumeroWhatsApp } from '@/lib/utils';
import { calcularEstadoApertura } from '@/lib/horarios';

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

  const estadoApertura = calcularEstadoApertura(negocio);

  return NextResponse.json({
    negocio: {
      ...negocio,
      abierto_efectivo: estadoApertura.abierto,
      proximo_horario_texto: estadoApertura.proximoHorarioTexto,
    },
  });
}

// Interruptor rápido Abierto / Cerrado desde la cabecera del panel
export async function PATCH(req: NextRequest) {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const { abierto_manual, modo_apertura } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (abierto_manual !== undefined) updates.abierto_manual = Boolean(abierto_manual);
    if (modo_apertura !== undefined && profile.role === 'admin') {
      updates.modo_apertura = modo_apertura;
    }

    const { data: updated, error } = await adminSupabase
      .from('negocios')
      .update(updates)
      .eq('id', profile.negocio_id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const estadoApertura = calcularEstadoApertura(updated);

    return NextResponse.json({
      success: true,
      negocio: {
        ...updated,
        abierto_efectivo: estadoApertura.abierto,
        proximo_horario_texto: estadoApertura.proximoHorarioTexto,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
      banner_url,
      slogan,
      color_primario,
      color_secundario,
      tipografia_id,
      tema_catalogo,
      estilo_bordes,
      telefono,
      whatsapp_numero,
      direccion_local,
      abierto_manual,
      modo_apertura,
      horarios,
      horarios_semanales,
      tiempo_preparacion_min,
      momento_aviso_cadeteria,
      minutos_antes_aviso,
      avisar_cliente_en_camino,
      plantillas_whatsapp,
      mensaje_bienvenida,
      mensaje_cierre,
    } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (banner_url !== undefined) updates.banner_url = banner_url;
    if (slogan !== undefined) updates.slogan = slogan;
    if (color_primario !== undefined) updates.color_primario = color_primario;
    if (color_secundario !== undefined) updates.color_secundario = color_secundario;
    if (tipografia_id !== undefined) updates.tipografia_id = tipografia_id;
    if (tema_catalogo !== undefined) updates.tema_catalogo = tema_catalogo;
    if (estilo_bordes !== undefined) updates.estilo_bordes = estilo_bordes;
    if (telefono !== undefined) updates.telefono = telefono;
    if (direccion_local !== undefined) updates.direccion_local = direccion_local;
    if (abierto_manual !== undefined) updates.abierto_manual = Boolean(abierto_manual);
    if (modo_apertura !== undefined) updates.modo_apertura = modo_apertura;
    if (horarios !== undefined) updates.horarios = horarios;
    if (horarios_semanales !== undefined) updates.horarios_semanales = horarios_semanales;
    if (tiempo_preparacion_min !== undefined) {
      updates.tiempo_preparacion_min = Math.max(0, parseInt(String(tiempo_preparacion_min), 10) || 0);
    }
    if (momento_aviso_cadeteria !== undefined) {
      updates.momento_aviso_cadeteria = momento_aviso_cadeteria;
    }
    if (minutos_antes_aviso !== undefined) {
      updates.minutos_antes_aviso = Math.max(0, parseInt(String(minutos_antes_aviso), 10) || 0);
    }
    if (avisar_cliente_en_camino !== undefined) {
      updates.avisar_cliente_en_camino = Boolean(avisar_cliente_en_camino);
    }
    if (plantillas_whatsapp !== undefined) {
      updates.plantillas_whatsapp = plantillas_whatsapp;
    }
    if (mensaje_bienvenida !== undefined) updates.mensaje_bienvenida = mensaje_bienvenida;
    if (mensaje_cierre !== undefined) updates.mensaje_cierre = mensaje_cierre;

    if (whatsapp_numero !== undefined) {
      if (whatsapp_numero === null || whatsapp_numero === '') {
        updates.whatsapp_numero = null;
      } else {
        const clean = limpiarNumeroWhatsApp(whatsapp_numero);
        if (!validarNumeroWhatsApp(clean)) {
          return NextResponse.json(
            {
              error:
                'El número de WhatsApp ingresado no tiene un formato internacional válido (ej: 5491112345678).',
            },
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

    const estadoApertura = calcularEstadoApertura(updated);

    return NextResponse.json({
      success: true,
      negocio: {
        ...updated,
        abierto_efectivo: estadoApertura.abierto,
        proximo_horario_texto: estadoApertura.proximoHorarioTexto,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
