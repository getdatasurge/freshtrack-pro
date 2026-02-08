import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Radio } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { EmptyState } from '@/lib/components/feedback/EmptyState';

export interface UplinkHourData {
  hour: string;
  actual: number;
  expected: number;
}

export interface UplinkHistoryWidgetProps {
  sensorId: string;
  hours?: number;
  data?: UplinkHourData[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function UplinkHistoryWidget({
  sensorId,
  hours = 24,
  data = [],
  loading,
  error,
  onRetry,
}: UplinkHistoryWidgetProps) {
  const maxExpected = Math.max(...data.map((d) => d.expected), 1);

  return (
    <WidgetContainer
      title="Uplink History"
      icon={<Radio />}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {data.length === 0 ? (
        <EmptyState
          icon={<Radio />}
          title="No uplink data"
          description="Uplink history not available"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-end gap-px h-20">
            {data.map((d, i) => {
              const heightPct = (d.actual / maxExpected) * 100;
              const isMissing = d.actual === 0;
              const isLow = d.actual > 0 && d.actual < d.expected * 0.5;

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col justify-end"
                  title={`${d.hour}: ${d.actual}/${d.expected} uplinks`}
                >
                  <div
                    className={cn(
                      'w-full rounded-t-sm min-h-[2px]',
                      isMissing
                        ? 'bg-red-500/60'
                        : isLow
                          ? 'bg-amber-500/60'
                          : 'bg-blue-500/60',
                    )}
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className={cn('text-xs', textTokens.tertiary)}>
              Last {hours}h
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm bg-blue-500/60" />
                <span className={cn('text-xs', textTokens.tertiary)}>Normal</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm bg-red-500/60" />
                <span className={cn('text-xs', textTokens.tertiary)}>Missing</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
}
