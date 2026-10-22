'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { KeyRound, ShieldAlert, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function CambiarClavePage() {
  const router = useRouter();
  const [nuevaClave, setNuevaClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (nuevaClave.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (nuevaClave !== confirmarClave) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Sesión no encontrada. Por favor volvé a ingresar.');
      }

      const { error: authError } = await supabase.auth.updateUser({
        password: nuevaClave,
      });

      if (authError) {
        throw new Error(`Error al actualizar contraseña: ${authError.message}`);
      }

      const { error: profileError } = await supabase
        .from('usuarios')
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) {
        throw new Error(`Error al actualizar estado del perfil: ${profileError.message}`);
      }

      await supabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'password_change',
        metadata: { motivo: 'primer_ingreso_obligatorio' },
      });

      setExito(true);

      const { data: profile } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', user.id)
        .single();

      setTimeout(() => {
        if (profile?.role === 'superadmin') {
          router.push('/superadmin');
        } else if (profile?.role === 'cadete') {
          router.push('/cadete');
        } else {
          router.push('/admin');
        }
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado al actualizar la contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090b10] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/12 border border-amber-500/25 text-amber-400 mb-4">
          <KeyRound className="w-8 h-8" />
        </div>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">
          Definí tu Contraseña Personal
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Tenés asignada una clave momentánea. Por seguridad, es obligatorio elegir una nueva contraseña antes de usar el sistema.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#11151f] border border-white/10 p-8 rounded-3xl shadow-2xl">
          {error && (
            <div className="mb-6 rounded-2xl bg-rose-500/12 border border-rose-500/25 p-4 text-xs text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {exito ? (
            <div className="rounded-2xl bg-emerald-500/12 border border-emerald-500/25 p-6 text-center text-emerald-300 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="font-heading font-semibold text-base text-emerald-200">
                Contraseña actualizada con éxito
              </h3>
              <p className="text-xs text-emerald-400">Redirigiendo a tu panel...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-200/90 flex gap-2.5 items-center">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                <span>Elegí una contraseña segura de al menos 8 caracteres.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="block w-full px-4 py-3 bg-[#090b10] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmarClave}
                  onChange={(e) => setConfirmarClave(e.target.value)}
                  placeholder="Repetí la contraseña"
                  className="block w-full px-4 py-3 bg-[#090b10] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 focus:outline-none transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  'Guardar Contraseña y Continuar'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
