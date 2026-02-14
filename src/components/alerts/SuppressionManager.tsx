import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PauseCircle, Plus, X, Clock } from "lucide-react";
import {
  useActiveSuppressions,
  useCreateSuppression,
  useCancelSuppression,
  type AlertSuppression,
} from "@/hooks/useAlertSuppressions";
import { ALERT_TYPE_LABELS } from "@/lib/alertTemplates";
import { useOrgScope } from "@/hooks/useOrgScope";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const REASON_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  defrost: "Defrost Cycle",
  relocation: "Relocation",
  snooze: "Snooze",
  other: "Other",
};

const REASON_COLORS: Record<string, string> = {
  maintenance: "bg-accent/10 text-accent",
  defrost: "bg-sky-500/10 text-sky-600",
  relocation: "bg-purple-500/10 text-purple-600",
  snooze: "bg-warning/10 text-warning",
  other: "bg-muted text-muted-foreground",
};

const DURATION_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "8 hours", minutes: 480 },
  { label: "24 hours", minutes: 1440 },
];

const ALERT_TYPES = Object.keys(ALERT_TYPE_LABELS);

export function SuppressionManager() {
  const { orgId } = useOrgScope();
  const { data: suppressions = [], isLoading } = useActiveSuppressions();
  const createSuppression = useCreateSuppression();
  const cancelSuppression = useCancelSuppression();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create dialog state
  const [reason, setReason] = useState<string>("maintenance");
  const [customReason, setCustomReason] = useState("");
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(240);
  const [customDuration, setCustomDuration] = useState("");

  const handleCreate = async () => {
    if (!orgId) return;
    const duration = customDuration ? parseInt(customDuration, 10) : durationMinutes;
    if (!duration || duration <= 0) return;

    try {
      await createSuppression.mutateAsync({
        organization_id: orgId,
        alert_types: selectedAlertTypes,
        reason: reason as AlertSuppression["reason"],
        custom_reason: reason === "other" ? customReason : null,
        ends_at: new Date(Date.now() + duration * 60 * 1000).toISOString(),
      });
      toast.success("Suppression window created");
      setShowCreateDialog(false);
      resetForm();
    } catch {
      toast.error("Failed to create suppression");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelSuppression.mutateAsync(id);
      toast.success("Suppression cancelled");
    } catch {
      toast.error("Failed to cancel suppression");
    }
  };

  const resetForm = () => {
    setReason("maintenance");
    setCustomReason("");
    setSelectedAlertTypes([]);
    setDurationMinutes(240);
    setCustomDuration("");
  };

  const toggleAlertType = (type: string) => {
    setSelectedAlertTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <PauseCircle className="w-4 h-4 text-accent" />
              Alert Suppressions
              {suppressions.length > 0 && (
                <Badge variant="secondary" className="ml-1">{suppressions.length} active</Badge>
              )}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Window
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : suppressions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active suppression windows. Alerts are being processed normally.
            </p>
          ) : (
            <div className="space-y-2">
              {suppressions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={REASON_COLORS[s.reason] || REASON_COLORS.other}>
                        {REASON_LABELS[s.reason] || s.reason}
                      </Badge>
                      {s.unit?.name && (
                        <span className="text-sm text-foreground font-medium">{s.unit.name}</span>
                      )}
                      {s.site?.name && !s.unit && (
                        <span className="text-sm text-foreground font-medium">{s.site.name} (site)</span>
                      )}
                      {!s.unit && !s.site && (
                        <span className="text-sm text-muted-foreground">Organization-wide</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires {formatDistanceToNow(new Date(s.ends_at), { addSuffix: true })}
                      </span>
                      {s.alert_types.length > 0 ? (
                        <span>{s.alert_types.map(t => ALERT_TYPE_LABELS[t] || t).join(", ")}</span>
                      ) : (
                        <span>All alert types</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-alarm"
                    onClick={() => handleCancel(s.id)}
                    disabled={cancelSuppression.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Suppression Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Suppression Window</DialogTitle>
            <DialogDescription>
              Temporarily suppress alert creation for a maintenance window, defrost cycle, or other reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="defrost">Defrost Cycle</SelectItem>
                  <SelectItem value="relocation">Relocation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {reason === "other" && (
                <Input
                  placeholder="Describe the reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              )}
            </div>

            {/* Alert Types */}
            <div className="space-y-2">
              <Label>Alert Types to Suppress</Label>
              <p className="text-xs text-muted-foreground">Leave all unchecked to suppress all alert types</p>
              <div className="grid grid-cols-2 gap-2">
                {ALERT_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={selectedAlertTypes.includes(type)}
                      onCheckedChange={() => toggleAlertType(type)}
                    />
                    <label htmlFor={`type-${type}`} className="text-sm cursor-pointer">
                      {ALERT_TYPE_LABELS[type]}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <Button
                    key={preset.minutes}
                    size="sm"
                    variant={durationMinutes === preset.minutes && !customDuration ? "default" : "outline"}
                    onClick={() => {
                      setDurationMinutes(preset.minutes);
                      setCustomDuration("");
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="custom-dur" className="text-xs text-muted-foreground">
                    Custom (minutes)
                  </Label>
                  <Input
                    id="custom-dur"
                    type="number"
                    min="1"
                    max="10080"
                    placeholder="e.g. 120"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createSuppression.isPending}
            >
              {createSuppression.isPending ? "Creating..." : "Create Suppression Window"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
