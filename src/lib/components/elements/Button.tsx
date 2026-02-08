import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { accent, radius, transition } from '@/lib/design-system/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'text-xs px-2 py-1 h-7',
  sm: 'text-sm px-3 py-1.5 h-8',
  md: 'text-sm px-4 py-2 h-9',
  lg: 'text-base px-5 py-2.5 h-11',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: `${accent.primary.bg} ${accent.primary.hover} ${accent.primary.text}`,
  secondary: `${accent.secondary.bg} ${accent.secondary.hover} ${accent.secondary.text}`,
  ghost: `${accent.ghost.bg} ${accent.ghost.hover} ${accent.ghost.text}`,
  danger: `${accent.danger.bg} ${accent.danger.hover} ${accent.danger.text}`,
  outline: `${accent.outline.bg} ${accent.outline.hover} ${accent.outline.text} ${accent.outline.border}`,
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, leftIcon, rightIcon, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          'disabled:pointer-events-none disabled:opacity-50',
          '[&_svg]:pointer-events-none [&_svg]:shrink-0',
          radius.md,
          transition.fast,
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {rightIcon}
      </button>
    );
  },
);
Button.displayName = 'Button';
