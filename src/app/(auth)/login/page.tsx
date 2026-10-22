'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  UtensilsCrossed,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

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

      if (authError || !data.user) {
        throw new Error('Credenciales inválidas. Verificá tu correo y contraseña.');
      }

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

      if (profile.must_change_password) {
        router.push('/cambiar-clave');
        return;
      }

      if (profile.role === 'superadmin') {
        router.push('/superadmin');
      } else if (profile.role === 'cadete') {
        router.push('/cadete');
      } else {
        router.push(redirect || '/admin');
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
    <div className="bg-[#11151f]/90 backdrop-blur-xl py-8 px-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 rounded-3xl sm:px-10">
      {error && (
        <div className="mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/25 p-4 text-xs text-rose-200 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Correo electrónico
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@negocio.com"
              className="block w-full pl-10 pr-4 py-3 bg-[#090b10] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 text-sm transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Contraseña
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full pl-10 pr-4 py-3 bg-[#090b10] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 text-sm transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg shadow-rose-600/20 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verificando acceso...</span>
            </>
          ) : (
            <>
              <span>Ingresar al sistema</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-white/[0.07] text-center space-y-2">
        <p className="text-xs text-slate-400">
          Acceso unificado para Administradores, Vendedores y Cadetes.
        </p>
        <p className="text-[11px] text-slate-500">
          ¿Olvidaste tu clave? Solicitá un restablecimiento al administrador de tu local.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#090b10] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 px-4 relative overflow-hidden">
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-rose-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al inicio</span>
        </Link>

        <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white shadow-xl shadow-rose-600/30 mx-auto mb-4 flex items-center justify-center">
          <UtensilsCrossed className="w-7 h-7" />
        </div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-white">
          Pedidos by <span className="text-rose-500 font-mono">ROLΦ</span>
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          Plataforma de gestión gastronómica, ventas y cadetería
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Suspense
          fallback={<div className="text-center text-slate-400 text-xs">Cargando acceso...</div>}
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
