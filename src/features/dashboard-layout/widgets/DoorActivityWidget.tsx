/**
 * Door Activity Widget
 *
 * Rich timeline of door open/close events with:
 * - Current state badge (top-right)
 * - Summary: opens today + longest open duration
 * - Timeline with per-event duration badges
 * - EXTENDED warning for opens exceeding the warning threshold
 * - "Show X more events" pagination
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DoorOpen, DoorClosed, Clock, AlertTriangle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format, startOfDay, differenceInSeconds } from "date-fns";
import { createLoadingState, createNotConfiguredState, createEmptyState, createHealthyState } from "../hooks/useWidgetState";
import { WidgetEmptyState } from "../components/WidgetEmptyState";
import type { WidgetStateInfo } from "../types/widgetState";
import { DEFAULT_ALERT_RULES } from "@/hooks/useAlertRules";

const DEBUG_DOOR_WIDGET = import.meta.env.DEV;
const INITIAL_VISIBLE = 8;
const PAGE_SIZE = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DoorEvent {
  id: string;
  state: "open" | "closed";
  occurred_at: string;
  /** Duration in seconds this state lasted (computed from next event) */
  durationSeconds: number | null;
  /** Whether the open duration exceeded the warning threshold */
  isExtended: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDurationHMS(seconds: number): string {
  if (seconds < 0) return "\u2014";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function computeEventsWithDuration(
  raw: Array<{ id: string; state: "open" | "closed"; occurred_at: string }>,
  warningMinutes: number,
): DoorEvent[] {
  return raw.map((event, i) => {
    // Duration = time until the NEXT event (which is earlier, since sorted DESC)
    const nextEvent = raw[i + 1];
    let durationSeconds: number | null = null;
    if (nextEvent) {
      durationSeconds = differenceInSeconds(
        new Date(event.occurred_at),
        new Date(nextEvent.occurred_at),
      );
    }

    const isExtended =
      event.state === "open" &&
      durationSeconds !== null &&
      durationSeconds >= warningMinutes * 60;

    return { ...event, durationSeconds, isExtended };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DoorActivityWidget({ entityId, unit, sensor, loraSensors, refreshTick }: WidgetProps) {
  const [rawEvents, setRawEvents] = useState<Array<{ id: string; state: "open" | "closed"; occurred_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Find the door sensor — accept "door", "contact", or "combo" sensor types.
  // Also fall back to the first available sensor: if this widget is on the
  // dashboard, the user expects door data from whatever sensor is assigned.
  // The backend self-healing will eventually correct sensor_type, but we
  // shouldn't block the UI while it catches up.
  const isDoorType = (t?: string | null) =>
    t === "door" || t === "contact" || t === "combo";
  const doorSensor =
    isDoorType(sensor?.sensor_type)
      ? sensor
      : loraSensors?.find((s) => isDoorType(s.sensor_type))
        ?? sensor
        ?? loraSensors?.[0];
  const primarySensor = doorSensor || sensor || loraSensors?.[0];

  // Current door state from the units table (updated by webhook)
  const currentState = unit?.door_state ?? null;
  const stateChangedAt = unit?.door_last_changed_at ?? null;

  // Warning threshold for EXTENDED badge
  const warningMinutes = DEFAULT_ALERT_RULES.door_open_warning_minutes;

  // Fetch events
  useEffect(() => {
    async function fetchDoorEvents() {
      if (!entityId || !doorSensor?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("sensor_readings")
          .select("id, door_open, recorded_at")
          .eq("lora_sensor_id", doorSensor.id)
          .not("door_open", "is", null)
          .order("recorded_at", { ascending: false })
          .limit(50);

        if (fetchError) throw fetchError;

        const mapped = (data || []).map(
          (r: { id: string; door_open: boolean; recorded_at: string }) => ({
            id: r.id,
            state: r.door_open ? ("open" as const) : ("closed" as const),
            occurred_at: r.recorded_at,
          }),
        );

        setRawEvents(mapped);
      } catch (err) {
        if (DEBUG_DOOR_WIDGET) {
          console.error("[DoorWidget] error", {
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDoorEvents();
  }, [entityId, doorSensor?.id, refreshTick]);

  // Compute events with durations
  const events = useMemo(
    () => computeEventsWithDuration(rawEvents, warningMinutes),
    [rawEvents, warningMinutes],
  );

  // Summary stats: opens today & longest open
  const { opensToday, longestOpen } = useMemo(() => {
    const todayStart = startOfDay(new Date());
    let opens = 0;
    let longest: { seconds: number; time: string } | null = null;

    for (const ev of events) {
      if (ev.state === "open" && new Date(ev.occurred_at) >= todayStart) {
        opens++;
        if (ev.durationSeconds !== null && (longest === null || ev.durationSeconds > longest.seconds)) {
          longest = { seconds: ev.durationSeconds, time: ev.occurred_at };
        }
      }
    }
    return { opensToday: opens, longestOpen: longest };
  }, [events]);

  // Pagination
  const visibleEvents = events.slice(0, visibleCount);
  const remainingCount = events.length - visibleCount;
  const handleShowMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  // Widget state
  const widgetState = useMemo((): WidgetStateInfo => {
    if (isLoading) return createLoadingState();
    if (!entityId) {
      return createNotConfiguredState("No unit selected.", "Select a unit to view door activity.", "Select Unit", "/units");
    }
    if (!primarySensor) {
      return createNotConfiguredState("No sensor assigned.", "Assign a door sensor to track events.", "Assign Sensor", "/settings/devices");
    }
    if (error) {
      return { status: "error" as const, message: "Failed to load door events", rootCause: error, action: { label: "Retry", onClick: () => window.location.reload() } };
    }
    if (events.length === 0) {
      return createEmptyState("No door events recorded yet.", "Door activity will appear here once the sensor reports open/close events.");
    }
    const lastDate = events[0]?.occurred_at ? new Date(events[0].occurred_at) : undefined;
    return createHealthyState(lastDate);
  }, [isLoading, entityId, primarySensor, error, events]);

  // Non-healthy states
  if (widgetState.status !== "healthy") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 p-4 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Activity className="w-4 h-4" />
            Door Activity
          </h3>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <WidgetEmptyState state={widgetState} compact />
        </div>
      </div>
    );
  }

  // Derive display state: prefer unit.door_state, fallback to latest event
  const displayState = currentState === "open" || currentState === "closed" ? currentState : events[0]?.state ?? null;
  const isOpen = displayState === "open";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Activity className="w-4 h-4" />
            Door Activity
          </h3>
          {displayState && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                isOpen
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                  : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-red-500" : "bg-green-500"}`} />
              {isOpen ? "Open" : "Closed"}
            </span>
          )}
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{opensToday}</span> opens today
          </span>
          {longestOpen && (
            <span>
              Longest: <span className="font-semibold text-foreground">{formatDurationHMS(longestOpen.seconds)}</span>{" "}
              at {format(new Date(longestOpen.time), "h:mm a")}
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
        <ScrollArea className="h-full">
          <div className="relative pl-5">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

            {visibleEvents.map((event) => {
              const eventIsOpen = event.state === "open";
              return (
                <div key={event.id} className="relative flex items-start gap-3 py-2.5">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-[-15px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                      event.isExtended
                        ? "bg-red-500"
                        : eventIsOpen
                          ? "bg-amber-400"
                          : "bg-green-500"
                    }`}
                  />

                  {/* Door icon */}
                  <div
                    className={`flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-md ${
                      eventIsOpen
                        ? "bg-amber-50 dark:bg-amber-950"
                        : "bg-green-50 dark:bg-green-950"
                    }`}
                  >
                    {eventIsOpen ? (
                      <DoorOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <DoorClosed className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{eventIsOpen ? "Opened" : "Closed"}</span>
                      {event.isExtended && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Extended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.occurred_at), "MMM d, h:mm a")}
                    </p>
                  </div>

                  {/* Duration badge */}
                  {event.durationSeconds !== null && (
                    <div
                      className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        eventIsOpen
                          ? event.isExtended
                            ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {eventIsOpen ? "Open" : "Closed"} {formatDurationHMS(event.durationSeconds)}
                    </div>
                  )}
                  {event.durationSeconds === null && (
                    <div className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {eventIsOpen ? "Open" : "Closed"} for &mdash;
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Show more */}
          {remainingCount > 0 && (
            <div className="flex justify-center pt-2 pb-1">
              <Button variant="outline" size="sm" onClick={handleShowMore} className="text-xs">
                Show {Math.min(remainingCount, PAGE_SIZE)} more events
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
