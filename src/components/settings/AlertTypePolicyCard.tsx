import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  ChevronDown, 
  X,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NotificationPolicy,
  NotificationChannel,
  EscalationStep,
  AppRole,
  DEFAULT_NOTIFICATION_POLICY,
  upsertNotificationPolicy,
  deleteNotificationPolicy,
  AlertType,
} from "@/hooks/useNotificationPolicies";
import { useEscalationContacts } from "@/hooks/useEscalationContacts";

const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owners",
  admin: "Admins",
  manager: "Managers",
  staff: "Staff",
  viewer: "Viewers",
};

interface AlertTypePolicyCardProps {
  alertType: AlertType;
  alertTypeLabel: string;
  scope: { organization_id?: string; site_id?: string; unit_id?: string };
  existingPolicy?: NotificationPolicy;
  parentPolicy?: NotificationPolicy;
  canEdit: boolean;
  onSave?: () => void;
}

const CHANNEL_LABELS: Record<NotificationChannel, { label: string; icon: React.ReactNode }> = {
  WEB_TOAST: { label: "Web Push Toast", icon: <Bell className="w-4 h-4" /> },
  IN_APP_CENTER: { label: "In-App Notification Center", icon: <Smartphone className="w-4 h-4" /> },
  EMAIL: { label: "Email", icon: <Mail className="w-4 h-4" /> },
  SMS: { label: "SMS", icon: <MessageSquare className="w-4 h-4" /> },
};

