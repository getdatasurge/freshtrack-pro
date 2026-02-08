import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { getWidgetsForApp, type WidgetRegistryEntry } from '../registry/widgetRegistry';
import { renderWidget, type WidgetPlacement } from '../registry/widgetFactory';

// ============================================================================
// Customer App Fixed Widget Layouts
// No drag/drop — pure CSS grid, layout determined by sensor_kind.
// Admin-designed default layouts can override these via default_widget_layouts table.
// ============================================================================

export interface FixedLayoutConfig {
  widgetIds: string[];
  columns: number;
  /** CSS grid-template-areas for precise placement */
  areas?: string;
  /** Map widget ID to grid-area name */
  areaMap?: Record<string, string>;
}

/** Default fixed layouts per sensor_kind for customer app */
export const CUSTOMER_LAYOUTS: Record<string, FixedLayoutConfig> = {
  temp: {
    widgetIds: ['temperature', 'humidity', 'battery', 'alerts', 'compliance-score'],
    columns: 3,
    areas: `
      "temp      humidity  battery"
      "alerts    alerts    compliance"
    `,
    areaMap: {
      temperature: 'temp',
      humidity: 'humidity',
      battery: 'battery',
      alerts: 'alerts',
      'compliance-score': 'compliance',
    },
  },
  door: {
    widgetIds: ['door', 'battery', 'alerts', 'compliance-score'],
    columns: 3,
    areas: `
      "door   battery  compliance"
      "door   alerts   alerts"
    `,
    areaMap: {
      door: 'door',
      battery: 'battery',
      alerts: 'alerts',
      'compliance-score': 'compliance',
    },
  },
  combo: {
    widgetIds: ['temperature', 'door', 'humidity', 'battery', 'alerts', 'compliance-score'],
    columns: 3,
    areas: `
      "temp   door     humidity"
      "battery alerts   compliance"
    `,
    areaMap: {
      temperature: 'temp',
      door: 'door',
      humidity: 'humidity',
      battery: 'battery',
      alerts: 'alerts',
      'compliance-score': 'compliance',
    },
  },
  co2: {
    widgetIds: ['temperature', 'humidity', 'battery', 'alerts', 'compliance-score'],
    columns: 3,
    areas: `
      "temp      humidity  battery"
      "alerts    alerts    compliance"
    `,
    areaMap: {
      temperature: 'temp',
      humidity: 'humidity',
      battery: 'battery',
      alerts: 'alerts',
      'compliance-score': 'compliance',
    },
  },
  unit_overview: {
    widgetIds: ['alerts', 'compliance-score'],
    columns: 2,
    areas: `"alerts compliance"`,
    areaMap: {
      alerts: 'alerts',
      'compliance-score': 'compliance',
    },
  },
  site_overview: {
    widgetIds: ['alerts', 'compliance-score'],
    columns: 2,
    areas: `"alerts compliance"`,
    areaMap: {
      alerts: 'alerts',
      'compliance-score': 'compliance',
    },
  },
};

export interface FixedWidgetLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sensor kind to determine layout */
  sensorKind: string;
  /** Props to pass to every widget */
  widgetProps: Record<string, unknown>;
  /** Override the default layout config */
  layoutOverride?: FixedLayoutConfig;
  /** Gap between widgets in pixels */
  gap?: number;
}

/**
 * Customer app fixed widget layout.
 * Renders widgets in a predetermined CSS grid based on sensor_kind.
 * No drag/drop, no resize — pure display.
 */
export function FixedWidgetLayout({
  className,
  sensorKind,
  widgetProps,
  layoutOverride,
  gap = 16,
  ...props
}: FixedWidgetLayoutProps) {
  const config = layoutOverride || CUSTOMER_LAYOUTS[sensorKind] || CUSTOMER_LAYOUTS.temp;

  const placements: WidgetPlacement[] = config.widgetIds.map((id) => ({
    widgetId: id,
    instanceId: `fixed-${id}`,
    props: widgetProps,
  }));

  // Use grid-template-areas if defined
  if (config.areas && config.areaMap) {
    return (
      <div
        className={cn('grid', className)}
        style={{
          gridTemplateColumns: `repeat(${config.columns}, 1fr)`,
          gridTemplateAreas: config.areas,
          gap: `${gap}px`,
        }}
        {...props}
      >
        {placements.map((placement) => {
          const area = config.areaMap?.[placement.widgetId];
          return (
            <div key={placement.instanceId} style={area ? { gridArea: area } : undefined}>
              {renderWidget(placement)}
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: simple auto-flow grid
  return (
    <div
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${config.columns}, 1fr)`,
        gap: `${gap}px`,
      }}
      {...props}
    >
      {placements.map((placement) => (
        <div key={placement.instanceId}>
          {renderWidget(placement)}
        </div>
      ))}
    </div>
  );
}
