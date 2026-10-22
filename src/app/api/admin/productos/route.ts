import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET() {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;
  const esVendedor = profile.role === 'vendedor';

  const { data: productos, error } = await adminSupabase
    .from('productos')
    .select('*, categoria:categorias(*), ingredientes(*)')
    .eq('negocio_id', profile.negocio_id)
    .order('orden', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si es vendedor, ocultar costos por seguridad comercial
  const productosFiltrados = productos.map((p) => {
    if (esVendedor) {
      return {
        ...p,
        costo_total: null,
        receta: null,
        ingredientes: [],
      };
    }
    return p;
  });

  return NextResponse.json({ productos: productosFiltrados });
}

export async function POST(req: NextRequest) {
  // Solo administradores pueden crear productos
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const {
      nombre,
      categoria_id,
      descripcion,
      precio_venta,
      imagen_url,
      receta,
      visible_catalogo,
      ingredientes,
    } = body;

    if (!nombre || precio_venta === undefined) {
      return NextResponse.json(
        { error: 'El nombre comercial y el valor de venta son requeridos' },
        { status: 400 }
      );
    }

    // Calcular costo total sumando ingredientes si los hay
    let costoTotal = 0;
    if (ingredientes && Array.isArray(ingredientes)) {
      costoTotal = ingredientes.reduce((acc: number, ing: { cantidad?: number; costo_unitario?: number }) => {
        const cant = ing.cantidad || 1;
        const costo = ing.costo_unitario || 0;
        return acc + cant * costo;
      }, 0);
    }

    // Insertar producto
    const { data: nuevoProducto, error: prodError } = await adminSupabase
      .from('productos')
      .insert({
        negocio_id: profile.negocio_id,
        categoria_id: categoria_id || null,
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        precio_venta: parseFloat(precio_venta),
        imagen_url: imagen_url || null,
        receta: receta || null,
        costo_total: costoTotal,
        visible_catalogo: visible_catalogo !== undefined ? Boolean(visible_catalogo) : true,
      })
      .select('*, categoria:categorias(*)')
      .single();

    if (prodError) throw new Error(prodError.message);

    // Insertar ingredientes si fueron provistos
    if (ingredientes && Array.isArray(ingredientes) && ingredientes.length > 0) {
      const ingredientesAInsertar = ingredientes.map((ing: { nombre: string; cantidad?: number; unidad?: string; costo_unitario?: number }) => ({
        negocio_id: profile.negocio_id,
        producto_id: nuevoProducto.id,
        nombre: ing.nombre.trim(),
        cantidad: ing.cantidad || 1,
        unidad: ing.unidad || 'unidades',
        costo_unitario: ing.costo_unitario ? parseFloat(ing.costo_unitario.toString()) : null,
      }));

      await adminSupabase.from('ingredientes').insert(ingredientesAInsertar);
    }

    return NextResponse.json({ success: true, producto: nuevoProducto });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
