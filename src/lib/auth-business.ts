import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { NextResponse } from 'next/server';
import { calcularDiasRestantes } from './utils';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { Usuario, Negocio } from '@/types/database';

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

export async function verifyBusinessUser(requiredRole?: 'admin'): Promise<VerifyBusinessResult> {
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
