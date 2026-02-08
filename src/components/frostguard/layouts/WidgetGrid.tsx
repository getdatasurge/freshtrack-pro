import * as React from 'react';
import { cn } from '@/lib/design-system/cn';

export interface WidgetGridItem {
  id: string;
  component: React.ReactNode;
  cols?: number;
  rows?: number;
}

export interface WidgetGridProps extends React.HTMLAttributes<HTMLDivElement> {
  items: WidgetGridItem[];
  columns?: number;
  gap?: number;
}

/**
 * Widget grid layout.
 * Uses CSS grid by default. For drag/resize, wrap with react-grid-layout externally.
 */
export const WidgetGrid = React.forwardRef<HTMLDivElement, WidgetGridProps>(
  ({ className, items, columns = 3, gap = 16, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('grid', className)}
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`,
        }}
        {...props}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              gridColumn: item.cols ? `span ${item.cols}` : undefined,
              gridRow: item.rows ? `span ${item.rows}` : undefined,
            }}
          >
            {item.component}
          </div>
        ))}
      </div>
    );
  },
);
WidgetGrid.displayName = 'WidgetGrid';
