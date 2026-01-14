/**
 * Event Timeline Widget
 * 
 * Unified timeline of alerts, readings, manual logs, and door events.
 * Includes filter chips and load more functionality.
 */

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  AlertTriangle, 
  ClipboardList, 
  DoorOpen,
  Activity,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format, isToday, isYesterday } from "date-fns";

interface TimelineEvent {
  id: string;
  type: "alert" | "reading" | "manual_log" | "door";
  title: string;
  description?: string;
  timestamp: string;
}

type FilterType = "alert" | "manual_log" | "door";

const EVENTS_PER_PAGE = 20;

function formatDateHeader(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function groupEventsByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  events.forEach(event => {
    const dateKey = format(new Date(event.timestamp), "yyyy-MM-dd");
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(event);
  });
  return groups;
}

export function EventTimelineWidget({ entityId }: WidgetProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<Record<FilterType, boolean>>({
    alert: true,
    manual_log: true,
    door: true,
  });

  const fetchEvents = useCallback(async (append = false) => {
    if (!entityId) {
      setIsLoading(false);
      return;
    }

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const allEvents: TimelineEvent[] = [];
      const currentCount = append ? events.length : 0;
      const limit = EVENTS_PER_PAGE;

      // Fetch alerts if filter enabled
      if (filters.alert) {
        const { data: alerts } = await supabase
          .from("alerts")
          .select("id, title, severity, created_at")
          .eq("unit_id", entityId)
          .order("created_at", { ascending: false })
          .range(currentCount, currentCount + limit - 1);

        alerts?.forEach(a => {
          allEvents.push({
            id: `alert-${a.id}`,
            type: "alert",
            title: a.title,
            description: `${a.severity} alert`,
            timestamp: a.created_at,
          });
        });
      }

      // Fetch manual logs if filter enabled
      if (filters.manual_log) {
        const { data: logs } = await supabase
          .from("manual_temperature_logs")
          .select("id, temperature, notes, logged_at")
          .eq("unit_id", entityId)
          .order("logged_at", { ascending: false })
          .range(currentCount, currentCount + limit - 1);

        logs?.forEach(l => {
          allEvents.push({
            id: `log-${l.id}`,
            type: "manual_log",
            title: `Manual log: ${l.temperature}°`,
            description: l.notes || undefined,
            timestamp: l.logged_at,
          });
        });
      }

      // Fetch door events if filter enabled
      if (filters.door) {
        const { data: doorEvents } = await supabase
          .from("door_events")
          .select("id, state, occurred_at")
          .eq("unit_id", entityId)
          .order("occurred_at", { ascending: false })
          .range(currentCount, currentCount + limit - 1);

        doorEvents?.forEach(d => {
          allEvents.push({
            id: `door-${d.id}`,
            type: "door",
            title: `Door ${d.state}`,
            timestamp: d.occurred_at,
          });
        });
      }

      // Sort all events by timestamp
      allEvents.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Limit to page size
      const pageEvents = allEvents.slice(0, EVENTS_PER_PAGE);
      
      if (append) {
        setEvents(prev => [...prev, ...pageEvents]);
      } else {
        setEvents(pageEvents);
      }

      // Check if there might be more events
      setHasMore(allEvents.length >= EVENTS_PER_PAGE);
    } catch (err) {
      console.error("Error fetching timeline events:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [entityId, filters, events.length]);

  useEffect(() => {
    setEvents([]);
    fetchEvents(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, filters]);

  const handleLoadMore = () => {
    fetchEvents(true);
  };

  const toggleFilter = (type: FilterType) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const filterLabels: Record<FilterType, string> = {
    alert: "Alerts",
    manual_log: "Logs",
    door: "Door",
  };

  const typeConfig = {
    alert: { icon: AlertTriangle, color: "text-destructive" },
    reading: { icon: Activity, color: "text-blue-500" },
    manual_log: { icon: ClipboardList, color: "text-green-500" },
    door: { icon: DoorOpen, color: "text-orange-500" },
  };

  const filteredEvents = events.filter(e => filters[e.type as FilterType]);
  const groupedEvents = groupEventsByDate(filteredEvents);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Event Timeline
        </CardTitle>
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(filters) as FilterType[]).map(type => (
            <Button
              key={type}
              variant={filters[type] ? "secondary" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => toggleFilter(type)}
            >
              {filterLabels[type]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground text-sm py-8">
            No events match filters
          </div>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-4">
              {Array.from(groupedEvents.entries()).map(([dateKey, dateEvents]) => (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {formatDateHeader(new Date(dateKey))}
                  </p>
                  <div className="space-y-2">
                    {dateEvents.map((event) => {
                      const config = typeConfig[event.type];
                      const Icon = config.icon;
                      return (
                        <div
                          key={event.id}
                          className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className={`mt-0.5 ${config.color}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {event.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(event.timestamp), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="pt-2 pb-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
