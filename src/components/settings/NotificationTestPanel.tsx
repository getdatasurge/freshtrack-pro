import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgScope } from "@/hooks/useOrgScope";
import {
  useEffectiveNotificationPolicy,
  ALERT_TYPES,
  ALERT_TYPE_LABELS,
  type NotificationChannel,
  type AlertType,
} from "@/hooks/useNotificationPolicies";
import { getAlertTypeConfig } from "@/lib/alertConfig";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Monitor,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  MoonStar,
  ArrowRight,
  Building2,
  MapPin,
  Box,
} from "lucide-react";

// ─── Channel display config ────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<
  NotificationChannel,
  { label: string; shortLabel: string; icon: React.ReactNode }
> = {
  EMAIL: { label: "Email", shortLabel: "Email", icon: <Mail className="w-4 h-4" /> },
  SMS: { label: "SMS", shortLabel: "SMS", icon: <MessageSquare className="w-4 h-4" /> },
  IN_APP_CENTER: {
    label: "In-App Notification Center",
    shortLabel: "In-App",
    icon: <Smartphone className="w-4 h-4" />,
  },
  WEB_TOAST: {
    label: "Web Push Toast",
    shortLabel: "Web Toast",
    icon: <Monitor className="w-4 h-4" />,
  },
};

// Channels available for test sending
const TESTABLE_CHANNELS: NotificationChannel[] = ["EMAIL", "SMS", "IN_APP_CENTER", "WEB_TOAST"];

// ─── Types ──────────────────────────────────────────────────────────────────

interface UnitOption {
  id: string;
  name: string;
  site_name: string;
}

interface DeliveryResult {
  channel: NotificationChannel;
  status: "success" | "error" | "pending";
  message?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NotificationTestPanel() {
  const { orgId } = useOrgScope();

  // Selection state
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null);

  // Send test state
  const [selectedChannels, setSelectedChannels] = useState<Set<NotificationChannel>>(
    new Set(["EMAIL"])
  );
  const [isSending, setIsSending] = useState(false);
  const [deliveryResults, setDeliveryResults] = useState<DeliveryResult[]>([]);

  // ─── Fetch units for this org ───────────────────────────────────────────

  const { data: units, isLoading: unitsLoading } = useQuery({
    queryKey: ["units", "notification-test", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("units")
        .select(
          `id, name, area:areas!inner(name, site:sites!inner(name, organization_id))`
        )
        .eq("is_active", true);

      if (error) throw error;

      // Filter to current org (Super Admin may bypass RLS)
      const filtered = (data || [])
        .filter((u: any) => u.area?.site?.organization_id === orgId)
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          site_name: u.area?.site?.name ?? "Unknown Site",
        }))
        .sort((a: UnitOption, b: UnitOption) => a.name.localeCompare(b.name));

