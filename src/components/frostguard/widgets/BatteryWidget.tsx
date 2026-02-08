import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, status } from '@/lib/design-system/tokens';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { ProgressBar } from '@/lib/components/feedback/ProgressBar';
import { EmptyState } from '@/lib/components/feedback/EmptyState';
import { voltageToPercent, batteryVariant } from '../tokens/batteryChemistry';

function BatteryIcon({ percentage }: { percentage: number }) {
  if (percentage > 75) return <BatteryFull className="h-5 w-5" />;
  if (percentage > 50) return <BatteryMedium className="h-5 w-5" />;
  if (percentage > 20) return <BatteryLow className="h-5 w-5" />;
  return <BatteryWarning className="h-5 w-5" />;
}

export interface BatteryWidgetProps {
  sensorId: string;
  voltage?: number | null;
  chemistry?: string;
  showVoltage?: boolean;
  showChemistry?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

/**
 * Customer-facing battery widget.
 * Shows percentage from voltage + chemistry curves, simple progress bar.
 */
export function BatteryWidget({
  sensorId,
  voltage,
  chemistry = 'ER14505',
  showVoltage = true,
  showChemistry = false,
  loading,
  error,
  onRetry,
}: BatteryWidgetProps) {
  const percentage = voltage != null ? voltageToPercent(voltage, chemistry) : null;
  const variant = percentage != null ? batteryVariant(percentage) : 'success';

  return (
    <WidgetContainer
      title="Battery"
      icon={<Battery />}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {voltage == null || percentage == null ? (
        <EmptyState
          icon={<Battery />}
          title="No battery data"
          description="Battery voltage not available"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                variant === 'success' ? status.success.text :
                variant === 'warning' ? status.warning.text : status.danger.text,
              )}>
                <BatteryIcon percentage={percentage} />
              </div>
              <span className={cn('text-2xl font-semibold tabular-nums', textTokens.primary)}>{percentage}%</span>
            </div>
            {showVoltage && (
              <span className={cn('text-sm tabular-nums', textTokens.tertiary)}>{voltage.toFixed(2)}V</span>
            )}
          </div>
          <ProgressBar value={percentage} variant={variant} size="md" />
          {showChemistry && (
            <p className={cn('text-xs', textTokens.tertiary)}>
              Chemistry: {chemistry === 'lithium' ? 'LiFeS2 AA' : chemistry}
            </p>
          )}
        </div>
      )}
    </WidgetContainer>
  );
}
