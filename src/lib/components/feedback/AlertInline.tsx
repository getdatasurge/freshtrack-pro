import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { status, type StatusVariant } from '@/lib/design-system/tokens';
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const iconMap: Record<StatusVariant, React.ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  danger: <AlertCircle className="h-4 w-4" />,
  neutral: <Info className="h-4 w-4" />,
};

export interface AlertInlineProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusVariant;
  icon?: React.ReactNode;
}

export const AlertInline = React.forwardRef<HTMLDivElement, AlertInlineProps>(
  ({ className, variant = 'info', icon, children, ...props }, ref) => {
    const colors = status[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn('flex items-center gap-2 text-sm', colors.text, className)}
        {...props}
      >
        <span className="flex-shrink-0">{icon || iconMap[variant]}</span>
        <span>{children}</span>
      </div>
    );
  },
);
AlertInline.displayName = 'AlertInline';
