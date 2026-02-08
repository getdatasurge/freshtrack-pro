import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius, shadow, transition } from '@/lib/design-system/tokens';

export type CardVariant = 'elevated' | 'outlined' | 'flat' | 'interactive';

const variantClasses: Record<CardVariant, string> = {
  elevated: `${surface.raised} border ${border.default} ${radius.lg} ${shadow.sm}`,
  outlined: `bg-transparent border ${border.default} ${radius.lg}`,
  flat: `bg-zinc-900/50 ${radius.lg}`,
  interactive: `${surface.raised} border ${border.default} ${radius.lg} ${shadow.sm} hover:border-zinc-700 hover:shadow-md cursor-pointer ${transition.default}`,
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'compact' | 'default' | 'loose';
}

const paddingClasses = {
  none: '',
  compact: 'p-3',
  default: 'p-5',
  loose: 'p-6',
} as const;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'elevated', padding = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(variantClasses[variant], paddingClasses[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';
