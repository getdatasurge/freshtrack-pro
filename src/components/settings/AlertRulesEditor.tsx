import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, RotateCcw, Loader2, AlertTriangle, Clock, Wifi, DoorOpen, Thermometer } from "lucide-react";
import { 
  AlertRulesRow, 
  DEFAULT_ALERT_RULES, 
  upsertAlertRules, 
  deleteAlertRules 
} from "@/hooks/useAlertRules";

interface AlertRulesEditorProps {
  scope: { organization_id?: string; site_id?: string; unit_id?: string };
  scopeLabel: string;
  existingRules: AlertRulesRow | null;
  parentRules?: Partial<AlertRulesRow> | null; // For showing inherited values
  onSave?: () => void;
  canEdit: boolean;
}

export function AlertRulesEditor({
  scope,
  scopeLabel,
  existingRules,
  parentRules,
  onSave,
  canEdit,
}: AlertRulesEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [manualIntervalMinutes, setManualIntervalMinutes] = useState<string>("");
  const [manualGraceMinutes, setManualGraceMinutes] = useState<string>("");
  const [expectedReadingIntervalSeconds, setExpectedReadingIntervalSeconds] = useState<string>("");
  const [offlineTriggerMultiplier, setOfflineTriggerMultiplier] = useState<string>("");
  const [offlineTriggerAdditionalMinutes, setOfflineTriggerAdditionalMinutes] = useState<string>("");
  const [doorOpenWarningMinutes, setDoorOpenWarningMinutes] = useState<string>("");
  const [doorOpenCriticalMinutes, setDoorOpenCriticalMinutes] = useState<string>("");
  const [excursionConfirmMinutesDoorClosed, setExcursionConfirmMinutesDoorClosed] = useState<string>("");
  const [excursionConfirmMinutesDoorOpen, setExcursionConfirmMinutesDoorOpen] = useState<string>("");
  const [maxExcursionMinutes, setMaxExcursionMinutes] = useState<string>("");

  // Initialize form from existing rules
  useEffect(() => {
    if (existingRules) {
      setManualIntervalMinutes(existingRules.manual_interval_minutes?.toString() || "");
      setManualGraceMinutes(existingRules.manual_grace_minutes?.toString() || "");
      setExpectedReadingIntervalSeconds(existingRules.expected_reading_interval_seconds?.toString() || "");
      setOfflineTriggerMultiplier(existingRules.offline_trigger_multiplier?.toString() || "");
      setOfflineTriggerAdditionalMinutes(existingRules.offline_trigger_additional_minutes?.toString() || "");
      setDoorOpenWarningMinutes(existingRules.door_open_warning_minutes?.toString() || "");
      setDoorOpenCriticalMinutes(existingRules.door_open_critical_minutes?.toString() || "");
      setExcursionConfirmMinutesDoorClosed(existingRules.excursion_confirm_minutes_door_closed?.toString() || "");
      setExcursionConfirmMinutesDoorOpen(existingRules.excursion_confirm_minutes_door_open?.toString() || "");
      setMaxExcursionMinutes(existingRules.max_excursion_minutes?.toString() || "");
    }
  }, [existingRules]);

  const getEffectiveValue = (
    formValue: string, 
    parentValue: number | null | undefined, 
    defaultValue: number
  ): { value: number; source: "local" | "inherited" | "default" } => {
    if (formValue !== "") {
      return { value: parseInt(formValue) || 0, source: "local" };
    }
    if (parentValue !== null && parentValue !== undefined) {
      return { value: parentValue, source: "inherited" };
    }
    return { value: defaultValue, source: "default" };
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rules: Partial<AlertRulesRow> = {};
      
      if (manualIntervalMinutes !== "") rules.manual_interval_minutes = parseInt(manualIntervalMinutes);
      if (manualGraceMinutes !== "") rules.manual_grace_minutes = parseInt(manualGraceMinutes);
      if (expectedReadingIntervalSeconds !== "") rules.expected_reading_interval_seconds = parseInt(expectedReadingIntervalSeconds);
      if (offlineTriggerMultiplier !== "") rules.offline_trigger_multiplier = parseFloat(offlineTriggerMultiplier);
      if (offlineTriggerAdditionalMinutes !== "") rules.offline_trigger_additional_minutes = parseInt(offlineTriggerAdditionalMinutes);
      if (doorOpenWarningMinutes !== "") rules.door_open_warning_minutes = parseInt(doorOpenWarningMinutes);
      if (doorOpenCriticalMinutes !== "") rules.door_open_critical_minutes = parseInt(doorOpenCriticalMinutes);
      if (excursionConfirmMinutesDoorClosed !== "") rules.excursion_confirm_minutes_door_closed = parseInt(excursionConfirmMinutesDoorClosed);
      if (excursionConfirmMinutesDoorOpen !== "") rules.excursion_confirm_minutes_door_open = parseInt(excursionConfirmMinutesDoorOpen);
      if (maxExcursionMinutes !== "") rules.max_excursion_minutes = parseInt(maxExcursionMinutes);

      const { error } = await upsertAlertRules(scope, rules);
      
      if (error) throw error;
      toast.success("Alert rules saved");
      onSave?.();
    } catch (error) {
      console.error("Error saving alert rules:", error);
      toast.error("Failed to save alert rules");
    }
    setIsSaving(false);
  };

  const handleResetToDefault = async () => {
    if (!existingRules) {
      // Just clear form
      setManualIntervalMinutes("");
      setManualGraceMinutes("");
      setExpectedReadingIntervalSeconds("");
      setOfflineTriggerMultiplier("");
      setOfflineTriggerAdditionalMinutes("");
      setDoorOpenWarningMinutes("");
      setDoorOpenCriticalMinutes("");
      setExcursionConfirmMinutesDoorClosed("");
      setExcursionConfirmMinutesDoorOpen("");
      setMaxExcursionMinutes("");
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await deleteAlertRules(scope);
      if (error) throw error;
      
      // Clear form
      setManualIntervalMinutes("");
      setManualGraceMinutes("");
      setExpectedReadingIntervalSeconds("");
      setOfflineTriggerMultiplier("");
      setOfflineTriggerAdditionalMinutes("");
      setDoorOpenWarningMinutes("");
      setDoorOpenCriticalMinutes("");
      setExcursionConfirmMinutesDoorClosed("");
      setExcursionConfirmMinutesDoorOpen("");
      setMaxExcursionMinutes("");
      
      toast.success("Reset to defaults");
      onSave?.();
    } catch (error) {
      console.error("Error resetting alert rules:", error);
      toast.error("Failed to reset");
    }
    setIsDeleting(false);
  };

  const FieldWithSource = ({ 
    label, 
    value, 
    onChange, 
    parentValue, 
    defaultValue, 
    unit = "",
    type = "number",
    step = "1",
    min = "0",
  }: { 
    label: string; 
    value: string; 
    onChange: (v: string) => void; 
    parentValue?: number | null; 
    defaultValue: number;
    unit?: string;
    type?: string;
    step?: string;
    min?: string;
  }) => {
    const effective = getEffectiveValue(value, parentValue, defaultValue);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{label}</Label>
          <Badge 
            variant="outline" 
            className={
              effective.source === "local" 
                ? "bg-primary/10 text-primary border-primary/30" 
                : effective.source === "inherited"
                ? "bg-accent/10 text-accent border-accent/30"
                : "bg-muted text-muted-foreground"
            }
          >
            {effective.source === "local" ? "Custom" : effective.source === "inherited" ? "Inherited" : "Default"}
          </Badge>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type={type}
            step={step}
            min={min}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={effective.value.toString()}
            disabled={!canEdit}
            className="flex-1"
          />
          {unit && <span className="text-sm text-muted-foreground w-16">{unit}</span>}
        </div>
        {value === "" && (
          <p className="text-xs text-muted-foreground">
            Effective: {effective.value} {unit}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Alert Rules - {scopeLabel}
        </CardTitle>
        <CardDescription>
          Configure alert thresholds and timing. Leave blank to inherit from parent level.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Manual Logging Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="w-4 h-4 text-alarm" />
            Manual Logging (Critical)
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWithSource
              label="Required Interval"
              value={manualIntervalMinutes}
              onChange={setManualIntervalMinutes}
              parentValue={parentRules?.manual_interval_minutes}
              defaultValue={DEFAULT_ALERT_RULES.manual_interval_minutes}
              unit="minutes"
            />
            <FieldWithSource
              label="Grace Period"
              value={manualGraceMinutes}
              onChange={setManualGraceMinutes}
              parentValue={parentRules?.manual_grace_minutes}
              defaultValue={DEFAULT_ALERT_RULES.manual_grace_minutes}
              unit="minutes"
            />
          </div>
        </div>

        <Separator />

        {/* Offline/Heartbeat Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wifi className="w-4 h-4 text-warning" />
            Sensor Offline (Warning)
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldWithSource
              label="Expected Reading Interval"
              value={expectedReadingIntervalSeconds}
              onChange={setExpectedReadingIntervalSeconds}
              parentValue={parentRules?.expected_reading_interval_seconds}
              defaultValue={DEFAULT_ALERT_RULES.expected_reading_interval_seconds}
              unit="seconds"
            />
            <FieldWithSource
              label="Offline Multiplier"
              value={offlineTriggerMultiplier}
              onChange={setOfflineTriggerMultiplier}
              parentValue={parentRules?.offline_trigger_multiplier}
              defaultValue={DEFAULT_ALERT_RULES.offline_trigger_multiplier}
              unit="x"
              step="0.5"
            />
            <FieldWithSource
              label="Additional Buffer"
              value={offlineTriggerAdditionalMinutes}
              onChange={setOfflineTriggerAdditionalMinutes}
              parentValue={parentRules?.offline_trigger_additional_minutes}
              defaultValue={DEFAULT_ALERT_RULES.offline_trigger_additional_minutes}
              unit="minutes"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Offline triggers after: (interval × multiplier) + buffer
          </p>
        </div>

        <Separator />

        {/* Door Open Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <DoorOpen className="w-4 h-4 text-excursion" />
            Door Left Open
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWithSource
              label="Warning After"
              value={doorOpenWarningMinutes}
              onChange={setDoorOpenWarningMinutes}
              parentValue={parentRules?.door_open_warning_minutes}
              defaultValue={DEFAULT_ALERT_RULES.door_open_warning_minutes}
              unit="minutes"
            />
            <FieldWithSource
              label="Critical After"
              value={doorOpenCriticalMinutes}
              onChange={setDoorOpenCriticalMinutes}
              parentValue={parentRules?.door_open_critical_minutes}
              defaultValue={DEFAULT_ALERT_RULES.door_open_critical_minutes}
              unit="minutes"
            />
          </div>
        </div>

        <Separator />

        {/* Temperature Excursion Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Thermometer className="w-4 h-4 text-alarm" />
            Temperature Excursion
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldWithSource
              label="Confirm (Door Closed)"
              value={excursionConfirmMinutesDoorClosed}
              onChange={setExcursionConfirmMinutesDoorClosed}
              parentValue={parentRules?.excursion_confirm_minutes_door_closed}
              defaultValue={DEFAULT_ALERT_RULES.excursion_confirm_minutes_door_closed}
              unit="minutes"
            />
            <FieldWithSource
              label="Confirm (Door Open)"
              value={excursionConfirmMinutesDoorOpen}
              onChange={setExcursionConfirmMinutesDoorOpen}
              parentValue={parentRules?.excursion_confirm_minutes_door_open}
              defaultValue={DEFAULT_ALERT_RULES.excursion_confirm_minutes_door_open}
              unit="minutes"
            />
            <FieldWithSource
              label="Max Duration"
              value={maxExcursionMinutes}
              onChange={setMaxExcursionMinutes}
              parentValue={parentRules?.max_excursion_minutes}
              defaultValue={DEFAULT_ALERT_RULES.max_excursion_minutes}
              unit="minutes"
            />
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={handleResetToDefault}
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Rules
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
