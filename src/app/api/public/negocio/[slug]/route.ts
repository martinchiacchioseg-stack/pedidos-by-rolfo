import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calcularDiasRestantes, getEstadoVencimiento } from '@/lib/utils';
import { calcularEstadoApertura } from '@/lib/horarios';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const adminSupabase = createAdminClient();

  const { data: negocio, error: negError } = await adminSupabase
    .from('negocios')
    .select('*')
    .eq('slug', slug)
    .single();

  if (negError || !negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
  }

  const diasRestantes = calcularDiasRestantes(negocio.fecha_vencimiento);
  const estadoVencimiento = getEstadoVencimiento(diasRestantes);
  const estaVencido = !negocio.activo || estadoVencimiento === 'vencido';

  const estadoApertura = calcularEstadoApertura(negocio);

  const { data: categorias } = await adminSupabase
    .from('categorias')
    .select('*')
    .eq('negocio_id', negocio.id)
    .order('orden', { ascending: true });

  const { data: productos } = await adminSupabase
    .from('productos')
    .select('id, categoria_id, nombre, descripcion, precio_venta, imagen_url, orden')
    .eq('negocio_id', negocio.id)
    .eq('visible_catalogo', true)
    .order('orden', { ascending: true });

  return NextResponse.json({
    servicio_no_disponible: estaVencido,
    negocio: {
      ...negocio,
      dias_restantes: diasRestantes,
      estado_vencimiento: estadoVencimiento,
      abierto_efectivo: estadoApertura.abierto,
      proximo_horario_texto: estadoApertura.proximoHorarioTexto,
    },
    categorias: categorias || [],
    productos: productos || [],
  });
}
