import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { SearchX } from 'lucide-react';
import { Button } from '../elements/Button';

export interface NotFoundStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onGoBack?: () => void;
  backLabel?: string;
}

export const NotFoundState = React.forwardRef<HTMLDivElement, NotFoundStateProps>(
  ({ className, title = 'Page not found', description = 'The page you are looking for does not exist.', onGoBack, backLabel = 'Go back', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
        {...props}
      >
        <div className={cn('mb-4', textTokens.disabled)}>
          <SearchX className="h-12 w-12" />
        </div>
        <h3 className={cn('text-base font-medium', textTokens.secondary)}>{title}</h3>
        <p className={cn('mt-1.5 max-w-sm text-sm', textTokens.tertiary)}>{description}</p>
        {onGoBack && (
          <div className="mt-6">
            <Button variant="secondary" size="sm" onClick={onGoBack}>
              {backLabel}
            </Button>
          </div>
        )}
      </div>
    );
  },
);
NotFoundState.displayName = 'NotFoundState';
