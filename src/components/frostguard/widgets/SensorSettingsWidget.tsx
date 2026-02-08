import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { Settings } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { DescriptionList } from '@/lib/components/data-display/DescriptionList';
import { Button } from '@/lib/components/elements/Button';
import { EmptyState } from '@/lib/components/feedback/EmptyState';

export interface SensorSettings {
  uplinkIntervalMinutes?: number;
  warningHigh?: number | null;
  criticalHigh?: number | null;
  warningLow?: number | null;
  criticalLow?: number | null;
  unit?: string;
  name?: string;
  deviceEui?: string;
}

export interface SensorSettingsWidgetProps {
  sensorId: string;
  settings?: SensorSettings | null;
  compactMode?: boolean;
  onEdit?: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function SensorSettingsWidget({
  sensorId,
  settings,
  compactMode = false,
  onEdit,
  loading,
  error,
  onRetry,
}: SensorSettingsWidgetProps) {
  if (compactMode && settings) {
    const parts: string[] = [];
    if (settings.uplinkIntervalMinutes) parts.push(`${settings.uplinkIntervalMinutes} min`);
    if (settings.warningHigh != null || settings.warningLow != null) {
      const bounds = [settings.warningLow, settings.warningHigh]
        .filter((v) => v != null)
        .join('/');
      parts.push(`alerts ${bounds}${settings.unit || ''}`);
    }
    return (
      <span className={cn('text-sm', textTokens.tertiary)}>
        {parts.join(', ') || 'Default settings'}
      </span>
    );
  }

  return (
    <WidgetContainer
      title="Sensor Settings"
      icon={<Settings />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      actions={onEdit && <Button variant="ghost" size="xs" onClick={onEdit}>Edit</Button>}
    >
      {!settings ? (
        <EmptyState
          icon={<Settings />}
          title="No settings"
          description="Sensor configuration not available"
        />
      ) : (
        <DescriptionList
          items={[
            ...(settings.name ? [{ label: 'Name', value: settings.name }] : []),
            ...(settings.deviceEui ? [{ label: 'Device EUI', value: settings.deviceEui }] : []),
            ...(settings.uplinkIntervalMinutes ? [{ label: 'Uplink Interval', value: `${settings.uplinkIntervalMinutes} min` }] : []),
            ...(settings.warningHigh != null ? [{ label: 'Warning High', value: `${settings.warningHigh}${settings.unit || ''}` }] : []),
            ...(settings.criticalHigh != null ? [{ label: 'Critical High', value: `${settings.criticalHigh}${settings.unit || ''}` }] : []),
            ...(settings.warningLow != null ? [{ label: 'Warning Low', value: `${settings.warningLow}${settings.unit || ''}` }] : []),
            ...(settings.criticalLow != null ? [{ label: 'Critical Low', value: `${settings.criticalLow}${settings.unit || ''}` }] : []),
          ]}
        />
      )}
    </WidgetContainer>
  );
}
