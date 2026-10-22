import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente administrativo con service_role key - Solo para uso en API routes y Server Actions del servidor
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas.');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
