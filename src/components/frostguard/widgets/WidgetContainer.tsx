import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { Card } from '@/lib/components';
import { CardHeading } from '@/lib/components/headings/CardHeading';
import { Spinner } from '@/lib/components/feedback/Spinner';
import { ErrorState } from '@/lib/components/feedback/ErrorState';

export interface WidgetContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const WidgetContainer = React.forwardRef<HTMLDivElement, WidgetContainerProps>(
  ({ className, title, description, icon, actions, loading, error, onRetry, compact, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        variant="elevated"
        padding={compact ? 'compact' : 'default'}
        className={cn('flex flex-col h-full', className)}
        role="region"
        aria-label={title}
        aria-busy={loading || undefined}
        {...props}
      >
        <CardHeading title={title} description={description} icon={icon} actions={actions} />
        <div className="flex-1 mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status">
              <Spinner size="md" label="Loading..." />
            </div>
          ) : error ? (
            <div role="alert">
              <ErrorState title="Error" message={error} onRetry={onRetry} />
            </div>
          ) : (
            children
          )}
        </div>
      </Card>
    );
  },
);
WidgetContainer.displayName = 'WidgetContainer';
