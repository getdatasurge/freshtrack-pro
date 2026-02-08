import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Thermometer } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { MetricDisplay } from '../primitives/MetricDisplay';
import { TrendIndicator } from '../primitives/TrendIndicator';
import { TimeAgo } from '../primitives/TimeAgo';
import { EmptyState } from '@/lib/components/feedback/EmptyState';
import { Skeleton } from '@/lib/components/feedback/Skeleton';

export interface TemperatureWidgetProps {
  sensorId: string;
  unitId: string;
  currentTemp?: number | null;
  previousTemp?: number | null;
  unit?: string;
  lastReadingAt?: string | null;
  warningHigh?: number | null;
  warningLow?: number | null;
  criticalHigh?: number | null;
  criticalLow?: number | null;
  showGraph?: boolean;
  showAlarmBounds?: boolean;
  compactMode?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function TemperatureWidget({
  sensorId,
  unitId,
  currentTemp,
  previousTemp,
  unit = '\u00B0F',
  lastReadingAt,
  warningHigh,
  warningLow,
  criticalHigh,
  criticalLow,
  showGraph = true,
  showAlarmBounds = true,
  compactMode = false,
  loading,
  error,
  onRetry,
}: TemperatureWidgetProps) {
  const trend = currentTemp != null && previousTemp != null
    ? parseFloat((currentTemp - previousTemp).toFixed(1))
    : null;

  return (
    <WidgetContainer
      title="Temperature"
      icon={<Thermometer />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      compact={compactMode}
    >
      {currentTemp == null ? (
        <EmptyState
          icon={<Thermometer />}
          title="No temperature data yet"
          description="Waiting for the first sensor reading"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <MetricDisplay
              value={currentTemp.toFixed(1)}
              unit={unit}
              size={compactMode ? 'sm' : 'md'}
            />
            <div className="flex flex-col items-end gap-1">
              {trend !== null && <TrendIndicator value={trend} unit={unit} invertColors />}
              {lastReadingAt && <TimeAgo date={lastReadingAt} />}
            </div>
          </div>

          {showAlarmBounds && (warningHigh != null || criticalHigh != null) && (
            <div className={cn('flex items-center gap-4 text-xs', textTokens.tertiary)}>
              {criticalLow != null && (
                <span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />
                  {criticalLow}{unit}
                </span>
              )}
              {warningLow != null && (
                <span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 mr-1" />
                  {warningLow}{unit}
                </span>
              )}
              {warningHigh != null && (
                <span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 mr-1" />
                  {warningHigh}{unit}
                </span>
              )}
              {criticalHigh != null && (
                <span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />
                  {criticalHigh}{unit}
                </span>
              )}
            </div>
          )}

          {showGraph && (
            <div className="h-16 bg-zinc-800/30 rounded-lg flex items-center justify-center">
              <span className={cn('text-xs', textTokens.disabled)}>Sparkline chart area</span>
            </div>
          )}
        </div>
      )}
    </WidgetContainer>
  );
}