export function AlertTypePolicyCard({
  alertType,
  alertTypeLabel,
  scope,
  existingPolicy,
  parentPolicy,
  canEdit,
  onSave,
}: AlertTypePolicyCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isOrgScope = !!scope.organization_id && !scope.site_id && !scope.unit_id;

  // Form state
  const [initialChannels, setInitialChannels] = useState<NotificationChannel[]>([]);
  const [requiresAck, setRequiresAck] = useState(false);
  const [ackDeadlineMinutes, setAckDeadlineMinutes] = useState<string>("");
  const [escalationSteps, setEscalationSteps] = useState<EscalationStep[]>([]);
  const [sendResolvedNotifications, setSendResolvedNotifications] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderIntervalMinutes, setReminderIntervalMinutes] = useState<string>("");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState<string>("");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("");
  const [allowWarningNotifications, setAllowWarningNotifications] = useState(false);
  // Recipient state
  const [notifyRoles, setNotifyRoles] = useState<AppRole[]>(["owner", "admin"]);
  const [notifySiteManagers, setNotifySiteManagers] = useState(true);
  const [notifyAssignedUsers, setNotifyAssignedUsers] = useState(false);

  // Fetch escalation contacts for contact priority dropdown
  const { data: escalationContacts } = useEscalationContacts();

  // Helper to ensure escalation_steps is always an array
  const parseEscalationSteps = (steps: unknown): EscalationStep[] => {
    if (Array.isArray(steps)) return steps;
    if (typeof steps === 'string') {
      try {
        const parsed = JSON.parse(steps);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Initialize from existing policy
  useEffect(() => {
    if (existingPolicy) {
      setInitialChannels(Array.isArray(existingPolicy.initial_channels) ? existingPolicy.initial_channels : []);
      setRequiresAck(existingPolicy.requires_ack);
      setAckDeadlineMinutes(existingPolicy.ack_deadline_minutes?.toString() || "");
      setEscalationSteps(parseEscalationSteps(existingPolicy.escalation_steps));
      setSendResolvedNotifications(existingPolicy.send_resolved_notifications);
      setRemindersEnabled(existingPolicy.reminders_enabled);
      setReminderIntervalMinutes(existingPolicy.reminder_interval_minutes?.toString() || "");
      setQuietHoursEnabled(existingPolicy.quiet_hours_enabled);
      setQuietHoursStart(existingPolicy.quiet_hours_start_local || "");
      setQuietHoursEnd(existingPolicy.quiet_hours_end_local || "");
      setAllowWarningNotifications(existingPolicy.allow_warning_notifications);
      setNotifyRoles(Array.isArray(existingPolicy.notify_roles) ? existingPolicy.notify_roles : ["owner", "admin"]);
      setNotifySiteManagers(existingPolicy.notify_site_managers ?? true);
      setNotifyAssignedUsers(existingPolicy.notify_assigned_users ?? false);
    } else {
      // Clear form
      setInitialChannels([]);
      setRequiresAck(false);
      setAckDeadlineMinutes("");
      setEscalationSteps([]);
      setSendResolvedNotifications(false);
      setRemindersEnabled(false);
      setReminderIntervalMinutes("");
      setQuietHoursEnabled(false);
      setQuietHoursStart("");
      setQuietHoursEnd("");
      setAllowWarningNotifications(false);
      setNotifyRoles(["owner", "admin"]);
      setNotifySiteManagers(true);
      setNotifyAssignedUsers(false);
    }
  }, [existingPolicy]);

  const getEffectiveValue = <T,>(
    localValue: T | undefined | null,
    parentValue: T | undefined | null,
    defaultValue: T
  ): { value: T; source: "local" | "inherited" | "default" } => {
    if (localValue !== undefined && localValue !== null && (Array.isArray(localValue) ? localValue.length > 0 : true)) {
      return { value: localValue, source: "local" };
    }
    if (parentValue !== undefined && parentValue !== null) {
      return { value: parentValue, source: "inherited" };
    }
    return { value: defaultValue, source: "default" };
  };

  const toggleChannel = (channel: NotificationChannel) => {
    setInitialChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const toggleRole = (role: AppRole) => {
    setNotifyRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  };

  const addEscalationStep = () => {
    setEscalationSteps((prev) => [
      ...prev,
      { delay_minutes: 10, channels: ["EMAIL"], contact_priority: 1, repeat: false },
    ]);
  };

  const updateEscalationStep = (index: number, updates: Partial<EscalationStep>) => {
    setEscalationSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    );
  };

  const removeEscalationStep = (index: number) => {
    setEscalationSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleEscalationChannel = (index: number, channel: "EMAIL" | "SMS") => {
    setEscalationSteps((prev) =>
      prev.map((step, i) => {
        if (i !== index) return step;
        const channels = step.channels.includes(channel)
          ? step.channels.filter((c) => c !== channel)
          : [...step.channels, channel];
        return { ...step, channels };
      })
    );
  };

  const hasChanges = () => {
    // Check if there are any local values set
    return (
      initialChannels.length > 0 ||
      requiresAck ||
      ackDeadlineMinutes !== "" ||
      escalationSteps.length > 0 ||
      sendResolvedNotifications ||
      remindersEnabled ||
      reminderIntervalMinutes !== "" ||
      quietHoursEnabled ||
      quietHoursStart !== "" ||
      quietHoursEnd !== "" ||
      allowWarningNotifications
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const policy: Partial<NotificationPolicy> = {
        initial_channels: initialChannels.length > 0 ? initialChannels : DEFAULT_NOTIFICATION_POLICY.initial_channels,
        requires_ack: requiresAck,
        ack_deadline_minutes: ackDeadlineMinutes ? parseInt(ackDeadlineMinutes) : null,
        escalation_steps: escalationSteps,
        send_resolved_notifications: sendResolvedNotifications,
        reminders_enabled: remindersEnabled,
        reminder_interval_minutes: reminderIntervalMinutes ? parseInt(reminderIntervalMinutes) : null,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start_local: quietHoursStart || null,
        quiet_hours_end_local: quietHoursEnd || null,
        severity_threshold: "WARNING",
        allow_warning_notifications: allowWarningNotifications,
        notify_roles: notifyRoles,
        notify_site_managers: notifySiteManagers,
        notify_assigned_users: notifyAssignedUsers,
      };

      const { error } = await upsertNotificationPolicy(scope, alertType, policy);
      if (error) throw error;

      toast.success(`Notification policy saved for ${alertTypeLabel}`);
      onSave?.();
    } catch (error) {
      console.error("Error saving notification policy:", error);
      toast.error("Failed to save notification policy");
    }
    setIsSaving(false);
  };

  const handleClearOverride = async () => {
    if (!existingPolicy) return;
    setIsDeleting(true);
    try {
      const { error } = await deleteNotificationPolicy(scope, alertType);
      if (error) throw error;

      // Clear form
      setInitialChannels([]);
      setRequiresAck(false);
      setAckDeadlineMinutes("");
      setEscalationSteps([]);
      setSendResolvedNotifications(false);
      setRemindersEnabled(false);
      setReminderIntervalMinutes("");
      setQuietHoursEnabled(false);
      setQuietHoursStart("");
      setQuietHoursEnd("");
      setAllowWarningNotifications(false);
      setNotifyRoles(["owner", "admin"]);
      setNotifySiteManagers(true);
      setNotifyAssignedUsers(false);

      toast.success("Override cleared - now inherits from parent");
      onSave?.();
    } catch (error) {
      console.error("Error clearing override:", error);
      toast.error("Failed to clear override");
    }
    setIsDeleting(false);
  };

  // Get effective values for display
  const effectiveChannels = getEffectiveValue(
    initialChannels.length > 0 ? initialChannels : undefined,
    parentPolicy?.initial_channels,
    DEFAULT_NOTIFICATION_POLICY.initial_channels
  );

  return (
    <div className="space-y-6">
      {/* Initial Delivery Channels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Initial Delivery Channels</Label>
          {!isOrgScope && (
            <Badge
              variant="outline"
              className={
                initialChannels.length > 0
                  ? "bg-primary/10 text-primary border-primary/30"
                  : effectiveChannels.source === "inherited"
                  ? "bg-accent/10 text-accent border-accent/30"
                  : "bg-muted text-muted-foreground"
              }
            >
              {initialChannels.length > 0
                ? "Override"
                : effectiveChannels.source === "inherited"
                ? "Inherited"
                : "Default"}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((channel) => (
            <div
              key={channel}
              className="flex items-center space-x-2 p-2 rounded-md border bg-background"
            >
              <Checkbox
                id={`${alertType}-${channel}`}
                checked={initialChannels.includes(channel)}
                onCheckedChange={() => toggleChannel(channel)}
                disabled={!canEdit}
              />
              <label
                htmlFor={`${alertType}-${channel}`}
                className="flex items-center gap-2 text-sm cursor-pointer flex-1"
              >
                {CHANNEL_LABELS[channel].icon}
                {CHANNEL_LABELS[channel].label}
              </label>
            </div>
          ))}
        </div>
        {initialChannels.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Effective: {effectiveChannels.value.join(", ") || "None"}
          </p>
        )}
      </div>

      <Separator />

      {/* Recipients */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Initial Notification Recipients</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Select which roles receive the initial notification. Users can manage their preferences in their profile.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["owner", "admin", "manager", "staff"] as AppRole[]).map((role) => (
            <div
              key={role}
              className="flex items-center space-x-2 p-2 rounded-md border bg-background"
            >
              <Checkbox
                id={`${alertType}-role-${role}`}
                checked={notifyRoles.includes(role)}
                onCheckedChange={() => toggleRole(role)}
                disabled={!canEdit}
              />
              <label
                htmlFor={`${alertType}-role-${role}`}
                className="text-sm cursor-pointer flex-1"
              >
                {ROLE_LABELS[role]}
              </label>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`${alertType}-site-managers`}
              checked={notifySiteManagers}
              onCheckedChange={(checked) => setNotifySiteManagers(!!checked)}
              disabled={!canEdit}
            />
            <label
              htmlFor={`${alertType}-site-managers`}
              className="text-sm cursor-pointer"
            >
              Include Site Managers
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`${alertType}-assigned-users`}
              checked={notifyAssignedUsers}
              onCheckedChange={(checked) => setNotifyAssignedUsers(!!checked)}
              disabled={!canEdit}
            />
            <label
              htmlFor={`${alertType}-assigned-users`}
              className="text-sm cursor-pointer"
            >
              Include Users Assigned to Unit
            </label>
          </div>
        </div>
      </div>

      <Separator />

      {/* Acknowledgement */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Requires Acknowledgement</Label>
            <p className="text-xs text-muted-foreground">
              User must acknowledge this alert before it stops escalating
            </p>
          </div>
          <Switch
            checked={requiresAck}
            onCheckedChange={setRequiresAck}
            disabled={!canEdit}
          />
        </div>

        {requiresAck && (
          <div className="ml-4 space-y-2">
            <Label className="text-sm">Acknowledgement Deadline (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                value={ackDeadlineMinutes}
                onChange={(e) => setAckDeadlineMinutes(e.target.value)}
                placeholder="No deadline"
                className="w-32"
                disabled={!canEdit}
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Escalation Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Escalation Steps</Label>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={addEscalationStep}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Step
            </Button>
          )}
        </div>

        {escalationSteps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No escalation steps configured. Notifications will only use initial channels.
          </p>
        ) : (
          <div className="space-y-3">
            {escalationSteps.map((step, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 p-3 rounded-md border bg-muted/30"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    After
                  </span>
                  <Input
                    type="number"
                    min="1"
                    value={step.delay_minutes}
                    onChange={(e) =>
                      updateEscalationStep(index, {
                        delay_minutes: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-20 h-8"
                    disabled={!canEdit}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    min, notify:
                  </span>
                  <Select
                    value={step.contact_priority?.toString() || "1"}
                    onValueChange={(val) => updateEscalationStep(index, { contact_priority: parseInt(val) })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Contact level" />
                    </SelectTrigger>
                    <SelectContent>
                      {escalationContacts && escalationContacts.length > 0 ? (
                        [...new Set(escalationContacts.map(c => c.priority))].sort().map((priority) => {
                          const contactsAtLevel = escalationContacts.filter(c => c.priority === priority);
                          return (
                            <SelectItem key={priority} value={priority.toString()}>
                              Level {priority} ({contactsAtLevel.map(c => c.name).join(", ")})
                            </SelectItem>
                          );
                        })
                      ) : (
                        <>
                          <SelectItem value="1">Level 1 (Primary)</SelectItem>
                          <SelectItem value="2">Level 2 (Secondary)</SelectItem>
                          <SelectItem value="3">Level 3 (Owner)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                      onClick={() => removeEscalationStep(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-sm text-muted-foreground">via:</span>
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id={`${alertType}-esc-${index}-email`}
                      checked={step.channels.includes("EMAIL")}
                      onCheckedChange={() => toggleEscalationChannel(index, "EMAIL")}
                      disabled={!canEdit}
                    />
                    <label
                      htmlFor={`${alertType}-esc-${index}-email`}
                      className="text-sm cursor-pointer"
                    >
                      Email
                    </label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id={`${alertType}-esc-${index}-sms`}
                      checked={step.channels.includes("SMS")}
                      onCheckedChange={() => toggleEscalationChannel(index, "SMS")}
                      disabled={!canEdit}
                    />
                    <label
                      htmlFor={`${alertType}-esc-${index}-sms`}
                      className="text-sm cursor-pointer"
                    >
                      SMS
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Advanced Options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-9 px-2"
          >
            <span className="text-sm font-medium">Advanced Options</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {/* Reminders */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Repeat notifications at intervals while alert is active
              </p>
            </div>
            <Switch
              checked={remindersEnabled}
              onCheckedChange={setRemindersEnabled}
              disabled={!canEdit}
            />
          </div>
          {remindersEnabled && (
            <div className="ml-4 flex items-center gap-2">
              <Label className="text-sm">Interval:</Label>
              <Input
                type="number"
                min="5"
                value={reminderIntervalMinutes}
                onChange={(e) => setReminderIntervalMinutes(e.target.value)}
                placeholder="30"
                className="w-20 h-8"
                disabled={!canEdit}
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          )}

          <Separator />

          {/* Resolved Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Send Resolved Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Notify when the alert condition clears
              </p>
            </div>
            <Switch
              checked={sendResolvedNotifications}
              onCheckedChange={setSendResolvedNotifications}
              disabled={!canEdit}
            />
          </div>

          <Separator />

          {/* Quiet Hours */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Quiet Hours</Label>
                <p className="text-xs text-muted-foreground">
                  Suppress non-critical notifications during specified hours
                </p>
              </div>
              <Switch
                checked={quietHoursEnabled}
                onCheckedChange={setQuietHoursEnabled}
                disabled={!canEdit}
              />
            </div>
            {quietHoursEnabled && (
              <div className="ml-4 flex items-center gap-2 flex-wrap">
                <Label className="text-sm">From:</Label>
                <Input
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="w-28 h-8"
                  disabled={!canEdit}
                />
                <Label className="text-sm">To:</Label>
                <Input
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="w-28 h-8"
                  disabled={!canEdit}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Warning Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Allow Warning Notifications</Label>
              <p className="text-xs text-muted-foreground">
                By default, only critical alerts send notifications
              </p>
            </div>
            <Switch
              checked={allowWarningNotifications}
              onCheckedChange={setAllowWarningNotifications}
              disabled={!canEdit}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          {!isOrgScope && existingPolicy && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearOverride}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Clear Override
            </Button>
          )}
          <div className="ml-auto">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Policy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
