import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Thermometer,
  Loader2,
  WifiOff,
  Clock,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useUnitsSafe } from "@/contexts/UnitsContext";
import { temperatureSchema, notesSchema, validateInput } from "@/lib/validation";
import { Session } from "@supabase/supabase-js";

export interface LogTempUnit {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  manual_log_cadence: number;
  area: { name: string; site: { name: string } };
}

interface LogTempModalProps {
  unit: LogTempUnit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  session: Session | null;
}

const formatCadence = (seconds: number) => {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} min`;
  if (hours === 1) return "1 hour";
  return `${hours} hours`;
};

const LogTempModal = ({ unit, open, onOpenChange, onSuccess, session }: LogTempModalProps) => {
  const { toast } = useToast();
  const { isOnline, saveLogOffline } = useOfflineSync();
  const { formatTemp, toDisplayTemp, fromDisplayTemp, unitSymbol } = useUnitsSafe();
  const [temperature, setTemperature] = useState("");
  const [notes, setNotes] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when unit changes
  useEffect(() => {
    if (unit) {
      setTemperature("");
      setNotes("");
      setCorrectiveAction("");
    }
  }, [unit?.id]);

  const handleSubmit = async () => {
    if (!unit) {
      toast({ title: "Please select a unit", variant: "destructive" });
      return;
    }

    // User input is in display units - convert to Fahrenheit for storage
    const tempDisplay = parseFloat(temperature);
    if (isNaN(tempDisplay)) {
      toast({ title: "Please enter a valid temperature", variant: "destructive" });
      return;
    }
    const tempFahrenheit = fromDisplayTemp(tempDisplay) ?? tempDisplay;

    // Validate the Fahrenheit value
    const tempResult = validateInput(temperatureSchema, tempFahrenheit);
    if (!tempResult.success) {
      toast({ title: (tempResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    // Validate notes
    const notesResult = validateInput(notesSchema, notes);
    if (!notesResult.success) {
      toast({ title: (notesResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    // Check if out of range and require corrective action (limits are in Fahrenheit)
    const validatedTemp = (tempResult as { success: true; data: number }).data;
    const isOutOfRange = validatedTemp > unit.temp_limit_high ||
      (unit.temp_limit_low !== null && validatedTemp < unit.temp_limit_low);
    
    if (isOutOfRange && !correctiveAction.trim()) {
      toast({ 
        title: "Corrective action required", 
        description: "Temperature is out of range. Please describe the corrective action taken.",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    const validatedNotes = (notesResult as { success: true; data: string | undefined }).data?.trim() || null;
    
    const logEntry = {
      id: crypto.randomUUID(),
      unit_id: unit.id,
      temperature: validatedTemp,
      notes: validatedNotes,
      logged_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      if (isOnline && session) {
        // Save to Supabase
        const { error } = await supabase.from("manual_temperature_logs").insert({
          unit_id: logEntry.unit_id,
          temperature: logEntry.temperature,
          notes: logEntry.notes,
          logged_at: logEntry.logged_at,
          logged_by: session.user.id,
          is_in_range: !isOutOfRange,
        });

        if (error) throw error;

        // If out of range, also create corrective action record
        if (isOutOfRange && correctiveAction.trim()) {
          await supabase.from("corrective_actions").insert({
            unit_id: unit.id,
            action_taken: correctiveAction.trim(),
            created_by: session.user.id,
          });
        }

        // Resolve any existing missed_manual_entry alerts for this unit
        if (!isOutOfRange) {
          await supabase
            .from("alerts")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolved_by: session.user.id,
            })
            .eq("unit_id", unit.id)
            .eq("alert_type", "missed_manual_entry")
            .in("status", ["active", "acknowledged"]);
        }

        toast({ title: "Temperature logged successfully" });
      } else {
        await saveLogOffline(logEntry);
        toast({
          title: "Saved offline",
          description: "Will sync when back online",
        });
      }

      // Close modal and trigger callback
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving log:", error);
      await saveLogOffline(logEntry);
      toast({
        title: "Saved offline",
        description: "Will sync when back online",
        variant: "default",
      });
      onOpenChange(false);
      onSuccess?.();
    }

    setIsSubmitting(false);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen && !isOnline) {
      // Prevent silent dismissal when offline - require confirmation
      const confirmed = window.confirm(
        "You are offline. Are you sure you want to close without logging? The unit may require a temperature log."
      );
      if (!confirmed) return;
    }
    if (!newOpen) {
      setTemperature("");
      setNotes("");
      setCorrectiveAction("");
    }
    onOpenChange(newOpen);
  };

  // Convert user input from display units to Fahrenheit for comparison with limits
  const tempInFahrenheit = temperature ? fromDisplayTemp(parseFloat(temperature)) : null;
  const isOutOfRange = tempInFahrenheit !== null && unit && (
    tempInFahrenheit > unit.temp_limit_high ||
    (unit.temp_limit_low !== null && tempInFahrenheit < unit.temp_limit_low)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-accent" />
            Log Temperature
          </DialogTitle>
        </DialogHeader>

        {unit && (
          <div className="space-y-4 pt-2">
            {/* Unit Info with Status */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-foreground">{unit.name}</p>
                {(unit.status === "manual_required" || unit.status === "monitoring_interrupted" || unit.status === "offline") && (
                  <Badge variant="destructive" className="text-xs">
                    {unit.status === "offline" ? "Sensor Offline" : "Manual Required"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {unit.area.site.name} · {unit.area.name}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-muted-foreground">
                  Limit: ≤{formatTemp(unit.temp_limit_high)}
                  {unit.temp_limit_low !== null && ` / ≥${formatTemp(unit.temp_limit_low)}`}
                </span>
                <span className="text-muted-foreground border-l border-border pl-4">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Log every {formatCadence(unit.manual_log_cadence)}
                </span>
              </div>
            </div>

            {/* Offline Warning */}
            {!isOnline && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
                <WifiOff className="w-4 h-4 text-warning flex-shrink-0" />
                <p className="text-xs text-warning">
                  You are offline. Log will be saved locally and synced when connection is restored.
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Temperature ({unitSymbol}) *
              </label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Enter temperature"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="text-2xl font-bold h-14 text-center"
                autoFocus
              />
              {temperature && tempInFahrenheit !== null && (
                <div className="mt-2 text-center">
                  {tempInFahrenheit > unit.temp_limit_high ? (
                    <Badge variant="destructive">Above Limit!</Badge>
                  ) : unit.temp_limit_low !== null &&
                    tempInFahrenheit < unit.temp_limit_low ? (
                    <Badge variant="destructive">Below Limit!</Badge>
                  ) : (
                    <Badge className="bg-safe/10 text-safe border-safe/20">In Range</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Corrective Action - Required when out of range */}
            {isOutOfRange && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <label className="text-sm font-medium text-destructive mb-2 block">
                  Corrective Action Required *
                </label>
                <Textarea
                  placeholder="Describe the corrective action taken (e.g., 'Adjusted thermostat, discarded affected items, notified manager')"
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  rows={3}
                  className="border-destructive/30 focus:border-destructive"
                />
                <p className="text-xs text-destructive/80 mt-2">
                  Temperature is out of range. You must document the corrective action before submitting.
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Notes (optional)
              </label>
              <Textarea
                placeholder="Any observations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-accent hover:bg-accent/90"
                onClick={handleSubmit}
                disabled={isSubmitting || !temperature}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save Log
              </Button>
            </div>

            {!isOnline && (
              <p className="text-xs text-center text-muted-foreground">
                <WifiOff className="w-3 h-3 inline mr-1" />
                Offline - will sync when connected
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LogTempModal;
