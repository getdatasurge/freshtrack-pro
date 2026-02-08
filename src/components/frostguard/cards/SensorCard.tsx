import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, surface, border, radius, transition } from '@/lib/design-system/tokens';
import { SensorIcon } from '../primitives/SensorIcon';
import { StatusBadge } from '../primitives/StatusBadge';
import { TimeAgo } from '../primitives/TimeAgo';
import { computeUnitStatus, type UnitStatusResult } from '../tokens/statusLogic';

export interface SensorCardProps {
  sensor: {
    id: string;
    name: string;
    kind: string;
    lastReadingAt: string | null;
    uplinkIntervalS: number;
    alerts?: { severity: 'warning' | 'critical' }[];
    currentValue?: number | null;
    unit?: string;
  };
  onClick?: () => void;
  className?: string;
}

export function SensorCard({ sensor, onClick, className }: SensorCardProps) {
  const sensorStatus = computeUnitStatus(sensor.lastReadingAt, sensor.uplinkIntervalS, sensor.alerts);

  return (
    <div
      className={cn(
        'border p-4',
        surface.raised,
        border.default,
        radius.lg,
        onClick && `cursor-pointer hover:border-zinc-700 ${transition.default}`,
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <SensorIcon kind={sensor.kind} showBackground size="md" />
          <div>
            <h4 className={cn('text-sm font-medium', textTokens.primary)}>{sensor.name}</h4>
            <p className={cn('text-xs mt-0.5', textTokens.tertiary)}>{sensor.kind}</p>
          </div>
        </div>
        <StatusBadge sensorStatus={sensorStatus.status} />
      </div>
      <div className="mt-3 flex items-end justify-between">
        {sensor.currentValue != null ? (
          <span className="text-xl font-semibold tabular-nums text-zinc-50">
            {sensor.currentValue.toFixed(1)}
            {sensor.unit && <span className="text-sm font-normal text-zinc-400 ml-0.5">{sensor.unit}</span>}
          </span>
        ) : (
          <span className={cn('text-sm', textTokens.tertiary)}>No data</span>
        )}
        {sensor.lastReadingAt && <TimeAgo date={sensor.lastReadingAt} />}
      </div>
    </div>
  );
}
