import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, status } from '@/lib/design-system/tokens';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { StackedList } from '@/lib/components/data-display/StackedList';
import { StackedListItem } from '@/lib/components/data-display/StackedListItem';
import { Badge } from '@/lib/components/elements/Badge';
import { Button } from '@/lib/components/elements/Button';
import { TimeAgo } from '../primitives/TimeAgo';

export interface AlertItem {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged?: boolean;
}

export interface AlertsWidgetProps {
  unitId?: string;
  siteId?: string;
  alerts?: AlertItem[];
  maxVisible?: number;
  showAcknowledge?: boolean;
  onAcknowledge?: (alertId: string) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function AlertsWidget({
  unitId,
  siteId,
  alerts = [],
  maxVisible = 5,
  showAcknowledge = true,
  onAcknowledge,
  loading,
  error,
  onRetry,
}: AlertsWidgetProps) {
  // Sort by severity (critical first) then by time (newest first)
  const sorted = [...alerts].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const visible = sorted.slice(0, maxVisible);

  return (
    <WidgetContainer
      title="Active Alerts"
      icon={<Bell />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      actions={
        alerts.length > 0 ? (
          <Badge variant="danger" size="sm">{alerts.length}</Badge>
        ) : undefined
      }
    >
      {alerts.length === 0 ? (
        // Empty state: green CheckCircle2, "No active alerts", "All sensors reporting normally"
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-emerald-500/5 rounded-lg">
          <div className={cn('mb-3', status.success.icon)}>
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h3 className={cn('text-base font-medium', textTokens.secondary)}>No active alerts</h3>
          <p className={cn('mt-1 text-sm', textTokens.tertiary)}>All sensors reporting normally</p>
        </div>
      ) : (
        <StackedList bordered={false}>
          {visible.map((alert) => (
            <StackedListItem
              key={alert.id}
              title={alert.message}
              leading={
                <div className={alert.severity === 'critical' ? status.danger.icon : status.warning.icon}>
                  {alert.severity === 'critical' ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
              }
              meta={
                <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'} size="sm">
                  {alert.severity}
                </Badge>
              }
              description={alert.timestamp ? undefined : undefined}
              trailing={
                <div className="flex items-center gap-2">
                  <TimeAgo date={alert.timestamp} />
                  {showAcknowledge && !alert.acknowledged && onAcknowledge && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcknowledge(alert.id);
                      }}
                    >
                      Ack
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </StackedList>
      )}
    </WidgetContainer>
  );
}
