import { createClient } from './supabase/server';
import { Usuario, Negocio } from '@/types/database';

export interface UserSessionData {
  user: {
    id: string;
    email: string;
  };
  profile: Usuario;
  negocio: Negocio | null;
}

export async function getCurrentUserSession(): Promise<UserSessionData | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Buscar perfil en tabla usuarios
  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('*, negocio:negocios(*)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.activo) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email || profile.email,
    },
    profile: profile as Usuario,
    negocio: (profile.negocio as Negocio) || null,
  };
}
