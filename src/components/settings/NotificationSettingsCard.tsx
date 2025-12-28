import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  Loader2, 
  Mail, 
  Thermometer, 
  AlertTriangle, 
  Clock, 
  Wifi, 
  Battery,
  X
} from "lucide-react";

interface NotificationSettings {
  id?: string;
  email_enabled: boolean;
  recipients: string[];
  notify_temp_excursion: boolean;
  notify_alarm_active: boolean;
  notify_manual_required: boolean;
  notify_offline: boolean;
  notify_low_battery: boolean;
  notify_warnings: boolean;
}

interface NotificationSettingsCardProps {
  organizationId: string;
  canEdit: boolean;
}

const defaultSettings: NotificationSettings = {
  email_enabled: true,
  recipients: [],
  notify_temp_excursion: true,
  notify_alarm_active: true,
  notify_manual_required: true,
  notify_offline: false,
  notify_low_battery: false,
  notify_warnings: false,
};

export function NotificationSettingsCard({ organizationId, canEdit }: NotificationSettingsCardProps) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          email_enabled: data.email_enabled,
          recipients: data.recipients || [],
          notify_temp_excursion: data.notify_temp_excursion,
          notify_alarm_active: data.notify_alarm_active,
          notify_manual_required: data.notify_manual_required,
          notify_offline: data.notify_offline,
          notify_low_battery: data.notify_low_battery,
          notify_warnings: data.notify_warnings,
        });
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
      toast.error("Failed to load notification settings");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from("notification_settings")
          .update({
            email_enabled: settings.email_enabled,
            recipients: settings.recipients,
            notify_temp_excursion: settings.notify_temp_excursion,
            notify_alarm_active: settings.notify_alarm_active,
            notify_manual_required: settings.notify_manual_required,
            notify_offline: settings.notify_offline,
            notify_low_battery: settings.notify_low_battery,
            notify_warnings: settings.notify_warnings,
          })
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("notification_settings")
          .insert({
            organization_id: organizationId,
            email_enabled: settings.email_enabled,
            recipients: settings.recipients,
            notify_temp_excursion: settings.notify_temp_excursion,
            notify_alarm_active: settings.notify_alarm_active,
            notify_manual_required: settings.notify_manual_required,
            notify_offline: settings.notify_offline,
            notify_low_battery: settings.notify_low_battery,
            notify_warnings: settings.notify_warnings,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      toast.success("Notification settings saved");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast.error("Failed to save notification settings");
    } finally {
      setIsSaving(false);
    }
  };

  const addRecipient = () => {
    const email = newRecipient.trim().toLowerCase();
    if (!email) return;

    // Basic email validation
    if (!email.includes("@") || !email.includes(".")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (settings.recipients.includes(email)) {
      toast.error("This email is already in the list");
      return;
    }

    setSettings(prev => ({
      ...prev,
      recipients: [...prev.recipients, email],
    }));
    setNewRecipient("");
  };

  const removeRecipient = (email: string) => {
    setSettings(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email),
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRecipient();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Organization Email Notifications
        </CardTitle>
        <CardDescription>
          Configure email alerts for your entire organization. These settings apply to all sites and units.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Enable Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Send alert emails to configured recipients
              </p>
            </div>
          </div>
          <Switch 
            checked={settings.email_enabled} 
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email_enabled: checked }))}
            disabled={!canEdit}
          />
        </div>

        {/* Recipients */}
        <div className="space-y-3">
          <Label>Email Recipients</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!canEdit || !settings.email_enabled}
              className="flex-1"
            />
            <Button 
              variant="outline" 
              onClick={addRecipient}
              disabled={!canEdit || !settings.email_enabled || !newRecipient.trim()}
            >
              Add
            </Button>
          </div>
          {settings.recipients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {settings.recipients.map((email) => (
                <Badge key={email} variant="secondary" className="pl-2 pr-1 py-1">
                  {email}
                  {canEdit && (
                    <button 
                      onClick={() => removeRecipient(email)}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recipients configured. Emails will be sent to organization owners and admins.
            </p>
          )}
        </div>

        {/* Alert Type Toggles */}
        <div className="space-y-3">
          <Label>Alert Types to Notify</Label>
          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Thermometer className="w-4 h-4 text-critical" />
                <div>
                  <p className="text-sm font-medium">Temperature Excursion</p>
                  <p className="text-xs text-muted-foreground">When temperature goes out of range</p>
                </div>
              </div>
              <Switch 
                checked={settings.notify_temp_excursion} 
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notify_temp_excursion: checked }))}
                disabled={!canEdit || !settings.email_enabled}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-critical" />
                <div>
                  <p className="text-sm font-medium">Temperature Alarm</p>
                  <p className="text-xs text-muted-foreground">Confirmed temperature violations</p>
                </div>
              </div>
              <Switch 
                checked={settings.notify_alarm_active} 
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notify_alarm_active: checked }))}
                disabled={!canEdit || !settings.email_enabled}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-sm font-medium">Manual Logging Required</p>
                  <p className="text-xs text-muted-foreground">When a unit needs a manual temperature log</p>
                </div>
              </div>
              <Switch 
                checked={settings.notify_manual_required} 
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notify_manual_required: checked }))}
                disabled={!canEdit || !settings.email_enabled}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Wifi className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Sensor Offline</p>
                  <p className="text-xs text-muted-foreground">When a sensor stops sending data</p>
                </div>
              </div>
              <Switch 
                checked={settings.notify_offline} 
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notify_offline: checked }))}
                disabled={!canEdit || !settings.email_enabled}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Battery className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-sm font-medium">Low Battery</p>
                  <p className="text-xs text-muted-foreground">When sensor battery is running low</p>
                </div>
              </div>
              <Switch 
                checked={settings.notify_low_battery} 
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notify_low_battery: checked }))}
                disabled={!canEdit || !settings.email_enabled}
              />
            </div>
          </div>
        </div>

        {/* Warning Severity Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-medium">Send for Warning Severity</p>
              <p className="text-sm text-muted-foreground">
                Also send emails for warning-level alerts (not just critical)
              </p>
            </div>
          </div>
          <Switch 
            checked={settings.notify_warnings} 
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notify_warnings: checked }))}
            disabled={!canEdit || !settings.email_enabled}
          />
        </div>

        {/* Save Button */}
        {canEdit && (
          <div className="flex justify-end pt-4">
            <Button onClick={saveSettings} disabled={isSaving}>
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
    </Card>
  );
}
