import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calcularDiasRestantes } from '@/lib/utils';
import { Lock } from 'lucide-react';

export default async function CadeteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('usuarios')
    .select('id, role, activo, must_change_password, negocio:negocios(id, nombre, activo, fecha_vencimiento)')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.activo) {
    redirect('/login');
  }

  if (profile.must_change_password) {
    redirect('/cambiar-clave');
  }

  if (profile.role !== 'cadete') {
    redirect('/admin');
  }

  const negocioObj = Array.isArray(profile.negocio) ? profile.negocio[0] : profile.negocio;
  const diasRestantes = negocioObj?.fecha_vencimiento
    ? calcularDiasRestantes(negocioObj.fecha_vencimiento)
    : 0;
  const bloqueadoPorPlan = !negocioObj?.activo || diasRestantes <= 0;

  if (bloqueadoPorPlan) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-rose-900/60 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Servicio No Disponible</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            El plan de suscripción de <strong className="text-white">{negocioObj?.nombre || 'este negocio'}</strong> se encuentra vencido o temporalmente suspendido. Comunicate con el administrador del local para renovar el servicio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-amber-500 selection:text-zinc-950">
      {children}
    </div>
  );
}
