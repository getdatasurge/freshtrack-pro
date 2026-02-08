import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, transition } from '@/lib/design-system/tokens';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
}

export const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ className, items, separator, ...props }, ref) => {
    return (
      <nav ref={ref} aria-label="Breadcrumb" className={className} {...props}>
        <ol className="flex items-center gap-1.5">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;

            return (
              <li key={idx} className="flex items-center gap-1.5">
                {idx > 0 && (
                  <span className={textTokens.disabled}>
                    {separator || <ChevronRight className="h-3.5 w-3.5" />}
                  </span>
                )}
                {isLast ? (
                  <span className={cn('text-sm font-medium', textTokens.primary)} aria-current="page">
                    {item.label}
                  </span>
                ) : item.href ? (
                  <a
                    href={item.href}
                    className={cn('text-sm', textTokens.tertiary, 'hover:text-zinc-300', transition.fast)}
                    onClick={item.onClick}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={cn('text-sm', textTokens.tertiary, 'hover:text-zinc-300', transition.fast)}
                  >
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);
Breadcrumbs.displayName = 'Breadcrumbs';
