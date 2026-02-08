import * as React from 'react';
import { Badge } from '@/lib/components';
import { statusToVariant, statusLabel, type UnitStatusResult } from '../tokens/statusLogic';

export interface StatusBadgeProps {
  sensorStatus: UnitStatusResult['status'];
  showLabel?: boolean;
  className?: string;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ sensorStatus, showLabel = true, className }, ref) => {
    return (
      <Badge
        ref={ref}
        variant={statusToVariant(sensorStatus)}
        dot
        pulsing={sensorStatus === 'online'}
        className={className}
      >
        {showLabel && statusLabel(sensorStatus)}
      </Badge>
    );
  },
);
StatusBadge.displayName = 'StatusBadge';
