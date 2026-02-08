import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition } from '@/lib/design-system/tokens';

export interface InputWithAddonProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingAddon?: React.ReactNode;
  trailingAddon?: React.ReactNode;
  hasError?: boolean;
}

export const InputWithAddon = React.forwardRef<HTMLInputElement, InputWithAddonProps>(
  ({ className, leadingAddon, trailingAddon, hasError, ...props }, ref) => {
    return (
      <div className="flex">
        {leadingAddon && (
          <div
            className={cn(
              'inline-flex items-center px-3 border border-r-0 rounded-l-lg',
              surface.sunken,
              border.strong,
              'text-sm',
              textTokens.tertiary,
            )}
          >
            {leadingAddon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'flex-1 min-w-0 px-3 py-2 text-sm',
            surface.raised,
            'border',
            hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
            textTokens.primary,
            'placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
            transition.fast,
            !leadingAddon && !trailingAddon && radius.md,
            leadingAddon && !trailingAddon && 'rounded-r-lg',
            !leadingAddon && trailingAddon && 'rounded-l-lg',
            leadingAddon && trailingAddon && '',
            className,
          )}
          {...props}
        />
        {trailingAddon && (
          <div
            className={cn(
              'inline-flex items-center px-3 border border-l-0 rounded-r-lg',
              surface.sunken,
              border.strong,
              'text-sm',
              textTokens.tertiary,
            )}
          >
            {trailingAddon}
          </div>
        )}
      </div>
    );
  },
);
InputWithAddon.displayName = 'InputWithAddon';
