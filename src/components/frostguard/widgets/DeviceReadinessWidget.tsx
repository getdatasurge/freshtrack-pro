import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Activity } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { ProgressRing } from '@/lib/components/feedback/ProgressRing';
import { ProgressBar } from '@/lib/components/feedback/ProgressBar';
import { EmptyState } from '@/lib/components/feedback/EmptyState';

export interface DeviceReadinessWidgetProps {
  sensorId: string;
  batteryScore?: number;
  signalScore?: number;
  uplinkScore?: number;
  showDetails?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

function scoreToVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'danger';
}

export function DeviceReadinessWidget({
  sensorId,
  batteryScore,
  signalScore,
  uplinkScore,
  showDetails = true,
  loading,
  error,
  onRetry,
}: DeviceReadinessWidgetProps) {
  const hasData = batteryScore != null || signalScore != null || uplinkScore != null;

  // Weighted: battery 30% + signal 30% + uplink consistency 40%
  const overallScore = hasData
    ? Math.round(
        (batteryScore || 0) * 0.3 +
        (signalScore || 0) * 0.3 +
        (uplinkScore || 0) * 0.4,
      )
    : null;

  return (
    <WidgetContainer
      title="Device Readiness"
      icon={<Activity />}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {overallScore == null ? (
        <EmptyState
          icon={<Activity />}
          title="No readiness data"
          description="Device health metrics not available"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <ProgressRing
              value={overallScore}
              variant={scoreToVariant(overallScore)}
              size={72}
              strokeWidth={5}
            />
          </div>

          {showDetails && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className={cn('text-xs', textTokens.tertiary)}>Battery (30%)</span>
                  <span className={cn('text-xs font-medium', textTokens.secondary)}>{batteryScore ?? 0}%</span>
                </div>
                <ProgressBar value={batteryScore || 0} variant={scoreToVariant(batteryScore || 0)} size="sm" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className={cn('text-xs', textTokens.tertiary)}>Signal (30%)</span>
                  <span className={cn('text-xs font-medium', textTokens.secondary)}>{signalScore ?? 0}%</span>
                </div>
                <ProgressBar value={signalScore || 0} variant={scoreToVariant(signalScore || 0)} size="sm" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className={cn('text-xs', textTokens.tertiary)}>Uplink Consistency (40%)</span>
                  <span className={cn('text-xs font-medium', textTokens.secondary)}>{uplinkScore ?? 0}%</span>
                </div>
                <ProgressBar value={uplinkScore || 0} variant={scoreToVariant(uplinkScore || 0)} size="sm" />
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetContainer>
  );
}
