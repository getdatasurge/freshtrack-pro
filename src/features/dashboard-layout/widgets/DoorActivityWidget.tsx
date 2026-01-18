/**
 * Door Activity Widget
 * 
 * Shows door open/close events with duration statistics.
 * Uses WidgetEmptyState for all non-healthy states.
 */

import { useEffect, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DoorOpen, DoorClosed, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format, formatDistanceToNow } from "date-fns";
import { createLoadingState, createNotConfiguredState, createEmptyState, createHealthyState, createMismatchState } from "../hooks/useWidgetState";
import { WidgetEmptyState } from "../components/WidgetEmptyState";
import type { WidgetStateInfo } from "../types/widgetState";

const DEBUG_DOOR_WIDGET = import.meta.env.DEV;

interface DoorEvent {
  id: string;
  state: string;
  occurred_at: string;
}

export function DoorActivityWidget({ entityId, sensor, loraSensors, refreshTick }: WidgetProps) {
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find the door sensor specifically - don't just use primary sensor
  const doorSensor = sensor?.sensor_type === 'door' 
    ? sensor 
    : loraSensors?.find(s => s.sensor_type === 'door');
  const primarySensor = doorSensor || sensor || loraSensors?.[0];
  const isDoorSensor = !!doorSensor;

  useEffect(() => {
    async function fetchDoorEvents() {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      if (DEBUG_DOOR_WIDGET) {
        console.log('[DoorWidget] fetching', { 
          entityId, 
          doorSensor: doorSensor?.name,
          sensorType: doorSensor?.sensor_type,
          refreshTick 
        });
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("door_events")
          .select("id, state, occurred_at")
          .eq("unit_id", entityId)
          .order("occurred_at", { ascending: false })
          .limit(20);

        if (fetchError) throw fetchError;
        
        if (DEBUG_DOOR_WIDGET) {
          console.log('[DoorWidget] success', { 
            eventsCount: data?.length ?? 0,
            first3: data?.slice(0, 3).map(e => ({ id: e.id, state: e.state }))
          });
        }
        
        setEvents(data || []);
      } catch (err) {
        if (DEBUG_DOOR_WIDGET) {
          console.error('[DoorWidget] error', { 
            message: err instanceof Error ? err.message : 'Unknown error'
          });
        }
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDoorEvents();
  }, [entityId, doorSensor?.name, doorSensor?.sensor_type, refreshTick]);

  // Determine widget state
  const widgetState = useMemo((): WidgetStateInfo => {
    if (isLoading) {
      return createLoadingState();
    }
    
    if (!entityId) {
      return createNotConfiguredState(
        "No unit selected.",
        "Select a unit to view door activity.",
        "Select Unit",
        "/units"
      );
    }
    
    if (!primarySensor) {
      return createNotConfiguredState(
        "No sensor assigned to this unit.",
        "Assign a door sensor to track open/close events.",
        "Assign Sensor",
        "/settings/devices"
      );
    }
    
    // Check for sensor type mismatch
    if (!isDoorSensor) {
      return createMismatchState(
        "door",
        primarySensor.sensor_type || "unknown"
      );
    }
    
    if (error) {
      return {
        status: "error" as const,
        message: "Failed to load door events",
        rootCause: error,
        action: { label: "Retry", onClick: () => window.location.reload() },
      };
    }
    
    if (events.length === 0) {
      return createEmptyState(
        "No door events recorded yet.",
        "Door activity will appear here once the sensor reports open/close events."
      );
    }
    
    const lastDate = events[0]?.occurred_at ? new Date(events[0].occurred_at) : undefined;
    return createHealthyState(lastDate);
  }, [isLoading, entityId, primarySensor, isDoorSensor, error, events]);

  // Show empty state for non-healthy conditions
  if (widgetState.status !== "healthy") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 p-4 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <DoorOpen className="w-4 h-4" />
            Door Activity
          </h3>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <WidgetEmptyState state={widgetState} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-4 pb-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <DoorOpen className="w-4 h-4" />
          Door Activity
        </h3>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
        <ScrollArea className="h-full">
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-border"
              >
                {event.state === "open" ? (
                  <DoorOpen className="h-5 w-5 text-warning" />
                ) : (
                  <DoorClosed className="h-5 w-5 text-safe" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">{event.state}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.occurred_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
