import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, spacing, surface, border, radius } from '@/lib/design-system/tokens';
import { StatusBadge } from '../primitives/StatusBadge';
import { SensorIcon } from '../primitives/SensorIcon';
import { TimeAgo } from '../primitives/TimeAgo';
import { FixedWidgetLayout } from './FixedWidgetLayout';
import { computeUnitStatus } from '../tokens/statusLogic';

export interface UnitDetailLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  unit: {
    id: string;
    name: string;
    sensorKind: string;
    lastReadingAt: string | null;
    uplinkIntervalS: number;
    areaName?: string;
    alerts?: { severity: 'warning' | 'critical' }[];
  };
  /** Props to pass through to widgets (sensorId, unitId, etc.) */
  widgetProps: Record<string, unknown>;
  /** Optional header actions (e.g. edit button) */
  actions?: React.ReactNode;
  /** Optional breadcrumbs */
  breadcrumbs?: React.ReactNode;
}

/**
 * Customer app unit detail page layout.
 * Shows unit header with status, then renders the fixed widget grid for the sensor kind.
 */
export function UnitDetailLayout({
  className,
  unit,
  widgetProps,
  actions,
  breadcrumbs,
  ...props
}: UnitDetailLayoutProps) {
  const unitStatus = computeUnitStatus(unit.lastReadingAt, unit.uplinkIntervalS, unit.alerts);

  return (
    <div className={cn(spacing.page, className)} {...props}>
      {breadcrumbs && <div className="mb-4">{breadcrumbs}</div>}

      {/* Unit header */}
      <div className={cn(
        'flex items-start justify-between gap-4 pb-6 mb-6 border-b',
        border.default,
      )}>
        <div className="flex items-start gap-4">
          <SensorIcon kind={unit.sensorKind} showBackground size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{unit.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <StatusBadge sensorStatus={unitStatus.status} />
              <span className={cn('text-sm', textTokens.tertiary)}>{unitStatus.reason}</span>
              {unit.areaName && (
                <>
                  <span className={textTokens.disabled}>|</span>
                  <span className={cn('text-sm', textTokens.tertiary)}>{unit.areaName}</span>
                </>
              )}
            </div>
            {unit.lastReadingAt && (
              <div className="mt-1">
                <span className={cn('text-xs', textTokens.tertiary)}>Last reading: </span>
                <TimeAgo date={unit.lastReadingAt} />
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Widget grid */}
      <FixedWidgetLayout
        sensorKind={unit.sensorKind}
        widgetProps={widgetProps}
      />
    </div>
  );
}
