import { Suspense } from 'react';
import { CatalogoPublicoClient } from '@/components/catalogo/CatalogoPublicoClient';

export default async function CatalogoPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs">Cargando menú digital...</span>
        </div>
      }
    >
      <CatalogoPublicoClient slug={slug} />
    </Suspense>
  );
}
