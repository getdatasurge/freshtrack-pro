import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, border, surface, transition, radius } from '@/lib/design-system/tokens';

export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  htmlFor?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, label, htmlFor, error, helpText, required, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-1.5', className)} {...props}>
        {label && (
          <label htmlFor={htmlFor} className={cn('block text-sm font-medium', textTokens.secondary)}>
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
        )}
        {children}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {helpText && !error && <p className={cn('text-xs', textTokens.tertiary)}>{helpText}</p>}
      </div>
    );
  },
);
InputGroup.displayName = 'InputGroup';

// Standalone styled input
export interface StyledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const StyledInput = React.forwardRef<HTMLInputElement, StyledInputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 text-sm',
          surface.raised,
          'border',
          hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
          radius.md,
          textTokens.primary,
          'placeholder:text-zinc-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
          transition.fast,
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
    );
  },
);
StyledInput.displayName = 'StyledInput';
