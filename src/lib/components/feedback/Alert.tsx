import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { status, type StatusVariant, transition } from '@/lib/design-system/tokens';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

const iconMap: Record<StatusVariant, React.ReactNode> = {
  info: <Info className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  danger: <AlertCircle className="h-5 w-5" />,
  neutral: <Info className="h-5 w-5" />,
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusVariant;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  accentBorder?: boolean;
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, dismissible, onDismiss, accentBorder = false, icon, children, ...props }, ref) => {
    const [dismissed, setDismissed] = React.useState(false);
    const colors = status[variant];

    if (dismissed) return null;

    const handleDismiss = () => {
      setDismissed(true);
      onDismiss?.();
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative flex gap-3 rounded-lg border p-4',
          colors.bg,
          colors.border,
          accentBorder && 'border-l-4',
          transition.fast,
          className,
        )}
        {...props}
      >
        <div className={cn('flex-shrink-0', colors.icon)}>
          {icon || iconMap[variant]}
        </div>
        <div className="flex-1 min-w-0">
          {title && <h4 className={cn('text-sm font-medium', colors.text)}>{title}</h4>}
          {children && (
            <div className={cn('text-sm', colors.text, 'opacity-90', title && 'mt-1')}>
              {children}
            </div>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className={cn('flex-shrink-0 rounded-md p-0.5', 'hover:bg-white/10', transition.fast)}
            aria-label="Dismiss"
          >
            <X className={cn('h-4 w-4', colors.icon)} />
          </button>
        )}
      </div>
    );
  },
);
Alert.displayName = 'Alert';
