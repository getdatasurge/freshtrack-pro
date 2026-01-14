/**
 * Annotations Widget
 * 
 * View and add notes, comments, and shift handoff information.
 * MVP: Shows recent event log notes with add note button.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Annotation {
  id: string;
  title: string | null;
  event_data: {
    note?: string;
    message?: string;
  };
  recorded_at: string;
  actor_id: string | null;
}

export function AnnotationsWidget({ entityId, organizationId }: WidgetProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnotations() {
      if (!entityId || !organizationId) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch event logs that are notes or comments
        const { data, error } = await supabase
          .from("event_logs")
          .select("id, title, event_data, recorded_at, actor_id")
          .eq("unit_id", entityId)
          .eq("organization_id", organizationId)
          .in("event_type", ["note_added", "comment", "shift_handoff", "manual_log"])
          .order("recorded_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setAnnotations((data as Annotation[]) || []);
      } catch (err) {
        console.error("Error fetching annotations:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnnotations();
  }, [entityId, organizationId]);

  const handleAddNote = () => {
    toast.info("Add note feature coming soon");
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Annotations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Annotations
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleAddNote}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No annotations yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleAddNote}>
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {annotations.map((annotation) => {
                const noteText = annotation.event_data?.note 
                  || annotation.event_data?.message 
                  || annotation.title 
                  || "No content";

                return (
                  <div
                    key={annotation.id}
                    className="p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <p className="text-sm">{noteText}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>
                        {format(new Date(annotation.recorded_at), "MMM d, h:mm a")}
                      </span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(annotation.recorded_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
