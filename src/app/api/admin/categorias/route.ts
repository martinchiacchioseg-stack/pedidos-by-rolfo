import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET() {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  const { data: categorias, error } = await adminSupabase
    .from('categorias')
    .select('*')
    .eq('negocio_id', profile.negocio_id)
    .order('orden', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categorias: categorias || [] });
}

export async function POST(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const { nombre, orden } = body;

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre de la categoría es obligatorio' }, { status: 400 });
    }

    const { data: nuevaCat, error } = await adminSupabase
      .from('categorias')
      .insert({
        negocio_id: profile.negocio_id,
        nombre: nombre.trim(),
        orden: orden || 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, categoria: nuevaCat });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyBusinessUser('admin');
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID de categoría requerido' }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from('categorias')
    .delete()
    .eq('id', id)
    .eq('negocio_id', profile.negocio_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