      return filtered as UnitOption[];
    },
    enabled: !!orgId,
  });

  // ─── Effective policy ───────────────────────────────────────────────────

  const {
    data: effectivePolicy,
    isLoading: policyLoading,
    isError: policyError,
  } = useEffectiveNotificationPolicy(selectedUnitId, selectedAlertType);

  const hasBothSelections = !!selectedUnitId && !!selectedAlertType;

  // ─── Policy source label ──────────────────────────────────────────────

  const policySource = useMemo(() => {
    if (!effectivePolicy) return null;
    if (effectivePolicy.source_unit)
      return { label: "Unit-level policy", icon: <Box className="w-3.5 h-3.5" /> };
    if (effectivePolicy.source_site)
      return { label: "Site-level policy", icon: <MapPin className="w-3.5 h-3.5" /> };
    if (effectivePolicy.source_org)
      return {
        label: "Organization-level policy",
        icon: <Building2 className="w-3.5 h-3.5" />,
      };
    return { label: "Default policy", icon: <ShieldAlert className="w-3.5 h-3.5" /> };
  }, [effectivePolicy]);

  // ─── Channel toggle ───────────────────────────────────────────────────

  const toggleTestChannel = (channel: NotificationChannel) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  // ─── Send test notification ───────────────────────────────────────────

  const handleSendTest = async () => {
    if (!selectedUnitId || !selectedAlertType || selectedChannels.size === 0) return;

    setIsSending(true);
    const channels = Array.from(selectedChannels);
    setDeliveryResults(
      channels.map((ch) => ({ channel: ch, status: "pending" as const }))
    );

    try {
      const { data, error } = await supabase.functions.invoke("test-notification", {
        body: {
          unit_id: selectedUnitId,
          alert_type: selectedAlertType,
          severity: "warning",
          channels,
        },
      });

      if (error) throw error;

      // Parse response — edge function returns { results: { channel, status, error? }[] }
      if (data?.results && Array.isArray(data.results)) {
        setDeliveryResults(
          data.results.map((r: any) => ({
            channel: r.channel as NotificationChannel,
            status: r.status === "sent" ? "success" as const : "error" as const,
            message: r.error || (r.status === "sent" ? "Delivered" : "Failed"),
          }))
        );

        // Show web toast for WEB_TOAST channel if sent
        const webToast = data.results.find((r: any) => r.channel === "WEB_TOAST" && r.status === "sent");
        if (webToast) {
          toast.info(`[TEST] Alert notification for ${selectedAlertType}`, {
            description: "This is a test web toast notification.",
          });
        }
      } else {
        setDeliveryResults(
          channels.map((ch) => ({
            channel: ch,
            status: "success" as const,
            message: "Delivered",
          }))
        );
      }

      toast.success("Test notification sent");
    } catch (err: any) {
      console.error("Test notification error:", err);
      setDeliveryResults(
        channels.map((ch) => ({
          channel: ch,
          status: "error" as const,
          message: err?.message || "Failed to send",
        }))
      );
      toast.error("Failed to send test notification");
    } finally {
      setIsSending(false);
    }
  };

  // ─── Compute cumulative timeline for escalation display ───────────────

  const escalationTimeline = useMemo(() => {
    if (!effectivePolicy?.escalation_steps?.length) return [];
    let cumulativeMinutes = 0;
    return effectivePolicy.escalation_steps.map((step, idx) => {
      cumulativeMinutes += step.delay_minutes;
      return {
        stepNumber: idx + 1,
        cumulativeMinutes,
        delayMinutes: step.delay_minutes,
        channels: step.channels,
        repeat: step.repeat,
      };
    });
  }, [effectivePolicy]);

  // ─── Alert type config for selected type ──────────────────────────────

  const alertConfig = selectedAlertType ? getAlertTypeConfig(selectedAlertType) : null;

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notification Testing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Section 1: "Who Gets Notified?" Preview ─────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Who Gets Notified?
          </h3>

          {/* Unit selector */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-unit-select">Unit</Label>
              <Select
                value={selectedUnitId ?? ""}
                onValueChange={(val) => {
                  setSelectedUnitId(val || null);
                  setDeliveryResults([]);
                }}
              >
                <SelectTrigger id="test-unit-select">
                  <SelectValue placeholder={unitsLoading ? "Loading units..." : "Select a unit"} />
                </SelectTrigger>
                <SelectContent>
                  {(units || []).map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                      <span className="ml-1 text-muted-foreground">
                        ({unit.site_name})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alert type selector */}
            <div className="space-y-2">
              <Label htmlFor="test-alert-type-select">Alert Type</Label>
              <Select
                value={selectedAlertType ?? ""}
                onValueChange={(val) => {
                  setSelectedAlertType(val || null);
                  setDeliveryResults([]);
                }}
              >
                <SelectTrigger id="test-alert-type-select">
                  <SelectValue placeholder="Select alert type" />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ALERT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Policy preview */}
          {hasBothSelections && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              {policyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading effective policy...
                </div>
              ) : policyError ? (
                <p className="text-sm text-destructive">
                  Failed to load the effective policy for this unit/alert combination.
                </p>
              ) : effectivePolicy ? (
                <>
                  {/* Policy source */}
                  {policySource && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1.5">
                        {policySource.icon}
                        {policySource.label}
                      </Badge>
                      {alertConfig && (
                        <Badge variant="secondary" className="flex items-center gap-1.5">
                          <alertConfig.icon className="w-3.5 h-3.5" />
                          {alertConfig.label}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Initial channels */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Initial channels
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {effectivePolicy.initial_channels.length > 0 ? (
                        effectivePolicy.initial_channels.map((ch) => (
                          <Badge
                            key={ch}
                            variant="secondary"
                            className="flex items-center gap-1.5"
                          >
                            {CHANNEL_CONFIG[ch]?.icon}
                            {CHANNEL_CONFIG[ch]?.shortLabel ?? ch}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No channels configured
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Severity threshold */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Severity threshold
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        effectivePolicy.severity_threshold === "CRITICAL"
                          ? "border-red-400 text-red-600"
                          : effectivePolicy.severity_threshold === "WARNING"
                          ? "border-yellow-400 text-yellow-600"
                          : "border-blue-400 text-blue-600"
                      }
                    >
                      {effectivePolicy.severity_threshold}
                    </Badge>
                  </div>

                  {/* Quiet hours */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Quiet hours
                    </p>
                    {effectivePolicy.quiet_hours_enabled ? (
                      <div className="flex items-center gap-2 text-sm">
                        <MoonStar className="w-4 h-4 text-indigo-500" />
                        <span>
                          Active: {effectivePolicy.quiet_hours_start_local ?? "--:--"}
                          {" "}&ndash;{" "}
                          {effectivePolicy.quiet_hours_end_local ?? "--:--"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Disabled</span>
                    )}
                  </div>

                  {/* Acknowledgement */}
                  {effectivePolicy.requires_ack && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Acknowledgement required
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <ShieldAlert className="w-4 h-4 text-orange-500" />
                        <span>
                          {effectivePolicy.ack_deadline_minutes
                            ? `Within ${effectivePolicy.ack_deadline_minutes} min`
                            : "No deadline"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Escalation timeline */}
                  {escalationTimeline.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Escalation timeline
                      </p>
                      <div className="space-y-2">
                        {/* Initial delivery marker */}
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            0
                          </div>
                          <span className="font-medium">t=0 min</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Initial delivery</span>
                        </div>

                        {escalationTimeline.map((step) => (
                          <div
                            key={step.stepNumber}
                            className="flex items-center gap-2 text-sm"
                          >
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                              {step.stepNumber}
                            </div>
                            <span className="font-medium">
                              t={step.cumulativeMinutes} min
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Escalate via{" "}
                              {step.channels.join(", ")}
                              {step.repeat && " (repeats)"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No policy found for this combination. Default behaviour will apply.
                </p>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* ── Section 2: Send Test Notification ───────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Send Test Notification
            </h3>
            <Badge variant="outline" className="text-xs">
              <ShieldAlert className="w-3 h-3 mr-1" />
              Admin Only
            </Badge>
          </div>

          {/* Channel checkboxes */}
          <div className="space-y-2">
            <Label>Channels to test</Label>
            <div className="grid grid-cols-2 gap-3">
              {TESTABLE_CHANNELS.map((channel) => (
                <div
                  key={channel}
                  className="flex items-center space-x-2 p-2 rounded-md border bg-background"
                >
                  <Checkbox
                    id={`test-channel-${channel}`}
                    checked={selectedChannels.has(channel)}
                    onCheckedChange={() => toggleTestChannel(channel)}
                    disabled={isSending}
                  />
                  <label
                    htmlFor={`test-channel-${channel}`}
                    className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                  >
                    {CHANNEL_CONFIG[channel].icon}
                    {CHANNEL_CONFIG[channel].label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Send button */}
          <Button
            onClick={handleSendTest}
            disabled={
              isSending ||
              !selectedUnitId ||
              !selectedAlertType ||
              selectedChannels.size === 0
            }
            className="w-full sm:w-auto"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isSending ? "Sending..." : "Send Test"}
          </Button>

          {/* Delivery results */}
          {deliveryResults.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Delivery status</p>
              {deliveryResults.map((result) => (
                <div
                  key={result.channel}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2 text-sm">
                    {CHANNEL_CONFIG[result.channel]?.icon}
                    {CHANNEL_CONFIG[result.channel]?.label ?? result.channel}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {result.status === "pending" && (
                      <>
                        <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />
                        <span className="text-xs text-muted-foreground">Pending</span>
                      </>
                    )}
                    {result.status === "success" && (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-600">
                          {result.message || "Sent"}
                        </span>
                      </>
                    )}
                    {result.status === "error" && (
                      <>
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-xs text-destructive">
                          {result.message || "Failed"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
