import { useCallback, useMemo, useState } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { LayoutConfig, WidgetPosition } from "../types";
import { GRID_CONFIG } from "../types";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";
import { WidgetWrapper } from "./WidgetWrapper";
import { GridOverlay } from "./GridOverlay";
import { ResizeSizeLabel } from "./ResizeSizeLabel";

interface GridCanvasProps {
  layout: LayoutConfig;
  isCustomizing: boolean;
  onLayoutChange: (newPositions: WidgetPosition[]) => void;
  widgetProps: Record<string, Record<string, unknown>>;
  onHideWidget: (widgetId: string) => void;
  containerWidth?: number;
}

export function GridCanvas({
  layout,
  isCustomizing,
  onLayoutChange,
  widgetProps,
  onHideWidget,
  containerWidth = 1200,
}: GridCanvasProps) {
  // Resize/drag state for grid overlay and size label
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [resizeSize, setResizeSize] = useState<{ w: number; h: number } | null>(null);

  // Show grid overlay when actively resizing or dragging
  const isInteracting = isResizing || isDragging;

  const hiddenWidgets = layout.hiddenWidgets || [];

  // Filter out hidden widgets
  const visibleWidgets = useMemo(
    () => layout.widgets.filter((w) => !hiddenWidgets.includes(w.i)),
    [layout.widgets, hiddenWidgets]
  );

  // Convert to react-grid-layout format
  const gridLayout: Layout[] = useMemo(
    () =>
      visibleWidgets.map((widget) => ({
        i: widget.i,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        minW: widget.minW,
        minH: widget.minH,
        maxW: widget.maxW,
        maxH: widget.maxH,
        static: !isCustomizing,
      })),
    [visibleWidgets, isCustomizing]
  );

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      // Convert back to our WidgetPosition format
      const positions: WidgetPosition[] = newLayout.map((item) => {
        const original = layout.widgets.find((w) => w.i === item.i);
        return {
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: original?.minW,
          minH: original?.minH,
          maxW: original?.maxW,
          maxH: original?.maxH,
        };
      });

      // Add back hidden widgets (preserve their positions)
      const hiddenPositions = layout.widgets.filter((w) =>
        hiddenWidgets.includes(w.i)
      );
      onLayoutChange([...positions, ...hiddenPositions]);
    },
    [layout.widgets, hiddenWidgets, onLayoutChange]
  );

  // Check if widget can be hidden (not mandatory)
  const canHideWidget = useCallback((widgetId: string) => {
    const widgetDef = WIDGET_REGISTRY[widgetId];
    return widgetDef ? !widgetDef.mandatory : true;
  }, []);

  // Resize lifecycle handlers
  const handleResizeStart = useCallback(
    (_layout: Layout[], _oldItem: Layout, newItem: Layout) => {
      setIsResizing(true);
      setActiveItemId(newItem.i);
      setResizeSize({ w: newItem.w, h: newItem.h });
    },
    []
  );

  const handleResize = useCallback(
    (_layout: Layout[], _oldItem: Layout, newItem: Layout) => {
      setResizeSize({ w: newItem.w, h: newItem.h });
    },
    []
  );

  const handleResizeStop = useCallback(() => {
    setIsResizing(false);
    setActiveItemId(null);
    setResizeSize(null);
  }, []);

  // Drag lifecycle handlers
  const handleDragStart = useCallback(
    (_layout: Layout[], _oldItem: Layout, newItem: Layout) => {
      setIsDragging(true);
      setActiveItemId(newItem.i);
    },
    []
  );

  const handleDragStop = useCallback(() => {
    setIsDragging(false);
    setActiveItemId(null);
  }, []);

  return (
    <div
      className={`grid-canvas relative ${
        isCustomizing ? "customizing" : ""
      }`}
    >
      {/* Grid overlay - visible during resize/drag */}
      <GridOverlay 
        containerWidth={containerWidth} 
        isVisible={isInteracting}
      />

      {/* Size label during resize */}
      <ResizeSizeLabel
        width={resizeSize?.w ?? 0}
        height={resizeSize?.h ?? 0}
        isVisible={isResizing && resizeSize !== null}
      />

      <GridLayout
        className="layout"
        layout={gridLayout}
        cols={GRID_CONFIG.cols}
        rowHeight={GRID_CONFIG.rowHeight}
        width={containerWidth}
        margin={GRID_CONFIG.margin as [number, number]}
        containerPadding={GRID_CONFIG.containerPadding as [number, number]}
        isDraggable={isCustomizing}
        isResizable={isCustomizing}
        resizeHandles={['se', 'e', 's']}
        onLayoutChange={handleLayoutChange}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        draggableHandle=".widget-drag-handle"
        useCSSTransforms={true}
        compactType="vertical"
        preventCollision={false}
      >
        {visibleWidgets.map((widget) => (
          <div key={widget.i} className="widget-container h-full">
            <WidgetWrapper
              widgetId={widget.i}
              isCustomizing={isCustomizing}
              isResizing={isResizing && activeItemId === widget.i}
              canHide={canHideWidget(widget.i)}
              onHide={() => onHideWidget(widget.i)}
              props={widgetProps[widget.i] || {}}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
