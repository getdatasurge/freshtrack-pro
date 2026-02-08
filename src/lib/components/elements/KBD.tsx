import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens } from '@/lib/design-system/tokens';

export interface KBDProps extends React.HTMLAttributes<HTMLElement> {
  keys?: string[];
}

export const KBD = React.forwardRef<HTMLElement, KBDProps>(
  ({ className, keys, children, ...props }, ref) => {
    const renderKey = (key: string, idx: number) => (
      <React.Fragment key={idx}>
        {idx > 0 && <span className={textTokens.tertiary}>+</span>}
        <kbd
          className={cn(
            'inline-flex items-center justify-center rounded px-1.5 py-0.5',
            'text-[11px] font-medium font-mono leading-none',
            'border shadow-sm shadow-black/20',
            surface.raised,
            border.default,
            textTokens.secondary,
          )}
        >
          {key}
        </kbd>
      </React.Fragment>
    );

    if (keys) {
      return (
        <span ref={ref} className={cn('inline-flex items-center gap-0.5', className)} {...props}>
          {keys.map(renderKey)}
        </span>
      );
    }

    return (
      <kbd
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded px-1.5 py-0.5',
          'text-[11px] font-medium font-mono leading-none',
          'border shadow-sm shadow-black/20',
          surface.raised,
          border.default,
          textTokens.secondary,
          className,
        )}
        {...props}
      >
        {children}
      </kbd>
    );
  },
);
KBD.displayName = 'KBD';
