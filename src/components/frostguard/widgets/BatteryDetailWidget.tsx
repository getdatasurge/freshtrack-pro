import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning, Clock } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { ProgressBar } from '@/lib/components/feedback/ProgressBar';
import { DescriptionList } from '@/lib/components/data-display/DescriptionList';
import { EmptyState } from '@/lib/components/feedback/EmptyState';
import { voltageToPercent, batteryVariant, resolveChemistry, estimateBatteryLife, BATTERY_CURVES } from '../tokens/batteryChemistry';

function BatteryIcon({ percentage }: { percentage: number }) {
  if (percentage > 75) return <BatteryFull className="h-5 w-5" />;
  if (percentage > 50) return <BatteryMedium className="h-5 w-5" />;
  if (percentage > 20) return <BatteryLow className="h-5 w-5" />;
  return <BatteryWarning className="h-5 w-5" />;
}

export interface BatteryDetailWidgetProps {
  sensorId: string;
  voltage?: number | null;
  chemistry?: string;
  dailyUplinkCount?: number;
  voltageHistory?: { timestamp: string; voltage: number }[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

/**
 * Admin-only extended battery widget.
 * Shows chemistry details, voltage trend, estimated remaining life.
 */
export function BatteryDetailWidget({
  sensorId,
  voltage,
  chemistry = 'ER14505',
  dailyUplinkCount,
  voltageHistory = [],
  loading,
  error,
  onRetry,
}: BatteryDetailWidgetProps) {
  const percentage = voltage != null ? voltageToPercent(voltage, chemistry) : null;
  const variant = percentage != null ? batteryVariant(percentage) : 'success';
  const resolvedChemistry = resolveChemistry(chemistry);
  const curve = BATTERY_CURVES[resolvedChemistry] || BATTERY_CURVES.ER14505;
  const estimatedDays = percentage != null && dailyUplinkCount
    ? estimateBatteryLife(percentage, dailyUplinkCount)
    : null;

  // Compute voltage trend from history
  const voltageTrend = React.useMemo(() => {
    if (voltageHistory.length < 2) return null;
    const sorted = [...voltageHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const first = sorted[0].voltage;
    const last = sorted[sorted.length - 1].voltage;
    return parseFloat((last - first).toFixed(3));
  }, [voltageHistory]);

  return (
    <WidgetContainer
      title="Battery Detail"
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
        <div className="space-y-4">
          {/* Main metric */}
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
            <span className={cn('text-sm tabular-nums', textTokens.tertiary)}>{voltage.toFixed(3)}V</span>
          </div>

          <ProgressBar value={percentage} variant={variant} size="md" />

          {/* Voltage history chart area */}
          {voltageHistory.length > 0 && (
            <div className="h-20 bg-zinc-800/30 rounded-lg flex items-center justify-center relative">
              <span className={cn('text-xs', textTokens.disabled)}>Voltage trend chart</span>
              {voltageTrend != null && (
                <span className={cn(
                  'absolute top-1.5 right-2 text-xs font-medium tabular-nums',
                  voltageTrend < 0 ? 'text-amber-400' : 'text-emerald-400',
                )}>
                  {voltageTrend > 0 ? '+' : ''}{voltageTrend}V
                </span>
              )}
            </div>
          )}

          {/* Detail info */}
          <DescriptionList
            items={[
              { label: 'Chemistry', value: resolvedChemistry },
              { label: 'Voltage Range', value: `${curve[curve.length - 1][0]}V - ${curve[0][0]}V` },
              ...(dailyUplinkCount ? [{ label: 'Daily Uplinks', value: String(dailyUplinkCount) }] : []),
              ...(estimatedDays != null ? [{
                label: 'Est. Remaining',
                value: estimatedDays > 365
                  ? `~${(estimatedDays / 365).toFixed(1)} years`
                  : estimatedDays > 30
                    ? `~${Math.round(estimatedDays / 30)} months`
                    : `~${estimatedDays} days`,
              }] : []),
            ]}
          />
        </div>
      )}
    </WidgetContainer>
  );
}
