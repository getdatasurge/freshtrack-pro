import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, status } from '@/lib/design-system/tokens';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../elements/Button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ className, title = 'Something went wrong', message, onRetry, retryLabel = 'Try again', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
        {...props}
      >
        <div className={cn('mb-4', status.danger.icon)}>
          <AlertTriangle className="h-12 w-12" />
        </div>
        <h3 className={cn('text-base font-medium', textTokens.secondary)}>{title}</h3>
        {message && (
          <p className={cn('mt-1.5 max-w-sm text-sm', textTokens.tertiary)}>{message}</p>
        )}
        {onRetry && (
          <div className="mt-6">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        )}
      </div>
    );
  },
);
ErrorState.displayName = 'ErrorState';
