import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, status, transition, zIndex, shadow, type StatusVariant } from '@/lib/design-system/tokens';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const iconMap: Record<StatusVariant, React.ReactNode> = {
  info: <Info className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  danger: <AlertCircle className="h-5 w-5" />,
  neutral: <Info className="h-5 w-5" />,
};

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusVariant;
  title: string;
  description?: string;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = 'neutral', title, description, onDismiss, action, ...props }, ref) => {
    const colors = status[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'pointer-events-auto flex w-full max-w-sm gap-3 rounded-xl border p-4',
          surface.overlay,
          border.default,
          shadow.lg,
          zIndex.toast,
          'motion-safe:animate-[slideUp_200ms_ease-out]',
          className,
        )}
        {...props}
      >
        <div className={cn('flex-shrink-0 mt-0.5', colors.icon)}>
          {iconMap[variant]}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium', textTokens.primary)}>{title}</p>
          {description && (
            <p className={cn('mt-1 text-sm', textTokens.tertiary)}>{description}</p>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={cn('mt-2 text-sm font-medium', colors.text, transition.fast)}
            >
              {action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'flex-shrink-0 rounded-md p-0.5',
              textTokens.tertiary,
              'hover:text-zinc-300',
              transition.fast,
            )}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);
Toast.displayName = 'Toast';
