import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, status } from '@/lib/design-system/tokens';
import { DoorOpen } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { Dot } from '@/lib/components/elements/Dot';
import { TimeAgo } from '../primitives/TimeAgo';
import { EmptyState } from '@/lib/components/feedback/EmptyState';
import { Timeline } from '@/lib/components/data-display/Timeline';
import { TimelineItem } from '@/lib/components/data-display/TimelineItem';

export interface DoorEvent {
  id: string;
  state: 'open' | 'closed';
  timestamp: string;
  durationSeconds?: number;
}

export interface DoorSensorWidgetProps {
  sensorId: string;
  unitId: string;
  currentState?: 'open' | 'closed' | null;
  stateChangedAt?: string | null;
  openCountToday?: number;
  events?: DoorEvent[];
  showHistory?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function DoorSensorWidget({
  sensorId,
  unitId,
  currentState,
  stateChangedAt,
  openCountToday = 0,
  events = [],
  showHistory = true,
  loading,
  error,
  onRetry,
}: DoorSensorWidgetProps) {
  const isOpen = currentState === 'open';

  // Filter chatter < 3 seconds
  const filteredEvents = events.filter((e) => !e.durationSeconds || e.durationSeconds >= 3);

  return (
    <WidgetContainer
      title="Door Sensor"
      icon={<DoorOpen />}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {currentState == null ? (
        <EmptyState
          icon={<DoorOpen />}
          title="No door events recorded"
          description="Waiting for the first door event"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dot variant={isOpen ? 'danger' : 'success'} pulsing={isOpen} size="lg" />
              <div>
                <p className={cn('text-lg font-semibold', isOpen ? status.danger.text : status.success.text)}>
                  {isOpen ? 'OPEN' : 'CLOSED'}
                </p>
                {stateChangedAt && (
                  <p className={cn('text-xs', textTokens.tertiary)}>
                    Since <TimeAgo date={stateChangedAt} />
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={cn('text-2xl font-semibold tabular-nums', textTokens.primary)}>{openCountToday}</p>
              <p className={cn('text-xs', textTokens.tertiary)}>opens today</p>
            </div>
          </div>

          {showHistory && filteredEvents.length > 0 && (
            <Timeline>
              {filteredEvents.slice(0, 5).map((event, i) => (
                <TimelineItem
                  key={event.id}
                  title={event.state === 'open' ? 'Door opened' : 'Door closed'}
                  timestamp={new Date(event.timestamp).toLocaleTimeString()}
                  variant={event.state === 'open' ? 'warning' : 'success'}
                  description={
                    event.durationSeconds
                      ? `Duration: ${Math.round(event.durationSeconds / 60)}m ${event.durationSeconds % 60}s`
                      : undefined
                  }
                  isLast={i === Math.min(filteredEvents.length, 5) - 1}
                />
              ))}
            </Timeline>
          )}
        </div>
      )}
    </WidgetContainer>
  );
}
