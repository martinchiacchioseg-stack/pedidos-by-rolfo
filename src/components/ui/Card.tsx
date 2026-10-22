import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
}

export function Card({
  className,
  elevated = false,
  interactive = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200',
        elevated
          ? 'bg-[#171c29]/95 border-white/10 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.45)]'
          : 'bg-[#11151f]/90 border-white/[0.07] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.3)]',
        interactive && 'hover:border-white/15 hover:bg-[#171c29] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
