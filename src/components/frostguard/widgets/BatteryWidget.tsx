import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { ProgressBar } from '@/lib/components/feedback/ProgressBar';
import { EmptyState } from '@/lib/components/feedback/EmptyState';

/**
 * Battery chemistry voltage-to-percentage curves.
 * NEVER use Bat_status (0-3 enum) as battery percentage.
 * "lithium" in catalog = "LiFeS2_AA" curve.
 */
const BATTERY_CURVES: Record<string, [number, number][]> = {
  LiFeS2_AA: [
    [1.8, 100], [1.7, 90], [1.6, 70], [1.5, 50], [1.4, 30], [1.3, 15], [1.2, 5], [1.0, 0],
  ],
  ER14505: [
    [3.65, 100], [3.6, 90], [3.5, 70], [3.4, 50], [3.3, 30], [3.2, 15], [3.0, 5], [2.5, 0],
  ],
  CR123A: [
    [3.3, 100], [3.2, 90], [3.0, 70], [2.9, 50], [2.8, 30], [2.7, 15], [2.5, 5], [2.0, 0],
  ],
};

function voltageToPercentage(voltage: number, chemistry: string): number {
  // Handle alias: "lithium" in catalog = "LiFeS2_AA"
  const key = chemistry === 'lithium' ? 'LiFeS2_AA' : chemistry;
  const curve = BATTERY_CURVES[key] || BATTERY_CURVES.ER14505;

  for (let i = 0; i < curve.length; i++) {
    if (voltage >= curve[i][0]) return curve[i][1];
  }
  return 0;
}

function getBatteryVariant(pct: number): 'success' | 'warning' | 'danger' {
  if (pct > 50) return 'success';
  if (pct >= 20) return 'warning';
  return 'danger';
}

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
  const percentage = voltage != null ? voltageToPercentage(voltage, chemistry) : null;
  const variant = percentage != null ? getBatteryVariant(percentage) : 'neutral';

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
                variant === 'success' ? 'text-emerald-400' :
                variant === 'warning' ? 'text-amber-400' : 'text-red-400',
              )}>
                <BatteryIcon percentage={percentage} />
              </div>
              <span className="text-2xl font-semibold tabular-nums text-zinc-50">{percentage}%</span>
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
