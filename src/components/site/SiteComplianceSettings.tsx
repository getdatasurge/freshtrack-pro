import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Settings, ChevronDown, ChevronUp, Loader2, Save, Shield, Clock, Globe } from "lucide-react";
import { usePermissions } from "@/hooks/useUserRole";

interface SiteComplianceSettingsProps {
  siteId: string;
  siteName: string;
  timezone: string;
  complianceMode: string;
  manualLogCadenceSeconds: number;
  correctiveActionRequired: boolean;
  onSettingsUpdated: () => void;
}

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const cadenceOptions = [
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 7200, label: "2 hours" },
  { value: 14400, label: "4 hours" },
  { value: 21600, label: "6 hours" },
  { value: 28800, label: "8 hours" },
  { value: 43200, label: "12 hours" },
];

export function SiteComplianceSettings({
  siteId,
  siteName,
  timezone,
  complianceMode,
  manualLogCadenceSeconds,
  correctiveActionRequired,
  onSettingsUpdated,
}: SiteComplianceSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { canEditComplianceSettings, isLoading: permLoading } = usePermissions();

  const [localTimezone, setLocalTimezone] = useState(timezone);
  const [localComplianceMode, setLocalComplianceMode] = useState(complianceMode || "fda_food_code");
  const [localCadence, setLocalCadence] = useState(manualLogCadenceSeconds || 14400);
  const [localCorrectiveAction, setLocalCorrectiveAction] = useState(correctiveActionRequired);

  useEffect(() => {
    setLocalTimezone(timezone);
    setLocalComplianceMode(complianceMode || "fda_food_code");
    setLocalCadence(manualLogCadenceSeconds || 14400);
    setLocalCorrectiveAction(correctiveActionRequired);
  }, [timezone, complianceMode, manualLogCadenceSeconds, correctiveActionRequired]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("sites")
        .update({
          timezone: localTimezone,
          compliance_mode: localComplianceMode,
          manual_log_cadence_seconds: localCadence,
          corrective_action_required: localCorrectiveAction,
        })
        .eq("id", siteId);

      if (error) throw error;

      // Log the change
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.organization_id) {
          await supabase.from("event_logs").insert({
            organization_id: profile.organization_id,
            site_id: siteId,
            event_type: "site_compliance_settings_updated",
            actor_id: user.id,
            actor_type: "user",
            event_data: {
              site_name: siteName,
              changes: {
                timezone: { from: timezone, to: localTimezone },
                compliance_mode: { from: complianceMode, to: localComplianceMode },
                manual_log_cadence_seconds: { from: manualLogCadenceSeconds, to: localCadence },
                corrective_action_required: { from: correctiveActionRequired, to: localCorrectiveAction },
              },
            },
          });
        }
      }

      toast.success("Compliance settings updated");
      onSettingsUpdated();
    } catch (error) {
      console.error("Error saving compliance settings:", error);
      toast.error("Failed to save settings");
    }
    setIsSaving(false);
  };

  const formatCadence = (seconds: number) => {
    const option = cadenceOptions.find(o => o.value === seconds);
    return option?.label || `${seconds / 3600} hours`;
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Shield className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-base">Compliance Settings</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {localComplianceMode === "fda_food_code" ? "FDA Food Code" : "Custom"} · 
                    {" "}{formatCadence(localCadence)} logging · 
                    {" "}{timezones.find(t => t.value === localTimezone)?.label || localTimezone}
                  </CardDescription>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Compliance Mode */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  Compliance Mode
                </Label>
                <Select
                  value={localComplianceMode}
                  onValueChange={setLocalComplianceMode}
                  disabled={!canEditComplianceSettings}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fda_food_code">FDA Food Code</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  FDA Food Code follows 21 CFR guidelines
                </p>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  Site Timezone
                </Label>
                <Select
                  value={localTimezone}
                  onValueChange={setLocalTimezone}
                  disabled={!canEditComplianceSettings}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for compliance calculations and reports
                </p>
              </div>

              {/* Manual Log Cadence */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Manual Logging Cadence
                </Label>
                <Select
                  value={localCadence.toString()}
                  onValueChange={(v) => setLocalCadence(parseInt(v))}
                  disabled={!canEditComplianceSettings}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cadenceOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often manual temperature logs are required
                </p>
              </div>

              {/* Corrective Action Toggle */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Corrective Action Required
                </Label>
                <div className="flex items-center gap-3 py-2">
                  <Switch
                    checked={localCorrectiveAction}
                    onCheckedChange={setLocalCorrectiveAction}
                    disabled={!canEditComplianceSettings}
                  />
                  <span className="text-sm text-muted-foreground">
                    {localCorrectiveAction ? "Required" : "Optional"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Require corrective actions for out-of-range readings
                </p>
              </div>
            </div>

            {canEditComplianceSettings && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
