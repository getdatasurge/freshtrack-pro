/**
 * Door Activity Widget
 * 
 * Shows door open/close events with duration statistics.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DoorOpen, DoorClosed, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format, formatDistanceToNow } from "date-fns";

interface DoorEvent {
  id: string;
  state: string;
  occurred_at: string;
}

export function DoorActivityWidget({ entityId }: WidgetProps) {
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDoorEvents() {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("door_events")
          .select("id, state, occurred_at")
          .eq("unit_id", entityId)
          .order("occurred_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        setEvents(data || []);
      } catch (err) {
        console.error("Error fetching door events:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDoorEvents();
  }, [entityId]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DoorOpen className="h-4 w-4" />
            Door Activity
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
            <DoorOpen className="h-4 w-4" />
            Door Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          No door events recorded
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DoorOpen className="h-4 w-4" />
          Door Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-border"
              >
                {event.state === "open" ? (
                  <DoorOpen className="h-5 w-5 text-orange-500" />
                ) : (
                  <DoorClosed className="h-5 w-5 text-green-500" />
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
      </CardContent>
    </Card>
  );
}
