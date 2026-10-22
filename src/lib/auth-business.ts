import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { NextResponse } from 'next/server';
import { calcularDiasRestantes } from './utils';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { Usuario, Negocio, Cadete } from '@/types/database';

export type VerifyBusinessResult =
  | {
      authorized: false;
      response: NextResponse;
      user?: never;
      profile?: never;
      negocio?: never;
      diasRestantes?: never;
      estaVencido?: never;
      adminSupabase?: never;
    }
  | {
      authorized: true;
      response?: never;
      user: User;
      profile: Usuario;
      negocio: Negocio;
      diasRestantes: number;
      estaVencido: boolean;
      adminSupabase: SupabaseClient;
    };

export async function verifyBusinessUser(
  requiredRole?: 'admin',
  allowCadete = false
): Promise<VerifyBusinessResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  // Buscar perfil en tabla usuarios
  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('*, negocio:negocios(*)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.activo || !profile.negocio_id) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Acceso no autorizado al negocio' }, { status: 403 }),
    };
  }

  // Aislar rol cadete de los endpoints administrativos
  if (!allowCadete && profile.role === 'cadete') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'El rol cadete solo tiene acceso a su vista de entregas' }, { status: 403 }),
    };
  }

  // Validar rol si se requiere 'admin'
  if (requiredRole && profile.role !== requiredRole && profile.role !== 'superadmin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Se requieren permisos de Administrador para esta acción' }, { status: 403 }),
    };
  }

  const negocio = profile.negocio;
  const diasRestantes = negocio?.fecha_vencimiento ? calcularDiasRestantes(negocio.fecha_vencimiento) : 0;
  const estaVencido = diasRestantes <= 0;

  return {
    authorized: true,
    user,
    profile: profile as Usuario,
    negocio: negocio as Negocio,
    diasRestantes,
    estaVencido,
    adminSupabase: createAdminClient(),
  };
}

export type VerifyCadeteResult =
  | {
      authorized: false;
      response: NextResponse;
      user?: never;
      profile?: never;
      negocio?: never;
      cadete?: never;
      adminSupabase?: never;
    }
  | {
      authorized: true;
      response?: never;
      user: User;
      profile: Usuario;
      negocio: Negocio;
      cadete: Cadete;
      adminSupabase: SupabaseClient;
    };

export async function verifyCadeteUser(): Promise<VerifyCadeteResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  const adminSupabase = createAdminClient();

  const { data: profile, error: profileError } = await adminSupabase
    .from('usuarios')
    .select('*, negocio:negocios(*)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.activo || !profile.negocio_id || profile.role !== 'cadete') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Acceso exclusivo para cadetes activos' }, { status: 403 }),
    };
  }

  const { data: cadete, error: cadeteError } = await adminSupabase
    .from('cadetes')
    .select('*')
    .eq('usuario_id', user.id)
    .eq('negocio_id', profile.negocio_id)
    .eq('activo', true)
    .single();

  if (cadeteError || !cadete) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Perfil de cadete no encontrado o desactivado' }, { status: 403 }),
    };
  }

  const negocio = profile.negocio as Negocio;
  const diasRestantes = negocio?.fecha_vencimiento ? calcularDiasRestantes(negocio.fecha_vencimiento) : 0;
  const estaVencido = diasRestantes <= 0 || !negocio?.activo;

  if (estaVencido) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Servicio no disponible: el plan del comercio se encuentra vencido o suspendido.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
    profile: profile as Usuario,
    negocio,
    cadete: cadete as Cadete,
    adminSupabase,
  };
}
