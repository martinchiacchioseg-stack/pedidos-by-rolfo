import {
  Plus_Jakarta_Sans,
  Inter,
  Playfair_Display,
  DM_Sans,
  Fraunces,
  Work_Sans,
  Space_Grotesk,
  JetBrains_Mono,
} from 'next/font/google';
import { TipografiaId } from '@/types/database';

export const fontJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const fontInter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const fontPlayfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const fontDmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const fontFraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const fontWorkSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
});

export const fontSpaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-code',
  display: 'swap',
});

export const allFontVariables = [
  fontJakarta.variable,
  fontInter.variable,
  fontPlayfair.variable,
  fontDmSans.variable,
  fontFraunces.variable,
  fontWorkSans.variable,
  fontSpaceGrotesk.variable,
  fontMono.variable,
].join(' ');

export interface CombinacionTipografica {
  id: TipografiaId;
  nombre: string;
  descripcion: string;
  headingFamily: string;
  bodyFamily: string;
  ejemploRubro: string;
}

export const COMBINACIONES_TIPOGRAFICAS: CombinacionTipografica[] = [
  {
    id: 'modern',
    nombre: 'Contemporánea (Plus Jakarta + Inter)',
    descripcion: 'Equilibrada, limpia y de lectura impecable en pantallas móviles.',
    headingFamily: 'var(--font-jakarta), sans-serif',
    bodyFamily: 'var(--font-inter), sans-serif',
    ejemploRubro: 'Ideal para restaurantes modernos, sushi y gastronomía general',
  },
  {
    id: 'bold',
    nombre: 'Urbana & Smash (Space Grotesk + Inter)',
    descripcion: 'Titulares geométricos con carácter fuerte y números de alto impacto.',
    headingFamily: 'var(--font-space-grotesk), sans-serif',
    bodyFamily: 'var(--font-inter), sans-serif',
    ejemploRubro: 'Ideal para hamburgueserías, cervecerías y street food',
  },
  {
    id: 'artisan',
    nombre: 'Artesanal & Horno (Fraunces + Work Sans)',
    descripcion: 'Calidez orgánica con serifas suaves que transmiten elaboración propia.',
    headingFamily: 'var(--font-fraunces), serif',
    bodyFamily: 'var(--font-work-sans), sans-serif',
    ejemploRubro: 'Ideal para pizzerías a la piedra, masa madre y panaderías',
  },
  {
    id: 'editorial',
    nombre: 'Bistró & Especialidad (Playfair + DM Sans)',
    descripcion: 'Sofisticación editorial con alto contraste entre títulos y descripciones.',
    headingFamily: 'var(--font-playfair), serif',
    bodyFamily: 'var(--font-dm-sans), sans-serif',
    ejemploRubro: 'Ideal para cafeterías de especialidad, pastelerías y cocina de autor',
  },
];

export function getFontStylesForNegocio(tipografiaId?: TipografiaId) {
  const found =
    COMBINACIONES_TIPOGRAFICAS.find((c) => c.id === tipografiaId) ||
    COMBINACIONES_TIPOGRAFICAS[0];
  return {
    '--font-brand-heading': found.headingFamily,
    '--font-brand-body': found.bodyFamily,
  } as React.CSSProperties;
}
