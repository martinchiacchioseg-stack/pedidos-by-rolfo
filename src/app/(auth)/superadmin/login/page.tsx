'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null);

  useEffect(() => {
    // Verificar si hay bloqueo local por intentos fallidos
    const savedLock = localStorage.getItem('sa_lock_until');
    if (savedLock && parseInt(savedLock) > Date.now()) {
      setBloqueadoHasta(parseInt(savedLock));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (bloqueadoHasta && Date.now() < bloqueadoHasta) {
      const segundosRestantes = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
      setError(`Demasiados intentos fallidos. Acceso bloqueado temporalmente por ${segundosRestantes} segundos.`);
      return;
    }

    setLoading(true);

    try {
      // 1. Verificar bloqueo server-side por intentos fallidos
      const checkRes = await fetch('/api/superadmin/auth-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'check_lock', email: email.trim() }),
      });
      if (checkRes.status === 429) {
        const lockData = await checkRes.json();
        throw new Error(lockData.error || 'Demasiados intentos fallidos.');
      }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.user) {
        const nuevosIntentos = intentosFallidos + 1;
        setIntentosFallidos(nuevosIntentos);

        // Registrar intento fallido en servidor
        const failRes = await fetch('/api/superadmin/auth-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'failed', email: email.trim() }),
        });
        const failData = await failRes.json().catch(() => ({}));

        if (nuevosIntentos >= 5 || failData.locked) {
          const tiempoBloqueo = Date.now() + 90 * 1000;
          setBloqueadoHasta(tiempoBloqueo);
          localStorage.setItem('sa_lock_until', tiempoBloqueo.toString());
          throw new Error('Demasiados intentos fallidos. Acceso bloqueado por 90 segundos por seguridad.');
        }

        throw new Error('Credenciales incorrectas o acceso no autorizado.');
      }

      // Validar rol de SuperAdmin
      const { data: profile, error: profileError } = await supabase
        .from('usuarios')
        .select('role, activo')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile || profile.role !== 'superadmin' || !profile.activo) {
        await supabase.auth.signOut();
        await fetch('/api/superadmin/auth-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'failed', email: email.trim() }),
        });
        throw new Error('Acceso restringido. Esta cuenta no tiene permisos de Súper Administrador.');
      }

      // Éxito: registrar auditoría en servidor y limpiar intentos
      setIntentosFallidos(0);
      localStorage.removeItem('sa_lock_until');

      await fetch('/api/superadmin/auth-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'success',
          email: data.user.email,
          usuario_id: data.user.id,
        }),
      });

      router.push('/superadmin');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al procesar la solicitud.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-neutral-100 selection:bg-rose-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 text-rose-500 mb-4 shadow-xl shadow-black/50">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-200">
          Acceso de Control Central
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Identificación de Súper Administrador del Sistema
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-900/90 border border-neutral-800/80 p-8 rounded-3xl shadow-2xl backdrop-blur">
          {error && (
            <div className="mb-6 rounded-xl bg-red-950/40 border border-red-800/60 p-4 text-xs text-red-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Identificador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sistema.internal"
                  className="block w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Clave de Seguridad
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (bloqueadoHasta !== null && Date.now() < bloqueadoHasta)}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  Verificar Credenciales
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
