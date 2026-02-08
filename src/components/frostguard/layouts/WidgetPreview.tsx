import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, surface, border, spacing } from '@/lib/design-system/tokens';
import { Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/lib/components/elements/Button';
import { SelectMenu } from '@/lib/components/forms/SelectMenu';
import { Card } from '@/lib/components/layout/Card';
import { PageHeading } from '@/lib/components/headings/PageHeading';
import { SectionHeading } from '@/lib/components/headings/SectionHeading';
import { widgetRegistry, type WidgetRegistryEntry } from '../registry/widgetRegistry';
import { renderWidget, type WidgetPlacement } from '../registry/widgetFactory';

/** Mock data generators per widget type for preview purposes */
const MOCK_PROPS: Record<string, Record<string, unknown>> = {
  temperature: {
    sensorId: 'preview-sensor',
    unitId: 'preview-unit',
    currentTemp: 36.5,
    previousTemp: 37.1,
    unit: '\u00B0F',
    lastReadingAt: new Date(Date.now() - 120000).toISOString(),
    warningHigh: 40,
    warningLow: 28,
    criticalHigh: 41,
    criticalLow: 25,
  },
  humidity: {
    sensorId: 'preview-sensor',
    unitId: 'preview-unit',
    currentHumidity: 45.2,
    previousHumidity: 46.8,
    lastReadingAt: new Date(Date.now() - 120000).toISOString(),
    warningHigh: 70,
    warningLow: 20,
  },
  door: {
    sensorId: 'preview-sensor',
    unitId: 'preview-unit',
    currentState: 'closed',
    stateChangedAt: new Date(Date.now() - 3600000).toISOString(),
    openCountToday: 12,
    events: [
      { id: '1', state: 'closed', timestamp: new Date(Date.now() - 3600000).toISOString(), durationSeconds: 45 },
      { id: '2', state: 'open', timestamp: new Date(Date.now() - 3645000).toISOString() },
      { id: '3', state: 'closed', timestamp: new Date(Date.now() - 7200000).toISOString(), durationSeconds: 120 },
    ],
  },
  battery: {
    sensorId: 'preview-sensor',
    voltage: 3.45,
    chemistry: 'ER14505',
  },
  'signal-strength': {
    sensorId: 'preview-sensor',
    rssi: -95,
    snr: 7.5,
  },
  alerts: {
    alerts: [
      { id: '1', severity: 'critical', message: 'Temperature above critical threshold (41\u00B0F)', timestamp: new Date(Date.now() - 300000).toISOString() },
      { id: '2', severity: 'warning', message: 'High humidity detected (72%)', timestamp: new Date(Date.now() - 600000).toISOString() },
    ],
  },
  'device-readiness': {
    sensorId: 'preview-sensor',
    batteryScore: 85,
    signalScore: 72,
    uplinkScore: 95,
  },
  'uplink-history': {
    sensorId: 'preview-sensor',
    hours: 24,
    data: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      actual: Math.floor(Math.random() * 6 + (i > 2 && i < 22 ? 4 : 0)),
      expected: 6,
    })),
  },
  'compliance-score': {
    score: 94.5,
    period: '24h',
    breakdown: [
      { label: 'In range', percentage: 94.5, color: '#10b981' },
      { label: 'Warning', percentage: 4.2, color: '#f59e0b' },
      { label: 'Critical', percentage: 1.3, color: '#ef4444' },
    ],
  },
  'sensor-settings': {
    sensorId: 'preview-sensor',
    settings: {
      name: 'Walk-in Cooler #1',
      deviceEui: '0018B200000ABCDE',
      uplinkIntervalMinutes: 10,
      warningHigh: 40,
      criticalHigh: 41,
      warningLow: 28,
      criticalLow: 25,
      unit: '\u00B0F',
    },
  },
  'battery-detail': {
    sensorId: 'preview-sensor',
    voltage: 3.45,
    chemistry: 'ER14505',
    dailyUplinkCount: 144,
    voltageHistory: Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(Date.now() - (30 - i) * 86400000).toISOString(),
      voltage: 3.65 - i * 0.007 + Math.random() * 0.01,
    })),
  },
};

export interface WidgetPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Initial widget to preview */
  initialWidgetId?: string;
}

/**
 * Admin-only widget preview tool.
 * Select any widget and see it rendered with mock data.
 */
export function WidgetPreview({
  className,
  initialWidgetId,
  ...props
}: WidgetPreviewProps) {
  const [selectedId, setSelectedId] = React.useState(initialWidgetId || widgetRegistry[0]?.id || '');

  const selectedWidget = widgetRegistry.find((w) => w.id === selectedId);
  const mockProps = MOCK_PROPS[selectedId] || {};

  const placement: WidgetPlacement = {
    widgetId: selectedId,
    instanceId: `preview-${selectedId}`,
    props: mockProps,
  };

  const widgetOptions = widgetRegistry.map((w) => ({
    value: w.id,
    label: `${w.name} (${w.appTarget.join(', ')})`,
  }));

  return (
    <div className={cn(spacing.page, className)} {...props}>
      <PageHeading
        title="Widget Preview"
        description="Test any widget with mock data"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => setSelectedId(selectedId)}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* Widget selector */}
        <div className="col-span-1 space-y-4">
          <SectionHeading title="Select Widget" />
          <SelectMenu
            label="Widget"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            options={widgetOptions}
          />

          {selectedWidget && (
            <Card variant="outlined" padding="compact">
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className={textTokens.tertiary}>Category</dt>
                  <dd className={textTokens.secondary}>{selectedWidget.category}</dd>
                </div>
                <div>
                  <dt className={textTokens.tertiary}>Default Size</dt>
                  <dd className={textTokens.secondary}>{selectedWidget.defaultSize.cols}x{selectedWidget.defaultSize.rows}</dd>
                </div>
                <div>
                  <dt className={textTokens.tertiary}>App Target</dt>
                  <dd className={textTokens.secondary}>{selectedWidget.appTarget.join(', ')}</dd>
                </div>
                <div>
                  <dt className={textTokens.tertiary}>Sensor Kinds</dt>
                  <dd className={textTokens.secondary}>{selectedWidget.applicableSensorKinds.join(', ')}</dd>
                </div>
                <div>
                  <dt className={textTokens.tertiary}>Required Props</dt>
                  <dd className={textTokens.secondary}>{selectedWidget.requiresProps.join(', ') || 'None'}</dd>
                </div>
              </dl>
            </Card>
          )}
        </div>

        {/* Preview area */}
        <div className="col-span-2">
          <SectionHeading title="Preview" />
          <div className={cn('mt-4 p-6 rounded-xl border min-h-[300px]', surface.sunken, border.subtle)}>
            <div className="max-w-md mx-auto">
              {renderWidget(placement)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
