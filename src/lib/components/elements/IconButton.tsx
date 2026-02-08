import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { transition, radius } from '@/lib/design-system/tokens';
import type { ButtonVariant } from './Button';

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeClasses: Record<IconButtonSize, string> = {
  xs: 'h-6 w-6 [&_svg]:h-3.5 [&_svg]:w-3.5',
  sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-9 w-9 [&_svg]:h-4.5 [&_svg]:w-4.5',
  lg: 'h-11 w-11 [&_svg]:h-5 [&_svg]:w-5',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  secondary: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100',
  ghost: 'bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  outline: 'bg-transparent hover:bg-zinc-800/50 text-zinc-300 border border-zinc-700',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: IconButtonSize;
  label: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', label, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          'inline-flex items-center justify-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          'disabled:pointer-events-none disabled:opacity-50',
          radius.md,
          transition.fast,
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';
