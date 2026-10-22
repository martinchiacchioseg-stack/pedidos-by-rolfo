import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';

export async function GET() {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { data: planes, error } = await adminSupabase
    .from('planes')
    .select('*')
    .order('duracion_dias', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ planes });
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;

  try {
    const body = await req.json();
    const { nombre, duracion_dias, precio, descripcion, activo } = body;

    if (!nombre || !duracion_dias) {
      return NextResponse.json({ error: 'Nombre y duración en días son requeridos' }, { status: 400 });
    }

    const { data: nuevoPlan, error } = await adminSupabase
      .from('planes')
      .insert({
        nombre: nombre.trim(),
        duracion_dias: parseInt(duracion_dias, 10),
        precio: precio ? parseFloat(precio) : 0,
        descripcion: descripcion || null,
        activo: activo !== undefined ? Boolean(activo) : true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, plan: nuevoPlan });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;

  try {
    const body = await req.json();
    const { id, nombre, duracion_dias, precio, descripcion, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de plan requerido' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (nombre) updates.nombre = nombre.trim();
    if (duracion_dias) updates.duracion_dias = parseInt(duracion_dias, 10);
    if (precio !== undefined) updates.precio = parseFloat(precio);
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (activo !== undefined) updates.activo = Boolean(activo);

    const { data: updatedPlan, error } = await adminSupabase
      .from('planes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
