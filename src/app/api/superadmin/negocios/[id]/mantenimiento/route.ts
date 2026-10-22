import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';

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
    const { accion } = body;

    if (!accion) {
      return NextResponse.json({ error: 'Acción de mantenimiento no especificada' }, { status: 400 });
    }

    let resultadoMensaje = '';

    switch (accion) {
      case 'recalcular_costos': {
        // Recalcular costos de todos los productos del negocio
        const { data: productos } = await adminSupabase
          .from('productos')
          .select('id')
          .eq('negocio_id', negocioId);

        let count = 0;
        if (productos) {
          for (const p of productos) {
            const { data: ingredientes } = await adminSupabase
              .from('ingredientes')
              .select('cantidad, costo_unitario')
              .eq('producto_id', p.id);

            const total = ingredientes?.reduce((acc, i) => acc + (i.costo_unitario || 0) * (i.cantidad || 1), 0) || 0;

            await adminSupabase
              .from('productos')
              .update({ costo_total: total })
              .eq('id', p.id);
            count++;
          }
        }
        resultadoMensaje = `Se recalcularon los costos de ${count} productos correctamente.`;
        break;
      }

      case 'limpiar_pedidos_cancelados': {
        const { count, error } = await adminSupabase
          .from('pedidos')
          .delete({ count: 'exact' })
          .eq('negocio_id', negocioId)
          .eq('estado', 'cancelado');

        if (error) throw new Error(error.message);
        resultadoMensaje = `Se eliminaron ${count || 0} pedidos cancelados del historial.`;
        break;
      }

      case 'reiniciar_configuracion_visual': {
        const { error } = await adminSupabase
          .from('negocios')
          .update({
            color_primario: '#E11D48',
            color_secundario: '#1E293B',
            mensaje_bienvenida: '¡Bienvenido! Hacé tu pedido online y te lo preparamos al instante.',
            mensaje_cierre: 'Gracias por elegirnos. ¡Que lo disfrutes!',
            updated_at: new Date().toISOString(),
          })
          .eq('id', negocioId);

        if (error) throw new Error(error.message);
        resultadoMensaje = 'Se restablecieron los colores y mensajes a los valores de fábrica.';
        break;
      }

      default:
        return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });
    }

    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_maintenance_action',
      metadata: { negocio_id: negocioId, accion, mensaje: resultadoMensaje },
    });

    return NextResponse.json({ success: true, mensaje: resultadoMensaje });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
