import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { NextResponse } from 'next/server';
import { SupabaseClient, User } from '@supabase/supabase-js';

export type VerifySuperAdminResult =
  | { authorized: false; response: NextResponse; user?: never; adminSupabase?: never }
  | { authorized: true; response?: never; user: User; adminSupabase: SupabaseClient };

export async function verifySuperAdmin(): Promise<VerifySuperAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('role, activo')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'superadmin' || !profile.activo) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Acceso denegado: Se requieren permisos de Súper Administrador' }, { status: 403 }),
    };
  }

  return { authorized: true, user, adminSupabase: createAdminClient() };
}
