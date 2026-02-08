import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Button } from '../elements/Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, secondaryAction, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
        {...props}
      >
        {icon && (
          <div className={cn('mb-4 [&_svg]:h-12 [&_svg]:w-12', textTokens.disabled)}>
            {icon}
          </div>
        )}
        <h3 className={cn('text-base font-medium', textTokens.secondary)}>{title}</h3>
        {description && (
          <p className={cn('mt-1.5 max-w-sm text-sm', textTokens.tertiary)}>{description}</p>
        )}
        {(action || secondaryAction) && (
          <div className="mt-6 flex items-center gap-3">
            {action && (
              <Button variant="primary" size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  },
);
EmptyState.displayName = 'EmptyState';
