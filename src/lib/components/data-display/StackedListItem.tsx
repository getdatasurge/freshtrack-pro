import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border, text as textTokens, transition } from '@/lib/design-system/tokens';
import { ChevronRight } from 'lucide-react';

export interface StackedListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  navigable?: boolean;
  href?: string;
  as?: React.ElementType;
}

export const StackedListItem = React.forwardRef<HTMLDivElement, StackedListItemProps>(
  ({ className, title, description, meta, leading, trailing, navigable, href, as, ...props }, ref) => {
    const Comp: React.ElementType = as || (href ? 'a' : 'div');

    return (
      <Comp
        ref={ref}
        href={href}
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          `border-b ${border.subtle}`,
          'last:border-b-0',
          navigable && `hover:bg-zinc-800/50 cursor-pointer ${transition.fast}`,
          className,
        )}
        {...props}
      >
        {leading && <div className="flex-shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-sm font-medium truncate', textTokens.primary)}>{title}</p>
            {meta && <div className="flex-shrink-0">{meta}</div>}
          </div>
          {description && <p className={cn('text-sm truncate mt-0.5', textTokens.tertiary)}>{description}</p>}
        </div>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
        {navigable && !trailing && <ChevronRight className={cn('h-4 w-4 flex-shrink-0', textTokens.disabled)} />}
      </Comp>
    );
  },
);
StackedListItem.displayName = 'StackedListItem';
