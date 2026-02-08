import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Signal } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { EmptyState } from '@/lib/components/feedback/EmptyState';

function rssiToQuality(rssi: number): { label: string; bars: number; color: string } {
  if (rssi > -80) return { label: 'Excellent', bars: 4, color: 'text-emerald-400' };
  if (rssi > -100) return { label: 'Good', bars: 3, color: 'text-emerald-400' };
  if (rssi > -115) return { label: 'Fair', bars: 2, color: 'text-amber-400' };
  return { label: 'Poor', bars: 1, color: 'text-red-400' };
}

function SignalBars({ bars, className }: { bars: number; className?: string }) {
  return (
    <div className={cn('flex items-end gap-0.5 h-6', className)}>
      {[1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className={cn(
            'w-1.5 rounded-sm transition-colors',
            level <= bars ? 'bg-current' : 'bg-zinc-700',
          )}
          style={{ height: `${level * 25}%` }}
        />
      ))}
    </div>
  );
}

export interface SignalStrengthWidgetProps {
  sensorId: string;
  rssi?: number | null;
  snr?: number | null;
  showHistory?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function SignalStrengthWidget({
  sensorId,
  rssi,
  snr,
  showHistory = false,
  loading,
  error,
  onRetry,
}: SignalStrengthWidgetProps) {
  const quality = rssi != null ? rssiToQuality(rssi) : null;

  return (
    <WidgetContainer
      title="Signal Strength"
      icon={<Signal />}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {rssi == null ? (
        <EmptyState
          icon={<Signal />}
          title="No signal data"
          description="Signal information not available"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={quality!.color}>
                <SignalBars bars={quality!.bars} />
              </div>
              <div>
                <p className={cn('text-lg font-semibold', quality!.color)}>{quality!.label}</p>
                <p className={cn('text-xs tabular-nums', textTokens.tertiary)}>{rssi} dBm</p>
              </div>
            </div>
            {snr != null && (
              <div className="text-right">
                <p className={cn('text-sm font-medium tabular-nums', textTokens.secondary)}>{snr.toFixed(1)}</p>
                <p className={cn('text-xs', textTokens.tertiary)}>SNR dB</p>
              </div>
            )}
          </div>

          {showHistory && (
            <div className="h-16 bg-zinc-800/30 rounded-lg flex items-center justify-center">
              <span className={cn('text-xs', textTokens.disabled)}>Signal history chart</span>
            </div>
          )}
        </div>
      )}
    </WidgetContainer>
  );
}
