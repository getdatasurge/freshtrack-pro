import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius, text as textTokens } from '@/lib/design-system/tokens';
import { Button } from '../elements/Button';

export interface ActionPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'danger';
  loading?: boolean;
}

export const ActionPanel = React.forwardRef<HTMLDivElement, ActionPanelProps>(
  ({ className, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, variant = 'default', loading, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(surface.raised, 'border', border.default, radius.lg, 'p-5', className)}
        {...props}
      >
        <h4 className={cn('text-sm font-medium', textTokens.primary)}>{title}</h4>
        {description && <p className={cn('mt-1 text-sm', textTokens.tertiary)}>{description}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
        </div>
      </div>
    );
  },
);
ActionPanel.displayName = 'ActionPanel';
