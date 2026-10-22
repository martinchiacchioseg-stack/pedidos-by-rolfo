import { NextRequest, NextResponse } from 'next/server';
import { verifyBusinessUser } from '@/lib/auth-business';

export async function GET(req: NextRequest) {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;
  const searchParams = req.nextUrl.searchParams;
  const estado = searchParams.get('estado');
  const fecha = searchParams.get('fecha');

  let query = adminSupabase
    .from('pedidos')
    .select('*, items:pedido_items(*)')
    .eq('negocio_id', profile.negocio_id)
    .order('created_at', { ascending: false });

  if (estado && estado !== 'todos') {
    query = query.eq('estado', estado);
  }

  if (fecha) {
    const inicio = `${fecha}T00:00:00.000Z`;
    const fin = `${fecha}T23:59:59.999Z`;
    query = query.gte('created_at', inicio).lte('created_at', fin);
  }

  const { data: pedidos, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pedidos: pedidos || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyBusinessUser();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, profile } = auth;

  try {
    const body = await req.json();
    const { pedido_id, nuevo_estado } = body;

    const estadosValidos = ['nuevo', 'en_preparacion', 'listo', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(nuevo_estado)) {
      return NextResponse.json({ error: 'Estado de pedido inválido' }, { status: 400 });
    }

    const { data: updated, error } = await adminSupabase
      .from('pedidos')
      .update({
        estado: nuevo_estado,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido_id)
      .eq('negocio_id', profile.negocio_id)
      .select('*, items:pedido_items(*)')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, pedido: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
