import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'brand';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  dot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-slate-800/80 text-slate-300 border-white/10',
    success: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
    warning: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
    danger: 'bg-rose-500/12 text-rose-300 border-rose-500/25',
    info: 'bg-sky-500/12 text-sky-300 border-sky-500/25',
    purple: 'bg-purple-500/12 text-purple-300 border-purple-500/25',
    brand: 'bg-rose-600/15 text-rose-300 border-rose-500/30',
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-slate-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    purple: 'bg-purple-400',
    brand: 'bg-rose-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border tracking-tight',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            dotColors[variant],
            pulse && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  );
}
