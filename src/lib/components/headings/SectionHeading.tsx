import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { typography, border } from '@/lib/design-system/tokens';

export interface SectionHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  bordered?: boolean;
}

export const SectionHeading = React.forwardRef<HTMLDivElement, SectionHeadingProps>(
  ({ className, title, description, actions, bordered = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-4',
          bordered && `pb-4 border-b ${border.default}`,
          className,
        )}
        {...props}
      >
        <div>
          <h2 className={typography.h3}>{title}</h2>
          {description && <p className={cn('mt-1', typography.bodySmall)}>{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    );
  },
);
SectionHeading.displayName = 'SectionHeading';
