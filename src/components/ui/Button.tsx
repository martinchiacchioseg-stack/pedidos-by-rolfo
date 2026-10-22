import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/20 border border-rose-500/30',
      secondary:
        'bg-[#171c29] text-slate-100 hover:bg-[#1e2434] border border-white/10 shadow-sm',
      outline:
        'bg-transparent text-slate-200 hover:bg-white/5 border border-white/15 hover:border-white/25',
      ghost:
        'bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent',
      danger:
        'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30',
      success:
        'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 border border-emerald-500/30',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
      md: 'px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2',
      lg: 'px-6 py-3.5 text-sm rounded-2xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99]',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
