import * as React from 'react';
import { getWidget, type WidgetRegistryEntry } from './widgetRegistry';

export interface WidgetPlacement {
  widgetId: string;
  instanceId: string;
  props: Record<string, unknown>;
  position?: { x: number; y: number; w: number; h: number };
}

/**
 * Render a widget from the registry by its ID.
 * Wraps in React.Suspense with a skeleton fallback.
 */
export function renderWidget(
  placement: WidgetPlacement,
  fallback?: React.ReactNode,
): React.ReactNode {
  const entry = getWidget(placement.widgetId);
  if (!entry) {
    return (
      <div key={placement.instanceId} className="flex items-center justify-center h-full p-4 text-sm text-zinc-500 bg-zinc-900 rounded-lg border border-zinc-800">
        Unknown widget: {placement.widgetId}
      </div>
    );
  }

  const Component = entry.component;
  const defaultFallback = (
    <div className="animate-pulse bg-zinc-800/50 rounded-lg h-full min-h-[100px]" />
  );

  return (
    <React.Suspense key={placement.instanceId} fallback={fallback || defaultFallback}>
      <Component {...placement.props} />
    </React.Suspense>
  );
}

/**
 * Create a WidgetPlacement from a registry entry with default sizing.
 */
export function createPlacement(
  entry: WidgetRegistryEntry,
  props: Record<string, unknown>,
  position?: { x: number; y: number },
): WidgetPlacement {
  return {
    widgetId: entry.id,
    instanceId: `${entry.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    props,
    position: position
      ? { ...position, w: entry.defaultSize.cols, h: entry.defaultSize.rows }
      : undefined,
  };
}

/**
 * Build default placements for a sensor kind using the default widget layout.
 */
export function buildDefaultPlacements(
  widgetIds: string[],
  commonProps: Record<string, unknown>,
  columns: number = 3,
): WidgetPlacement[] {
  let x = 0;
  let y = 0;

  return widgetIds
    .map((id) => {
      const entry = getWidget(id);
      if (!entry) return null;

      const placement: WidgetPlacement = {
        widgetId: id,
        instanceId: `${id}-default`,
        props: commonProps,
        position: {
          x,
          y,
          w: entry.defaultSize.cols,
          h: entry.defaultSize.rows,
        },
      };

      x += entry.defaultSize.cols;
      if (x >= columns) {
        x = 0;
        y += 1;
      }

      return placement;
    })
    .filter(Boolean) as WidgetPlacement[];
}
