import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Moon } from "lucide-react";
import { useSnoozeAlert } from "@/hooks/useAlertSuppressions";
import { toast } from "sonner";

interface SnoozeAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: {
    id: string;
    alertType: string;
    unit_id: string;
    title: string;
  };
  organizationId: string;
}

const PRESET_DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "8 hours", minutes: 480 },
];

export function SnoozeAlertDialog({
  open,
  onOpenChange,
  alert,
  organizationId,
}: SnoozeAlertDialogProps) {
  const { snooze, isPending } = useSnoozeAlert();
  const [customMinutes, setCustomMinutes] = useState("");

  const handleSnooze = async (durationMinutes: number) => {
    try {
      await snooze({
        organizationId,
        unitId: alert.unit_id,
        alertType: alert.alertType,
        alertId: alert.id,
        durationMinutes,
      });
      toast.success(`Alert snoozed for ${durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`}`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to snooze alert");
      console.error("Snooze error:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-accent" />
            Snooze Alert
          </DialogTitle>
          <DialogDescription>
            Temporarily suppress "{alert.title}" notifications for this unit.
            The alert will stop triggering for the selected duration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset durations */}
          <div className="grid grid-cols-2 gap-2">
            {PRESET_DURATIONS.map((preset) => (
              <Button
                key={preset.minutes}
                variant="outline"
                className="h-12"
                onClick={() => handleSnooze(preset.minutes)}
                disabled={isPending}
              >
                <Clock className="w-4 h-4 mr-2" />
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom duration */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="custom-minutes" className="text-xs text-muted-foreground">
                Custom duration (minutes)
              </Label>
              <Input
                id="custom-minutes"
                type="number"
                min="1"
                max="10080"
                placeholder="e.g. 120"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                const mins = parseInt(customMinutes, 10);
                if (mins > 0) handleSnooze(mins);
              }}
              disabled={isPending || !customMinutes || parseInt(customMinutes, 10) <= 0}
            >
              Snooze
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
