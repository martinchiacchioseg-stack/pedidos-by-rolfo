import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
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
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .trim()
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/[^\w-]+/g, '') // Quitar caracteres no alfanuméricos
    .replace(/--+/g, '-'); // Reemplazar múltiples guiones por uno
}

export function limpiarNumeroWhatsApp(phone: string): string {
  // Remueve espacios, guiones, paréntesis y signos +
  return phone.replace(/[^0-9]/g, '');
}

export function validarNumeroWhatsApp(phone: string): boolean {
  const clean = limpiarNumeroWhatsApp(phone);
  // Al menos 10 dígitos (código de país + código de área + número)
  return clean.length >= 10 && clean.length <= 15;
}
