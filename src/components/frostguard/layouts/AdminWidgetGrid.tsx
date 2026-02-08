import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
// @ts-ignore — react-grid-layout has no type declarations installed
import { Responsive, WidthProvider } from 'react-grid-layout';
import { renderWidget, type WidgetPlacement } from '../registry/widgetFactory';
import { getWidget } from '../registry/widgetRegistry';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface AdminWidgetGridProps {
  placements: WidgetPlacement[];
  columns?: number;
  rowHeight?: number;
  editable?: boolean;
  onLayoutChange?: (placements: WidgetPlacement[]) => void;
  className?: string;
}

interface RGLLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

/**
 * Admin-only widget grid with drag/drop and resize via react-grid-layout.
 * Used in the widget builder and layout manager.
 */
export function AdminWidgetGrid({
  placements,
  columns = 3,
  rowHeight = 180,
  editable = true,
  onLayoutChange,
  className,
}: AdminWidgetGridProps) {
  const layout: RGLLayout[] = placements.map((p) => {
    const entry = getWidget(p.widgetId);
    return {
      i: p.instanceId,
      x: p.position?.x ?? 0,
      y: p.position?.y ?? 0,
      w: p.position?.w ?? entry?.defaultSize.cols ?? 1,
      h: p.position?.h ?? entry?.defaultSize.rows ?? 1,
      minW: entry?.minSize.cols ?? 1,
      minH: entry?.minSize.rows ?? 1,
      maxW: entry?.maxSize.cols ?? 3,
      maxH: entry?.maxSize.rows ?? 3,
      static: !editable,
    };
  });

  const handleLayoutChange = React.useCallback(
    (newLayout: RGLLayout[]) => {
      if (!onLayoutChange) return;
      const updated = placements.map((p) => {
        const item = newLayout.find((l) => l.i === p.instanceId);
        if (!item) return p;
        return {
          ...p,
          position: { x: item.x, y: item.y, w: item.w, h: item.h },
        };
      });
      onLayoutChange(updated);
    },
    [placements, onLayoutChange],
  );

  return (
    <div className={cn('admin-widget-grid', className)}>
      <ResponsiveGridLayout
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
        cols={{ lg: columns, md: 2, sm: 1 }}
        rowHeight={rowHeight}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        margin={[16, 16]}
      >
        {placements.map((placement) => (
          <div key={placement.instanceId} className="relative">
            {editable && (
              <div className="widget-drag-handle absolute top-0 left-0 right-0 h-8 cursor-move z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="h-1 w-8 rounded-full bg-zinc-600" />
              </div>
            )}
            {renderWidget(placement)}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
