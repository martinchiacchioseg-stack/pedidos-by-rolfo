'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UtensilsCrossed, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        throw new Error('Credenciales inválidas. Verificá tu correo y contraseña.');
      }

      if (!data.user) {
        throw new Error('No se pudo iniciar sesión.');
      }

      // Obtener datos del perfil
      const { data: profile, error: profileError } = await supabase
        .from('usuarios')
        .select('role, must_change_password, activo')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('No se encontró el perfil de usuario asociado.');
      }

      if (!profile.activo) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta está desactivada. Contactá al administrador.');
      }

      // Si debe cambiar la contraseña, redirigir
      if (profile.must_change_password) {
        router.push('/cambiar-clave');
        return;
      }

      // Redirigir según el rol
      if (profile.role === 'superadmin') {
        router.push('/superadmin');
      } else {
        router.push(redirect);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado al intentar iniciar sesión.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md py-8 px-6 shadow-2xl border border-slate-800 rounded-3xl sm:px-10">
      {error && (
        <div className="mb-6 rounded-xl bg-rose-950/50 border border-rose-800/80 p-4 text-sm text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Correo Electrónico
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-5 w-5" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@negocio.com"
              className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Contraseña
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-5 w-5" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              Ingresar al Panel
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500">
          ¿Olvidaste tu contraseña? Solicitá un restablecimiento a tu administrador.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30 mb-4">
          <UtensilsCrossed className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Pedidos by <span className="text-rose-500 font-mono">ROLΦ</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Panel de gestión para administradores y vendedores
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center text-slate-400 text-xs">Cargando formulario...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
