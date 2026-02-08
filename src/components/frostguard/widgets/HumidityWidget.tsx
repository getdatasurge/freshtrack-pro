import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Droplets } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { MetricDisplay } from '../primitives/MetricDisplay';
import { TrendIndicator } from '../primitives/TrendIndicator';
import { TimeAgo } from '../primitives/TimeAgo';
import { EmptyState } from '@/lib/components/feedback/EmptyState';

export interface HumidityWidgetProps {
  sensorId: string;
  unitId: string;
  currentHumidity?: number | null;
  previousHumidity?: number | null;
  lastReadingAt?: string | null;
  warningHigh?: number | null;
  warningLow?: number | null;
  showGraph?: boolean;
  compactMode?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function HumidityWidget({
  sensorId,
  unitId,
  currentHumidity,
  previousHumidity,
  lastReadingAt,
  warningHigh,
  warningLow,
  showGraph = true,
  compactMode = false,
  loading,
  error,
  onRetry,
}: HumidityWidgetProps) {
  const trend = currentHumidity != null && previousHumidity != null
    ? parseFloat((currentHumidity - previousHumidity).toFixed(1))
    : null;

  return (
    <WidgetContainer
      title="Humidity"
      icon={<Droplets />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      compact={compactMode}
    >
      {currentHumidity == null ? (
        <EmptyState
          icon={<Droplets />}
          title="No humidity data yet"
          description="Waiting for the first sensor reading"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <MetricDisplay
              value={currentHumidity.toFixed(1)}
              unit="%"
              size={compactMode ? 'sm' : 'md'}
            />
            <div className="flex flex-col items-end gap-1">
              {trend !== null && <TrendIndicator value={trend} unit="%" />}
              {lastReadingAt && <TimeAgo date={lastReadingAt} />}
            </div>
          </div>

          {(warningHigh != null || warningLow != null) && (
            <div className={cn('flex items-center gap-4 text-xs', textTokens.tertiary)}>
              {warningLow != null && <span>Low: {warningLow}%</span>}
              {warningHigh != null && <span>High: {warningHigh}%</span>}
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
