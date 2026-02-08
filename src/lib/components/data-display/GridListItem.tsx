import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius, transition, text as textTokens } from '@/lib/design-system/tokens';

export interface GridListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  interactive?: boolean;
}

export const GridListItem = React.forwardRef<HTMLDivElement, GridListItemProps>(
  ({ className, title, description, icon, meta, interactive, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'border p-4',
          surface.raised,
          border.default,
          radius.lg,
          interactive && `hover:border-zinc-700 cursor-pointer ${transition.default}`,
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          {icon && <div className={cn('flex-shrink-0 mt-0.5 [&_svg]:h-5 [&_svg]:w-5', textTokens.tertiary)}>{icon}</div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={cn('text-sm font-medium truncate', textTokens.primary)}>{title}</h4>
              {meta && <div className="flex-shrink-0">{meta}</div>}
            </div>
            {description && <p className={cn('text-sm mt-0.5 line-clamp-2', textTokens.tertiary)}>{description}</p>}
          </div>
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    );
  },
);
GridListItem.displayName = 'GridListItem';
