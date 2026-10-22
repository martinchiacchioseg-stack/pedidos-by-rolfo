import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;
  const { id: productoId } = await params;

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

    // Calcular nuevo costo total si se envían ingredientes
    let costoTotal: number | undefined = undefined;
    if (ingredientes && Array.isArray(ingredientes)) {
      costoTotal = ingredientes.reduce((acc: number, ing: { cantidad?: number; costo_unitario?: number }) => {
        const cant = ing.cantidad || 1;
        const costo = ing.costo_unitario || 0;
        return acc + cant * costo;
      }, 0);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (categoria_id !== undefined) updates.categoria_id = categoria_id || null;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (precio_venta !== undefined) updates.precio_venta = parseFloat(precio_venta);
    if (imagen_url !== undefined) updates.imagen_url = imagen_url;
    if (receta !== undefined) updates.receta = receta;
    if (visible_catalogo !== undefined) updates.visible_catalogo = Boolean(visible_catalogo);
    if (costoTotal !== undefined) updates.costo_total = costoTotal;

    const { data: updated, error } = await adminSupabase
      .from('productos')
      .update(updates)
      .eq('id', productoId)
      .eq('negocio_id', profile.negocio_id)
      .select('*, categoria:categorias(*)')
      .single();

    if (error) throw new Error(error.message);

    // Si se enviaron ingredientes, actualizar la lista
    if (ingredientes && Array.isArray(ingredientes)) {
      // Eliminar anteriores
      await adminSupabase.from('ingredientes').delete().eq('producto_id', productoId);

      if (ingredientes.length > 0) {
        const nuevosIng = ingredientes.map((ing: { nombre: string; cantidad?: number; unidad?: string; costo_unitario?: number }) => ({
          negocio_id: profile.negocio_id,
          producto_id: productoId,
          nombre: ing.nombre.trim(),
          cantidad: ing.cantidad || 1,
          unidad: ing.unidad || 'unidades',
          costo_unitario: ing.costo_unitario ? parseFloat(ing.costo_unitario.toString()) : null,
        }));
        await adminSupabase.from('ingredientes').insert(nuevosIng);
      }
    }

    return NextResponse.json({ success: true, producto: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;
  const { id: productoId } = await params;

  try {
    const { error } = await adminSupabase
      .from('productos')
      .delete()
      .eq('id', productoId)
      .eq('negocio_id', profile.negocio_id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
