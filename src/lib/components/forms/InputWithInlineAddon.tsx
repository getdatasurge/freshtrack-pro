import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition } from '@/lib/design-system/tokens';

export interface InputWithInlineAddonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  hasError?: boolean;
}

export const InputWithInlineAddon = React.forwardRef<HTMLInputElement, InputWithInlineAddonProps>(
  ({ className, prefix, suffix, hasError, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex items-center border',
          surface.raised,
          hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
          radius.md,
          'focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500',
          transition.fast,
        )}
      >
        {prefix && <span className={cn('pl-3 text-sm', textTokens.tertiary)}>{prefix}</span>}
        <input
          ref={ref}
          className={cn(
            'flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none',
            textTokens.primary,
            'placeholder:text-zinc-500',
            prefix && 'pl-1',
            suffix && 'pr-1',
            className,
          )}
          {...props}
        />
        {suffix && <span className={cn('pr-3 text-sm', textTokens.tertiary)}>{suffix}</span>}
      </div>
    );
  },
);
InputWithInlineAddon.displayName = 'InputWithInlineAddon';
