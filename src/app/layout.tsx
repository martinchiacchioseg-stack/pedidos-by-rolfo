import type { Metadata, Viewport } from 'next';
import { allFontVariables } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pedidos by ROLΦ — Menú Digital, Cadetería y Gestión Gastronómica',
  description:
    'Plataforma multinegocio de pedidos online por WhatsApp, control de recetas y costos, cadetería con GPS y cierre de caja.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pedidos ROLΦ',
  },
};

export const viewport: Viewport = {
  themeColor: '#090b10',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${allFontVariables} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#090b10] text-slate-100 selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
