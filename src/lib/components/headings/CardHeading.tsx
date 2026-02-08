import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { typography } from '@/lib/design-system/tokens';

export interface CardHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export const CardHeading = React.forwardRef<HTMLDivElement, CardHeadingProps>(
  ({ className, title, description, actions, icon, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-start justify-between gap-3', className)} {...props}>
        <div className="flex items-start gap-3 min-w-0">
          {icon && <div className="flex-shrink-0 mt-0.5 [&_svg]:h-5 [&_svg]:w-5 text-zinc-400">{icon}</div>}
          <div>
            <h3 className={typography.h4}>{title}</h3>
            {description && <p className={cn('mt-0.5', typography.bodySmall)}>{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    );
  },
);
CardHeading.displayName = 'CardHeading';
