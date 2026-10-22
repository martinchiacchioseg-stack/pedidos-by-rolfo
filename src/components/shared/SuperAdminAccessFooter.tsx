'use client';

import { useRouter } from 'next/navigation';

interface SuperAdminAccessFooterProps {
  negocioNombre?: string;
}

export function SuperAdminAccessFooter({ negocioNombre }: SuperAdminAccessFooterProps) {
  const router = useRouter();

  const handleHiddenAccess = () => {
    router.push('/superadmin/login');
  };

  return (
    <footer className="w-full py-8 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-3 text-center">
        {negocioNombre && (
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            © {new Date().getFullYear()} {negocioNombre}. Todos los derechos reservados.
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          {/* Logo interactivo oculto: al tocarlo abre el acceso del SuperAdmin sin ningún texto explícito */}
          <button
            type="button"
            onClick={handleHiddenAccess}
            title="Powered by ROLΦ"
            aria-label="Powered by ROLΦ"
            className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-600 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer group px-2 py-1 rounded focus:outline-none"
          >
            <span className="w-4 h-4 rounded bg-rose-500 text-white flex items-center justify-center text-[10px] font-sans group-hover:scale-110 transition-transform">
              R
            </span>
            <span>Powered by ROLΦ</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
