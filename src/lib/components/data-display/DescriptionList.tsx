import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border, text as textTokens } from '@/lib/design-system/tokens';

export interface DescriptionListItem {
  label: string;
  value: React.ReactNode;
}

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: DescriptionListItem[];
  layout?: 'stacked' | 'horizontal';
  bordered?: boolean;
}

export const DescriptionList = React.forwardRef<HTMLDListElement, DescriptionListProps>(
  ({ className, items, layout = 'stacked', bordered = true, ...props }, ref) => {
    return (
      <dl
        ref={ref}
        className={cn(
          layout === 'horizontal' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-0 divide-y divide-zinc-800',
          className,
        )}
        {...props}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            className={cn(
              layout === 'horizontal'
                ? ''
                : cn('flex justify-between gap-4 py-3', idx === 0 && 'pt-0'),
            )}
          >
            <dt className={cn('text-sm', textTokens.tertiary, layout === 'horizontal' && 'mb-1')}>
              {item.label}
            </dt>
            <dd className={cn('text-sm font-medium', textTokens.primary, layout === 'horizontal' ? '' : 'text-right')}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  },
);
DescriptionList.displayName = 'DescriptionList';
