/**
 * Annotations Widget
 * 
 * View and add notes, comments, and shift handoff information.
 * Persists notes to event_logs table.
 * Displays author name/email and timestamp for each annotation.
 * Allows managers/admins to delete annotations.
 */

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Plus, Loader2, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/useUserRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RawAnnotation {
  id: string;
  title: string | null;
  event_data: {
    note?: string;
    message?: string;
  };
  recorded_at: string;
  actor_id: string | null;
}

interface Annotation extends RawAnnotation {
  author_name: string | null;
  author_email: string | null;
}

export function AnnotationsWidget({ entityId, organizationId }: WidgetProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [annotationToDelete, setAnnotationToDelete] = useState<Annotation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { canManageAnnotations } = usePermissions();

  const fetchAnnotations = useCallback(async () => {
    if (!entityId || !organizationId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch event logs
      const { data: rawAnnotations, error } = await supabase
        .from("event_logs")
        .select("id, title, event_data, recorded_at, actor_id")
        .eq("unit_id", entityId)
        .eq("organization_id", organizationId)
        .in("event_type", ["note_added", "comment", "shift_handoff", "annotation"])
        .order("recorded_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      if (!rawAnnotations || rawAnnotations.length === 0) {
        setAnnotations([]);
        setIsLoading(false);
        return;
      }

      // Get unique actor_ids to fetch profiles
      const actorIds = [...new Set(rawAnnotations.map(a => a.actor_id).filter(Boolean))] as string[];
      
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", actorIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      // Merge annotations with profile data
      const enrichedAnnotations: Annotation[] = rawAnnotations.map(a => ({
        ...a,
        event_data: a.event_data as { note?: string; message?: string },
        author_name: a.actor_id ? profilesMap[a.actor_id]?.full_name || null : null,
        author_email: a.actor_id ? profilesMap[a.actor_id]?.email || null : null,
      }));

      setAnnotations(enrichedAnnotations);
    } catch (err) {
      console.error("Error fetching annotations:", err);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, organizationId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  const handleSaveNote = async () => {
    if (!noteText.trim() || !entityId || !organizationId) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("event_logs")
        .insert({
          organization_id: organizationId,
          unit_id: entityId,
          event_type: "note_added",
          event_data: { note: noteText.trim() },
          actor_id: user?.id || null,
          recorded_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Note added");
      setNoteText("");
      setIsAddingNote(false);
      fetchAnnotations();
    } catch (err) {
      console.error("Failed to save note:", err);
      toast.error("Failed to add note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsAddingNote(false);
    setNoteText("");
  };

  const handleDeleteAnnotation = async () => {
    if (!annotationToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("event_logs")
        .delete()
        .eq("id", annotationToDelete.id);

      if (error) throw error;

      toast.success("Annotation deleted");
      setAnnotationToDelete(null);
      fetchAnnotations();
    } catch (err) {
      console.error("Failed to delete annotation:", err);
      toast.error("Failed to delete annotation");
    } finally {
      setIsDeleting(false);
    }
  };

  const getAuthorDisplay = (annotation: Annotation): string => {
    if (annotation.author_name) {
      return annotation.author_name;
    }
    if (annotation.author_email) {
      return annotation.author_email;
    }
    return "Unknown user";
  };

  const formatTimestamp = (dateString: string): string => {
    try {
      return format(new Date(dateString), "MMM d, yyyy · h:mm a");
    } catch {
      return "Unknown time";
    }
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
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Annotations
          </CardTitle>
          {!isAddingNote && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsAddingNote(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          {isAddingNote && (
            <div className="p-3 border rounded-lg mb-3 space-y-2 bg-muted/30">
              <Textarea
                placeholder="Enter your note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="resize-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveNote} 
                  disabled={isSaving || !noteText.trim()}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Note"
                  )}
                </Button>
              </div>
            </div>
          )}

          {annotations.length === 0 && !isAddingNote ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No annotations yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsAddingNote(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {annotations.map((annotation) => {
                  const noteContent = annotation.event_data?.note 
                    || annotation.event_data?.message 
                    || annotation.title 
                    || "No content";

                  return (
                    <div
                      key={annotation.id}
                      className="p-3 rounded-lg border border-border bg-muted/30 group"
                    >
                      {/* Header: Author + Timestamp + Delete */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">
                            {getAuthorDisplay(annotation)}
                          </span>
                          <span>·</span>
                          <span>{formatTimestamp(annotation.recorded_at)}</span>
                        </div>
                        {canManageAnnotations && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => setAnnotationToDelete(annotation)}
                            aria-label="Delete annotation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {/* Content */}
                      <p className="text-sm whitespace-pre-wrap">{noteContent}</p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!annotationToDelete} onOpenChange={() => setAnnotationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Annotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The annotation will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAnnotation}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
