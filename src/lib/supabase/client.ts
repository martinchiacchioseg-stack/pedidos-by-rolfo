import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_SUPABASE_URL = 'https://kwhyztqjoweegfzomyon.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_rJ84YXDuauyms-RpkwplPw_gHI98inJ';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  );
}
