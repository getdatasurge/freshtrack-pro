import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, RotateCcw, Loader2, AlertTriangle, Clock, Wifi, DoorOpen, Thermometer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertRulesRow, 
  DEFAULT_ALERT_RULES, 
  upsertAlertRules, 
  deleteAlertRules 
} from "@/hooks/useAlertRules";
import { insertAlertRulesHistory } from "@/hooks/useAlertRulesHistory";

interface AlertRulesEditorProps {
  scope: { organization_id?: string; site_id?: string; unit_id?: string };
  scopeLabel: string;
  existingRules: AlertRulesRow | null;
  parentRules?: Partial<AlertRulesRow> | null;
  onSave?: () => void;
  canEdit: boolean;
}

type RuleField = 
  | "manual_interval_minutes"
  | "manual_grace_minutes"
  | "expected_reading_interval_seconds"
  | "offline_trigger_multiplier"
  | "offline_trigger_additional_minutes"
  | "door_open_warning_minutes"
  | "door_open_critical_minutes"
  | "excursion_confirm_minutes_door_closed"
  | "excursion_confirm_minutes_door_open"
  | "max_excursion_minutes";

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
  const [clearingField, setClearingField] = useState<string | null>(null);

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

  const isOrgScope = !!scope.organization_id && !scope.site_id && !scope.unit_id;

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
    } else {
      // Clear form when no existing rules
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
    }
  }, [existingRules]);

  const getEffectiveValue = (
    formValue: string, 
    parentValue: number | null | undefined, 
    defaultValue: number
  ): { value: number; source: "local" | "inherited" | "default" } => {
    if (formValue !== "") {
      return { value: parseFloat(formValue) || 0, source: "local" };
    }
    if (parentValue !== null && parentValue !== undefined) {
      return { value: parentValue, source: "inherited" };
    }
    return { value: defaultValue, source: "default" };
  };

  const getFieldValue = (field: RuleField): string => {
    const map: Record<RuleField, string> = {
      manual_interval_minutes: manualIntervalMinutes,
      manual_grace_minutes: manualGraceMinutes,
      expected_reading_interval_seconds: expectedReadingIntervalSeconds,
      offline_trigger_multiplier: offlineTriggerMultiplier,
      offline_trigger_additional_minutes: offlineTriggerAdditionalMinutes,
      door_open_warning_minutes: doorOpenWarningMinutes,
      door_open_critical_minutes: doorOpenCriticalMinutes,
      excursion_confirm_minutes_door_closed: excursionConfirmMinutesDoorClosed,
      excursion_confirm_minutes_door_open: excursionConfirmMinutesDoorOpen,
      max_excursion_minutes: maxExcursionMinutes,
    };
    return map[field];
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const rules: Partial<AlertRulesRow> = {};
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      
      const addIfChanged = (field: RuleField, value: string, parser: (v: string) => number) => {
        const oldValue = existingRules?.[field] ?? null;
        if (value !== "") {
          const newValue = parser(value);
          rules[field] = newValue as any;
          if (oldValue !== newValue) {
            changes[field] = { from: oldValue, to: newValue };
          }
        }
      };

      addIfChanged("manual_interval_minutes", manualIntervalMinutes, parseInt);
      addIfChanged("manual_grace_minutes", manualGraceMinutes, parseInt);
      addIfChanged("expected_reading_interval_seconds", expectedReadingIntervalSeconds, parseInt);
      addIfChanged("offline_trigger_multiplier", offlineTriggerMultiplier, parseFloat);
      addIfChanged("offline_trigger_additional_minutes", offlineTriggerAdditionalMinutes, parseInt);
      addIfChanged("door_open_warning_minutes", doorOpenWarningMinutes, parseInt);
      addIfChanged("door_open_critical_minutes", doorOpenCriticalMinutes, parseInt);
      addIfChanged("excursion_confirm_minutes_door_closed", excursionConfirmMinutesDoorClosed, parseInt);
      addIfChanged("excursion_confirm_minutes_door_open", excursionConfirmMinutesDoorOpen, parseInt);
      addIfChanged("max_excursion_minutes", maxExcursionMinutes, parseInt);

      const { error } = await upsertAlertRules(scope, rules);
      
      if (error) throw error;

      // Log audit history
      if (userId && Object.keys(changes).length > 0) {
        await insertAlertRulesHistory(
          scope,
          existingRules?.id || null,
          existingRules ? "UPDATE" : "CREATE",
          changes,
          userId
        );
      }

      toast.success("Alert rules saved");
      onSave?.();
    } catch (error) {
      console.error("Error saving alert rules:", error);
      toast.error("Failed to save alert rules");
    }
    setIsSaving(false);
  };

  const handleClearField = async (field: RuleField) => {
    if (!existingRules) return;
    
    setClearingField(field);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const oldValue = existingRules[field];

      // Update the rule to set the field to null
      const { error } = await supabase
        .from("alert_rules")
        .update({ [field]: null })
        .eq("id", existingRules.id);

      if (error) throw error;

      // Log audit
      if (userId) {
        await insertAlertRulesHistory(
          scope,
          existingRules.id,
          "CLEAR_FIELD",
          { [field]: { from: oldValue, to: null } },
          userId
        );
      }

      // Clear local state
      const setterMap: Record<RuleField, (v: string) => void> = {
        manual_interval_minutes: setManualIntervalMinutes,
        manual_grace_minutes: setManualGraceMinutes,
        expected_reading_interval_seconds: setExpectedReadingIntervalSeconds,
        offline_trigger_multiplier: setOfflineTriggerMultiplier,
        offline_trigger_additional_minutes: setOfflineTriggerAdditionalMinutes,
        door_open_warning_minutes: setDoorOpenWarningMinutes,
        door_open_critical_minutes: setDoorOpenCriticalMinutes,
        excursion_confirm_minutes_door_closed: setExcursionConfirmMinutesDoorClosed,
        excursion_confirm_minutes_door_open: setExcursionConfirmMinutesDoorOpen,
        max_excursion_minutes: setMaxExcursionMinutes,
      };
      setterMap[field]("");

      toast.success("Field cleared - now inherits from parent");
      onSave?.();
    } catch (error) {
      console.error("Error clearing field:", error);
      toast.error("Failed to clear field");
    }
    setClearingField(null);
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
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const oldRules = { ...existingRules };
      const { error } = await deleteAlertRules(scope);
      if (error) throw error;

      // Log audit
      if (userId) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        const fields: RuleField[] = [
          "manual_interval_minutes",
          "manual_grace_minutes",
          "expected_reading_interval_seconds",
          "offline_trigger_multiplier",
          "offline_trigger_additional_minutes",
          "door_open_warning_minutes",
          "door_open_critical_minutes",
          "excursion_confirm_minutes_door_closed",
          "excursion_confirm_minutes_door_open",
          "max_excursion_minutes",
        ];
        fields.forEach((f) => {
          if (oldRules[f] !== null && oldRules[f] !== undefined) {
            changes[f] = { from: oldRules[f], to: null };
          }
        });
        if (Object.keys(changes).length > 0) {
          await insertAlertRulesHistory(scope, oldRules.id, "DELETE", changes, userId);
        }
      }
      
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
    field,
    value, 
    onChange, 
    parentValue, 
    defaultValue, 
    unit = "",
    step = "1",
    min = "0",
  }: { 
    label: string; 
    field: RuleField;
    value: string; 
    onChange: (v: string) => void; 
    parentValue?: number | null; 
    defaultValue: number;
    unit?: string;
    step?: string;
    min?: string;
  }) => {
    const effective = getEffectiveValue(value, parentValue, defaultValue);
    const canClear = !isOrgScope && value !== "" && existingRules;
    
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
            {effective.source === "local" ? "Override" : effective.source === "inherited" ? "Inherited" : "Default"}
          </Badge>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            step={step}
            min={min}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={effective.value.toString()}
            disabled={!canEdit}
            className="flex-1"
          />
          {unit && <span className="text-sm text-muted-foreground w-16">{unit}</span>}
          {canClear && canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => handleClearField(field)}
              disabled={clearingField === field}
              title="Clear override (inherit from parent)"
            >
              {clearingField === field ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </Button>
          )}
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
          Configure alert thresholds and timing. {!isOrgScope && "Leave blank to inherit from parent level."}
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
              field="manual_interval_minutes"
              value={manualIntervalMinutes}
              onChange={setManualIntervalMinutes}
              parentValue={parentRules?.manual_interval_minutes}
              defaultValue={DEFAULT_ALERT_RULES.manual_interval_minutes}
              unit="minutes"
            />
            <FieldWithSource
              label="Grace Period"
              field="manual_grace_minutes"
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
              field="expected_reading_interval_seconds"
              value={expectedReadingIntervalSeconds}
              onChange={setExpectedReadingIntervalSeconds}
              parentValue={parentRules?.expected_reading_interval_seconds}
              defaultValue={DEFAULT_ALERT_RULES.expected_reading_interval_seconds}
              unit="seconds"
            />
            <FieldWithSource
              label="Offline Multiplier"
              field="offline_trigger_multiplier"
              value={offlineTriggerMultiplier}
              onChange={setOfflineTriggerMultiplier}
              parentValue={parentRules?.offline_trigger_multiplier}
              defaultValue={DEFAULT_ALERT_RULES.offline_trigger_multiplier}
              unit="x"
              step="0.5"
            />
            <FieldWithSource
              label="Additional Buffer"
              field="offline_trigger_additional_minutes"
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
              field="door_open_warning_minutes"
              value={doorOpenWarningMinutes}
              onChange={setDoorOpenWarningMinutes}
              parentValue={parentRules?.door_open_warning_minutes}
              defaultValue={DEFAULT_ALERT_RULES.door_open_warning_minutes}
              unit="minutes"
            />
            <FieldWithSource
              label="Critical After"
              field="door_open_critical_minutes"
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
              field="excursion_confirm_minutes_door_closed"
              value={excursionConfirmMinutesDoorClosed}
              onChange={setExcursionConfirmMinutesDoorClosed}
              parentValue={parentRules?.excursion_confirm_minutes_door_closed}
              defaultValue={DEFAULT_ALERT_RULES.excursion_confirm_minutes_door_closed}
              unit="minutes"
            />
            <FieldWithSource
              label="Confirm (Door Open)"
              field="excursion_confirm_minutes_door_open"
              value={excursionConfirmMinutesDoorOpen}
              onChange={setExcursionConfirmMinutesDoorOpen}
              parentValue={parentRules?.excursion_confirm_minutes_door_open}
              defaultValue={DEFAULT_ALERT_RULES.excursion_confirm_minutes_door_open}
              unit="minutes"
            />
            <FieldWithSource
              label="Max Duration"
              field="max_excursion_minutes"
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
              {isOrgScope ? "Reset to Default" : "Remove All Overrides"}
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
