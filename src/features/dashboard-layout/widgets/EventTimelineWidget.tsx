/**
 * Event Timeline Widget
 * 
 * Unified timeline of alerts, readings, manual logs, and door events.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  AlertTriangle, 
  Thermometer, 
  ClipboardList, 
  DoorOpen,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format, formatDistanceToNow } from "date-fns";

interface TimelineEvent {
  id: string;
  type: "alert" | "reading" | "manual_log" | "door";
  title: string;
  description?: string;
  timestamp: string;
}

export function EventTimelineWidget({ entityId }: WidgetProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        const allEvents: TimelineEvent[] = [];

        // Fetch recent alerts
        const { data: alerts } = await supabase
          .from("alerts")
          .select("id, title, severity, created_at")
          .eq("unit_id", entityId)
          .order("created_at", { ascending: false })
          .limit(10);

        alerts?.forEach(a => {
          allEvents.push({
            id: `alert-${a.id}`,
            type: "alert",
            title: a.title,
            description: `${a.severity} alert`,
            timestamp: a.created_at,
          });
        });

        // Fetch recent manual logs
        const { data: logs } = await supabase
          .from("manual_temperature_logs")
          .select("id, temperature, logged_at")
          .eq("unit_id", entityId)
          .order("logged_at", { ascending: false })
          .limit(10);

        logs?.forEach(l => {
          allEvents.push({
            id: `log-${l.id}`,
            type: "manual_log",
            title: `Manual log: ${l.temperature}°`,
            timestamp: l.logged_at,
          });
        });

        // Fetch recent door events
        const { data: doorEvents } = await supabase
          .from("door_events")
          .select("id, state, occurred_at")
          .eq("unit_id", entityId)
          .order("occurred_at", { ascending: false })
          .limit(10);

        doorEvents?.forEach(d => {
          allEvents.push({
            id: `door-${d.id}`,
            type: "door",
            title: `Door ${d.state}`,
            timestamp: d.occurred_at,
          });
        });

        // Sort all events by timestamp
        allEvents.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setEvents(allEvents.slice(0, 20));
      } catch (err) {
        console.error("Error fetching timeline events:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, [entityId]);

  const typeConfig = {
    alert: { icon: AlertTriangle, color: "text-destructive" },
    reading: { icon: Activity, color: "text-blue-500" },
    manual_log: { icon: ClipboardList, color: "text-green-500" },
    door: { icon: DoorOpen, color: "text-orange-500" },
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          No events recorded
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Event Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {events.map((event) => {
                const config = typeConfig[event.type];
                const Icon = config.icon;
                
                return (
                  <div key={event.id} className="flex gap-3 relative">
                    <div className={`z-10 p-1.5 rounded-full bg-background border border-border ${config.color}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.timestamp), "MMM d, h:mm a")}
                        {" • "}
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
