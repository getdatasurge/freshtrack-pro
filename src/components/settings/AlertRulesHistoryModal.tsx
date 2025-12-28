import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, ArrowRight } from "lucide-react";
import { useAlertRulesHistory } from "@/hooks/useAlertRulesHistory";

interface AlertRulesHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: { organization_id?: string; site_id?: string; unit_id?: string };
  scopeLabel: string;
}

const FIELD_LABELS: Record<string, string> = {
  manual_interval_minutes: "Manual Logging Interval",
  manual_grace_minutes: "Manual Grace Period",
  expected_reading_interval_seconds: "Expected Reading Interval",
  offline_trigger_multiplier: "Offline Multiplier",
  offline_trigger_additional_minutes: "Offline Buffer",
  door_open_warning_minutes: "Door Open Warning",
  door_open_critical_minutes: "Door Open Critical",
  door_open_max_mask_minutes_per_day: "Door Mask Max/Day",
  excursion_confirm_minutes_door_closed: "Excursion Confirm (Closed)",
  excursion_confirm_minutes_door_open: "Excursion Confirm (Open)",
  max_excursion_minutes: "Max Excursion Duration",
};

const ACTION_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CREATE: { label: "Created", variant: "default" },
  UPDATE: { label: "Updated", variant: "secondary" },
  DELETE: { label: "Reset", variant: "destructive" },
  CLEAR_FIELD: { label: "Cleared", variant: "outline" },
};

export function AlertRulesHistoryModal({
  open,
  onOpenChange,
  scope,
  scopeLabel,
}: AlertRulesHistoryModalProps) {
  const { data: history, isLoading } = useAlertRulesHistory(scope, 50);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Alert Rules History - {scopeLabel}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No changes recorded yet
          </div>
        ) : (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={ACTION_BADGES[entry.action]?.variant || "secondary"}>
                          {ACTION_BADGES[entry.action]?.label || entry.action}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(entry.changed_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        {entry.user_name || entry.user_email || "Unknown user"}
                      </p>
                    </div>
                  </div>

                  {Object.keys(entry.changes).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(entry.changes).map(([field, change]) => (
                        <div
                          key={field}
                          className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-2"
                        >
                          <span className="font-medium min-w-[180px]">
                            {FIELD_LABELS[field] || field}
                          </span>
                          <span className="text-muted-foreground">
                            {change.from === null || change.from === undefined
                              ? "(inherited)"
                              : String(change.from)}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground">
                            {change.to === null || change.to === undefined
                              ? "(inherited)"
                              : String(change.to)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.note && (
                    <p className="text-sm text-muted-foreground italic">
                      Note: {entry.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
