import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, status, border, radius, transition } from '@/lib/design-system/tokens';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { Badge } from '@/lib/components/elements/Badge';
import { TimeAgo } from '../primitives/TimeAgo';
import { Button } from '@/lib/components/elements/Button';

export interface AlertCardProps {
  alert: {
    id: string;
    severity: 'warning' | 'critical';
    message: string;
    sensorName?: string;
    unitName?: string;
    timestamp: string;
    acknowledged?: boolean;
  };
  onAcknowledge?: (id: string) => void;
  onClick?: () => void;
  className?: string;
}

export function AlertCard({ alert, onAcknowledge, onClick, className }: AlertCardProps) {
  const isCritical = alert.severity === 'critical';
  const colors = isCritical ? status.danger : status.warning;

  return (
    <div
      className={cn(
        'border border-l-4 p-4',
        colors.border,
        'bg-zinc-900',
        radius.md,
        onClick && `cursor-pointer hover:bg-zinc-800/50 ${transition.fast}`,
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', colors.icon)}>
          {isCritical ? <AlertCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={isCritical ? 'danger' : 'warning'} size="sm">
              {alert.severity}
            </Badge>
            <TimeAgo date={alert.timestamp} />
          </div>
          <p className={cn('text-sm font-medium mt-1.5', textTokens.primary)}>{alert.message}</p>
          {(alert.sensorName || alert.unitName) && (
            <p className={cn('text-xs mt-1', textTokens.tertiary)}>
              {[alert.unitName, alert.sensorName].filter(Boolean).join(' \u2022 ')}
            </p>
          )}
          {onAcknowledge && !alert.acknowledged && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge(alert.id);
                }}
              >
                Acknowledge
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
