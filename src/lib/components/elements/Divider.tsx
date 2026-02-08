import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border, text as textTokens } from '@/lib/design-system/tokens';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, label, orientation = 'horizontal', ...props }, ref) => {
    if (orientation === 'vertical') {
      return (
        <div
          ref={ref}
          role="separator"
          aria-orientation="vertical"
          className={cn('inline-block h-full w-px', border.default, 'bg-zinc-800', className)}
          {...props}
        />
      );
    }

    if (label) {
      return (
        <div ref={ref} role="separator" className={cn('relative flex items-center', className)} {...props}>
          <div className={cn('flex-1 border-t', border.default)} />
          <span className={cn('px-3 text-xs font-medium', textTokens.tertiary)}>{label}</span>
          <div className={cn('flex-1 border-t', border.default)} />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role="separator"
        className={cn('w-full border-t', border.default, className)}
        {...props}
      />
    );
  },
);
Divider.displayName = 'Divider';
