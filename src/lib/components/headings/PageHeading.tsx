import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { typography, text as textTokens } from '@/lib/design-system/tokens';

export interface PageHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  meta?: React.ReactNode;
}

export const PageHeading = React.forwardRef<HTMLDivElement, PageHeadingProps>(
  ({ className, title, description, actions, breadcrumbs, meta, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-1', className)} {...props}>
        {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className={typography.h1}>{title}</h1>
            {description && <p className={cn('mt-1', typography.body)}>{description}</p>}
            {meta && <div className="mt-2">{meta}</div>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    );
  },
);
PageHeading.displayName = 'PageHeading';
