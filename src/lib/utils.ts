import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatShortDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatTimeAR(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getTodayDateStringAR(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function calcularHoraEstimadaAR(minutosExtra = 30, baseDate?: string): string {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setMinutes(d.getMinutes() + minutosExtra);
  return formatTimeAR(d.toISOString()) + ' hs';
}

export function calcularDiasRestantes(fechaVencimiento: string): number {
  const ahora = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const diffTime = vencimiento.getTime() - ahora.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getEstadoVencimiento(diasRestantes: number): 'vigente' | 'por_vencer' | 'vencido' {
  if (diasRestantes <= 0) return 'vencido';
  if (diasRestantes <= 7) return 'por_vencer';
  return 'vigente';
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export function limpiarNumeroWhatsApp(phone: string): string {
  return (phone || '').replace(/[^0-9]/g, '');
}

export function validarNumeroWhatsApp(phone: string): boolean {
  const clean = limpiarNumeroWhatsApp(phone);
  return clean.length >= 10 && clean.length <= 15;
}

export function generarLinkGoogleMaps(direccion: string): string {
  if (!direccion) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion.trim())}`;
}

export function generarLinkWaze(direccion: string): string {
  if (!direccion) return '';
  return `https://waze.com/ul?q=${encodeURIComponent(direccion.trim())}&navigate=yes`;
}

export function generarLinkGoogleMapsCoords(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
