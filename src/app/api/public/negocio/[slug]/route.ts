import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calcularDiasRestantes, getEstadoVencimiento } from '@/lib/utils';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const adminSupabase = createAdminClient();

  // 1. Obtener negocio por slug
  const { data: negocio, error: negError } = await adminSupabase
    .from('negocios')
    .select('*')
    .eq('slug', slug)
    .single();

  if (negError || !negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
  }

  // 2. Verificar vencimiento y estado
  const diasRestantes = calcularDiasRestantes(negocio.fecha_vencimiento);
  const estadoVencimiento = getEstadoVencimiento(diasRestantes);
  const estaVencido = !negocio.activo || estadoVencimiento === 'vencido';

  if (estaVencido) {
    return NextResponse.json({
      servicio_no_disponible: true,
      negocio: {
        nombre: negocio.nombre,
        logo_url: negocio.logo_url,
      },
    });
  }

  // 3. Obtener categorías del negocio
  const { data: categorias } = await adminSupabase
    .from('categorias')
    .select('*')
    .eq('negocio_id', negocio.id)
    .order('orden', { ascending: true });

  // 4. Obtener solo productos visibles en el catálogo
  const { data: productos } = await adminSupabase
    .from('productos')
    .select('id, categoria_id, nombre, descripcion, precio_venta, imagen_url, orden')
    .eq('negocio_id', negocio.id)
    .eq('visible_catalogo', true)
    .order('orden', { ascending: true });

  return NextResponse.json({
    servicio_no_disponible: false,
    negocio,
    categorias: categorias || [],
    productos: productos || [],
  });
}
