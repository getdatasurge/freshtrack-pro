import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { StackedListItem } from '@/lib/components/data-display/StackedListItem';
import { StatusBadge } from '../primitives/StatusBadge';
import { TimeAgo } from '../primitives/TimeAgo';
import { SensorIcon } from '../primitives/SensorIcon';
import { computeUnitStatus } from '../tokens/statusLogic';

export interface UnitSummaryCardProps {
  unit: {
    id: string;
    name: string;
    sensorKind?: string;
    lastReadingAt: string | null;
    uplinkIntervalS: number;
    alerts?: { severity: 'warning' | 'critical' }[];
    currentTemp?: number | null;
    tempUnit?: string;
  };
  onClick?: () => void;
  className?: string;
}

export function UnitSummaryCard({ unit, onClick, className }: UnitSummaryCardProps) {
  const unitStatus = computeUnitStatus(unit.lastReadingAt, unit.uplinkIntervalS, unit.alerts);

  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-sm overflow-hidden', className)}>
      <StackedListItem
        title={unit.name}
        description={unitStatus.reason}
        leading={<SensorIcon kind={unit.sensorKind || 'temperature'} showBackground size="md" />}
        meta={<StatusBadge sensorStatus={unitStatus.status} />}
        trailing={
          unit.currentTemp != null ? (
            <span className="text-sm font-medium tabular-nums text-foreground">
              {unit.currentTemp.toFixed(1)}{unit.tempUnit || '\u00B0F'}
            </span>
          ) : unit.lastReadingAt ? (
            <TimeAgo date={unit.lastReadingAt} />
          ) : undefined
        }
        navigable={!!onClick}
        onClick={onClick}
      />
    </div>
  );
}
