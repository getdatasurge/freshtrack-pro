import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import LogTempModal, { LogTempUnit } from "@/components/LogTempModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Thermometer,
  Loader2,
  CheckCircle2,
  Clock,
  Bell,
  BellOff,
  Battery,
  WifiOff,
  ArrowUpCircle,
  Check,
  ClipboardEdit,
  Mail,
  MailCheck,
  MailX,
  Link2,
  AlarmClockOff,
  History,
  FileText,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { UnitStatusInfo } from "@/hooks/useUnitStatus";
import { computeUnitAlerts } from "@/hooks/useUnitAlerts";

type DBAlertType = Database["public"]["Enums"]["alert_type"];
type DBAlertSeverity = Database["public"]["Enums"]["alert_severity"];
type DBAlertStatus = Database["public"]["Enums"]["alert_status"];

interface DBAlert {
  id: string;
  title: string;
  message: string | null;
  alert_type: DBAlertType;
  severity: DBAlertSeverity;
  status: DBAlertStatus;
  escalation_level: number;
  temp_reading: number | null;
  temp_limit: number | null;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledgment_notes: string | null;
  resolved_at: string | null;
  last_notified_at: string | null;
  last_notified_reason: string | null;
  correlated_with_alert_id: string | null;
  unit: {
    id: string;
    name: string;
    area: {
      name: string;
      site: { name: string };
    };
  };
}

// Unified alert type that works for both DB and computed alerts
interface UnifiedAlert {
  id: string;
  title: string;
  message: string | null;
  alertType: string;
  severity: "critical" | "warning" | "info";
  status: "active" | "acknowledged" | "resolved";
  unit_id: string;
  unit_name: string;
  site_name: string;
  area_name: string;
  temp_reading: number | null;
  temp_limit: number | null;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledgment_notes: string | null;
  isComputed: boolean;
  dbAlertId?: string;
  escalation_level?: number;
  last_notified_at?: string | null;
  last_notified_reason?: string | null;
  correlated_with_alert_id?: string | null;
}

import { ALERT_TYPE_CONFIG, SEVERITY_CONFIG, getAlertTypeConfig, getSeverityConfig } from "@/lib/alertConfig";
import { AlertTypeInfoCard, AlertInfoToggle } from "@/components/alerts/AlertTypeInfoCard";
import { SuppressionManager } from "@/components/alerts/SuppressionManager";
import { SnoozeAlertDialog } from "@/components/alerts/SnoozeAlertDialog";
import { AuditLogTimeline } from "@/components/alerts/AuditLogTimeline";
import { ComplianceReportDialog } from "@/components/alerts/ComplianceReportDialog";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";

const Alerts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<UnitStatusInfo[]>([]);
  const [unifiedAlerts, setUnifiedAlerts] = useState<UnifiedAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<UnifiedAlert | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showAcknowledgeDialog, setShowAcknowledgeDialog] = useState(false);
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  // Alert info card state — tracks which alert type's info panel is open
  const [openInfoAlertType, setOpenInfoAlertType] = useState<string | null>(null);

  // Snooze dialog state
  const [snoozeAlert, setSnoozeAlert] = useState<UnifiedAlert | null>(null);

  // Audit log + compliance report state
  const [timelineAlertId, setTimelineAlertId] = useState<string | null>(null);
  const [showComplianceReport, setShowComplianceReport] = useState(false);

  // Log temp modal state
  const [selectedUnit, setSelectedUnit] = useState<LogTempUnit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (isInitialized && effectiveOrgId && session?.user) {
      loadAlertsAndUnits();
    } else if (isInitialized) {
      setIsLoading(false);
    }
  }, [isInitialized, effectiveOrgId, session]);

  const loadAlertsAndUnits = useCallback(async () => {
    if (!session?.user || !effectiveOrgId) return;
    setIsLoading(true);
    try {
      // Load DB alerts - use effectiveOrgId for impersonation support
      const { data: alertsData, error: alertsError } = await supabase
        .from("alerts")
        .select(`
          id, title, message, alert_type, severity, status, escalation_level,
          temp_reading, temp_limit, triggered_at, acknowledged_at, acknowledged_by,
          acknowledgment_notes, resolved_at, last_notified_at, last_notified_reason,
          organization_id, site_id, area_id, source, correlated_with_alert_id,
          unit:units!inner(
            id, name,
            area:areas!inner(name, site:sites!inner(name))
          )
        `)
        .eq("organization_id", effectiveOrgId)
        .order("triggered_at", { ascending: false })
        .limit(100);

      if (alertsError) throw alertsError;

      const formattedDbAlerts: DBAlert[] = (alertsData || []).map((a: any) => ({
          ...a,
          unit: {
            id: a.unit.id,
            name: a.unit.name,
            area: {
              name: a.unit.area.name,
              site: { name: a.unit.area.site.name },
            },
          },
        }));

      // Load units for computed alerts (including sensor reliability fields)
      const { data: unitsData } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, temp_limit_high, temp_limit_low, manual_log_cadence,
          last_temp_reading, last_reading_at,
          sensor_reliable, manual_logging_enabled, consecutive_checkins,
          area:areas!inner(name, site:sites!inner(name, organization_id))
        `)
        .eq("is_active", true);

      const filteredUnits = (unitsData || []).filter(
        (u: any) => u.area?.site?.organization_id === effectiveOrgId
      );

      const unitIds = filteredUnits.map((u: any) => u.id);
      let manualLogs: any[] | null = null;
      if (unitIds.length > 0) {
        const { data } = await supabase
          .from("manual_temperature_logs")
          .select("unit_id, logged_at")
          .in("unit_id", unitIds)
          .order("logged_at", { ascending: false });
        manualLogs = data;
      }

      const latestLogByUnit: Record<string, string> = {};
      manualLogs?.forEach((log) => {
        if (!latestLogByUnit[log.unit_id]) {
          latestLogByUnit[log.unit_id] = log.logged_at;
        }
      });

      const formattedUnits: UnitStatusInfo[] = filteredUnits.map((u: any) => ({
        id: u.id,
        name: u.name,
        unit_type: u.unit_type,
        status: u.status,
        temp_limit_high: u.temp_limit_high,
        temp_limit_low: u.temp_limit_low,
        manual_log_cadence: u.manual_log_cadence,
        last_manual_log_at: latestLogByUnit[u.id] || null,
        last_reading_at: u.last_reading_at,
        last_temp_reading: u.last_temp_reading,
        sensor_reliable: u.sensor_reliable,
        manual_logging_enabled: u.manual_logging_enabled,
        consecutive_checkins: u.consecutive_checkins,
        area: { name: u.area.name, site: { name: u.area.site.name } },
      }));

      setUnits(formattedUnits);

      // Compute alerts from unit status
      const computedAlertsSummary = computeUnitAlerts(formattedUnits);

      // Merge DB alerts and computed alerts into unified format
      const unified: UnifiedAlert[] = [];
      const seenAlerts = new Set<string>();

      // Add computed alerts first (they represent current state)
      for (const computed of computedAlertsSummary.alerts) {
        const key = `${computed.unit_id}-${computed.type}`;
        seenAlerts.add(key);
        unified.push({
          id: computed.id,
          title: computed.title,
          message: computed.message,
          alertType: computed.type,
          severity: computed.severity,
          status: "active",
          unit_id: computed.unit_id,
          unit_name: computed.unit_name,
          site_name: computed.site_name,
          area_name: computed.area_name,
          temp_reading: null,
          temp_limit: null,
          triggered_at: computed.created_at,
          acknowledged_at: null,
          acknowledgment_notes: null,
          isComputed: true,
        });
      }

      // Add DB alerts that aren't covered by computed alerts
      for (const dbAlert of formattedDbAlerts) {
        const computedKey = `${dbAlert.unit.id}-${dbAlert.alert_type.toUpperCase()}`;
        if (seenAlerts.has(computedKey) && dbAlert.status === "active") continue;

        unified.push({
          id: dbAlert.id,
          title: dbAlert.title,
          message: dbAlert.message,
          alertType: dbAlert.alert_type,
          severity: dbAlert.severity,
          status: dbAlert.status === "escalated" ? "active" : dbAlert.status,
          unit_id: dbAlert.unit.id,
          unit_name: dbAlert.unit.name,
          site_name: dbAlert.unit.area.site.name,
          area_name: dbAlert.unit.area.name,
          temp_reading: dbAlert.temp_reading,
          temp_limit: dbAlert.temp_limit,
          triggered_at: dbAlert.triggered_at,
          acknowledged_at: dbAlert.acknowledged_at,
          acknowledgment_notes: dbAlert.acknowledgment_notes,
          isComputed: false,
          dbAlertId: dbAlert.id,
          escalation_level: dbAlert.escalation_level,
          last_notified_at: dbAlert.last_notified_at,
          last_notified_reason: dbAlert.last_notified_reason,
          correlated_with_alert_id: dbAlert.correlated_with_alert_id,
        });
      }

      // Sort by status (active first), then severity (critical first), then date
      unified.sort((a, b) => {
        if (a.status !== b.status) {
          const statusOrder = { active: 0, acknowledged: 1, resolved: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        if (a.severity !== b.severity) {
          const sevOrder = { critical: 0, warning: 1, info: 2 };
          return sevOrder[a.severity] - sevOrder[b.severity];
        }
        return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
      });

      setUnifiedAlerts(unified);
    } catch (error) {
      console.error("Error loading alerts:", error);
      toast({ title: "Failed to load alerts", variant: "destructive" });
    }
    setIsLoading(false);
  }, [session, navigate, toast]);

  const handleAcknowledge = async () => {
    if (!selectedAlert || !acknowledgmentNotes.trim()) {
      toast({ title: "Please provide acknowledgment notes", variant: "destructive" });
      return;
    }

    if (selectedAlert.isComputed) {
      toast({ title: "Computed alerts cannot be acknowledged - resolve the underlying issue", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: session!.user.id,
          acknowledgment_notes: acknowledgmentNotes.trim(),
        })
        .eq("id", selectedAlert.dbAlertId || selectedAlert.id);

      if (error) throw error;

      toast({ title: "Alert acknowledged" });
      setShowAcknowledgeDialog(false);
      setSelectedAlert(null);
      setAcknowledgmentNotes("");
      loadAlertsAndUnits();
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      toast({ title: "Failed to acknowledge", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const openAcknowledgeDialog = (alert: UnifiedAlert) => {
    setSelectedAlert(alert);
    setAcknowledgmentNotes("");
    setShowAcknowledgeDialog(true);
  };

  const handleResolve = async () => {
    if (!selectedAlert || !correctiveAction.trim()) {
      toast({ title: "Please describe the corrective action", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create corrective action record
      const { error: actionError } = await supabase
        .from("corrective_actions")
        .insert({
          alert_id: selectedAlert.isComputed ? null : (selectedAlert.dbAlertId || selectedAlert.id),
          unit_id: selectedAlert.unit_id,
          action_taken: correctiveAction,
          root_cause: rootCause || null,
          created_by: session!.user.id,
        });

      if (actionError) throw actionError;

      // Update alert status if it's a DB alert
      if (!selectedAlert.isComputed && selectedAlert.dbAlertId) {
        const { error: alertError } = await supabase
          .from("alerts")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolved_by: session!.user.id,
          })
          .eq("id", selectedAlert.dbAlertId);

        if (alertError) throw alertError;
      }

      toast({ title: "Alert resolved with corrective action" });
      setShowResolveDialog(false);
      setSelectedAlert(null);
      setCorrectiveAction("");
      setRootCause("");
      loadAlertsAndUnits();
    } catch (error) {
      console.error("Error resolving alert:", error);
      toast({ title: "Failed to resolve", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleLogTemp = (alert: UnifiedAlert) => {
    const unit = units.find(u => u.id === alert.unit_id);
    if (!unit) return;
    
    setSelectedUnit({
      id: unit.id,
      name: unit.name,
      unit_type: unit.unit_type,
      status: unit.status,
      temp_limit_high: unit.temp_limit_high,
      temp_limit_low: unit.temp_limit_low,
      manual_log_cadence: unit.manual_log_cadence,
      area: unit.area,
    });
    setModalOpen(true);
  };

  const handleLogSuccess = () => {
    loadAlertsAndUnits();
  };

  const getTimeAgo = (dateStr: string) => {
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const filteredAlerts = unifiedAlerts.filter((a) => {
    if (activeTab === "active") return a.status === "active";
    if (activeTab === "acknowledged") return a.status === "acknowledged";
    if (activeTab === "resolved") return a.status === "resolved";
    return true;
  });

  const activeCount = unifiedAlerts.filter((a) => a.status === "active").length;
  const acknowledgedCount = unifiedAlerts.filter((a) => a.status === "acknowledged").length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Alerts Center">
      {/* Page header actions */}
      <div className="flex justify-end gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/alert-analytics")}
        >
          <BarChart3 className="w-4 h-4 mr-1" />
          Analytics
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowComplianceReport(true)}
        >
          <FileText className="w-4 h-4 mr-1" />
          Generate Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="relative">
            Active
            {activeCount > 0 && (
              <Badge className="ml-2 bg-alarm text-alarm-foreground">{activeCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Acknowledged
            {acknowledgedCount > 0 && (
              <Badge variant="secondary" className="ml-2">{acknowledgedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => {
              const typeConfig = getAlertTypeConfig(alert.alertType);
              const severity = getSeverityConfig(alert.severity);
              const Icon = typeConfig?.icon || AlertTriangle;
              const showLogButton = alert.alertType === "MANUAL_REQUIRED" || alert.alertType === "missed_manual_entry";

              return (
                <Card
                  key={alert.id}
                  className={`${alert.status === "active" ? "border-alarm/30" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg ${severity.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${severity.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Title row */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{alert.title}</h3>
                              <AlertInfoToggle
                                isOpen={openInfoAlertType === alert.alertType}
                                onClick={() => setOpenInfoAlertType(
                                  openInfoAlertType === alert.alertType ? null : alert.alertType
                                )}
                              />
                              <Badge className={`${severity.bgColor} ${severity.color} border-0`}>
                                {alert.severity}
                              </Badge>
                              {alert.escalation_level && alert.escalation_level > 1 && (
                                <Badge variant="outline" className="text-warning border-warning">
                                  <ArrowUpCircle className="w-3 h-3 mr-1" />
                                  Level {alert.escalation_level}
                                </Badge>
                              )}
                              {alert.isComputed && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Live
                                </Badge>
                              )}
                              {alert.correlated_with_alert_id && (
                                <Badge variant="outline" className="text-accent border-accent/40">
                                  <Link2 className="w-3 h-3 mr-1" />
                                  Linked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {alert.site_name} · {alert.area_name} · {alert.unit_name}
                            </p>
                          </div>
                          
                          <div className="text-left sm:text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">{getTimeAgo(alert.triggered_at)}</p>
                            {alert.acknowledged_at && (
                              <p className="text-xs text-safe mt-1">
                                <Check className="w-3 h-3 inline mr-1" />
                                Ack'd {getTimeAgo(alert.acknowledged_at)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Inline alert type documentation */}
                        {openInfoAlertType === alert.alertType && (
                          <AlertTypeInfoCard
                            alertType={alert.alertType}
                            onClose={() => setOpenInfoAlertType(null)}
                          />
                        )}

                        {/* Message - fully wrapped, no truncation */}
                        {alert.message && (
                          <p className="text-sm text-muted-foreground break-words leading-relaxed" style={{ overflowWrap: "anywhere" }}>
                            {alert.message}
                          </p>
                        )}

                        {/* Temperature info */}
                        {alert.temp_reading !== null && (
                          <p className="text-sm">
                            <span className="text-alarm font-semibold">{alert.temp_reading}°F</span>
                            {alert.temp_limit && (
                              <span className="text-muted-foreground"> (limit: {alert.temp_limit}°F)</span>
                            )}
                          </p>
                        )}

                        {/* Email delivery status */}
                        {!alert.isComputed && (
                          <div className="flex items-center gap-1.5 text-xs">
                            {alert.last_notified_at ? (
                              <>
                                <MailCheck className="w-3.5 h-3.5 text-safe" />
                                <span className="text-safe">Email sent {getTimeAgo(alert.last_notified_at)}</span>
                              </>
                            ) : alert.last_notified_reason ? (
                              <>
                                <MailX className="w-3.5 h-3.5 text-warning" />
                                <span className="text-warning">Email: {alert.last_notified_reason}</span>
                              </>
                            ) : (
                              <>
                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Email pending</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Audit log timeline (inline, expandable) */}
                        {!alert.isComputed && timelineAlertId === alert.id && (
                          <div className="rounded-lg border p-3">
                            <AuditLogTimeline alertId={alert.id} />
                          </div>
                        )}

                        {/* Action Buttons */}
                        {alert.status === "active" && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {showLogButton && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-warning/50 text-warning hover:bg-warning/10"
                                onClick={() => handleLogTemp(alert)}
                              >
                                <ClipboardEdit className="w-4 h-4 mr-1" />
                                Log Temp
                              </Button>
                            )}
                            {!alert.isComputed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAcknowledgeDialog(alert)}
                                disabled={isSubmitting}
                              >
                                <Bell className="w-4 h-4 mr-1" />
                                Acknowledge
                              </Button>
                            )}
                            {!alert.isComputed && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-muted-foreground"
                                onClick={() => setSnoozeAlert(alert)}
                              >
                                <AlarmClockOff className="w-4 h-4 mr-1" />
                                Snooze
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="bg-safe hover:bg-safe/90 text-safe-foreground"
                              onClick={() => {
                                setSelectedAlert(alert);
                                setShowResolveDialog(true);
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Resolve
                            </Button>
                            {!alert.isComputed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={() => setTimelineAlertId(
                                  timelineAlertId === alert.id ? null : alert.id
                                )}
                              >
                                <History className="w-4 h-4 mr-1" />
                                Timeline
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Acknowledged state */}
                        {alert.status === "acknowledged" && (
                          <div className="space-y-2 pt-1">
                            {alert.acknowledgment_notes && (
                              <div className="p-2 rounded bg-muted/50 text-sm break-words" style={{ overflowWrap: "anywhere" }}>
                                <span className="text-muted-foreground">Notes: </span>
                                {alert.acknowledgment_notes}
                              </div>
                            )}
                            <Button
                              size="sm"
                              className="bg-safe hover:bg-safe/90 text-safe-foreground"
                              onClick={() => {
                                setSelectedAlert(alert);
                                setShowResolveDialog(true);
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Resolve with Action
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-safe/10 flex items-center justify-center mb-4">
                  {activeTab === "active" ? (
                    <CheckCircle2 className="w-7 h-7 text-safe" />
                  ) : activeTab === "acknowledged" ? (
                    <Bell className="w-7 h-7 text-muted-foreground" />
                  ) : (
                    <BellOff className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {activeTab === "active"
                    ? "All Clear!"
                    : activeTab === "acknowledged"
                    ? "No Acknowledged Alerts"
                    : "No Resolved Alerts"}
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {activeTab === "active"
                    ? "No active alerts at this time. All systems are operating normally."
                    : activeTab === "acknowledged"
                    ? "No alerts pending resolution."
                    : "Resolved alerts will appear here."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Alert Suppressions */}
      <SuppressionManager />

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-safe" />
              Resolve Alert
            </DialogTitle>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-foreground">{selectedAlert.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAlert.site_name} · {selectedAlert.unit_name}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">Corrective Action Taken *</Label>
                <Textarea
                  id="action"
                  placeholder="Describe what was done to resolve this issue..."
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cause">Root Cause (optional)</Label>
                <Textarea
                  id="cause"
                  placeholder="What caused this issue?"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowResolveDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-safe hover:bg-safe/90"
                  onClick={handleResolve}
                  disabled={isSubmitting || !correctiveAction.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Resolve Alert
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Acknowledge Dialog */}
      <Dialog open={showAcknowledgeDialog} onOpenChange={setShowAcknowledgeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent" />
              Acknowledge Alert
            </DialogTitle>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-foreground">{selectedAlert.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAlert.site_name} · {selectedAlert.unit_name}
                </p>
                {selectedAlert.temp_reading !== null && (
                  <p className="text-sm mt-1">
                    <span className="text-alarm font-semibold">{selectedAlert.temp_reading}°F</span>
                    {selectedAlert.temp_limit && (
                      <span className="text-muted-foreground"> (limit: {selectedAlert.temp_limit}°F)</span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ack-notes">Acknowledgment Notes *</Label>
                <Textarea
                  id="ack-notes"
                  placeholder="Describe your acknowledgment (e.g., 'Investigating now', 'Aware of issue, monitoring closely')..."
                  value={acknowledgmentNotes}
                  onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Notes are required and will be included in compliance reports.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAcknowledgeDialog(false);
                    setSelectedAlert(null);
                    setAcknowledgmentNotes("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAcknowledge}
                  disabled={isSubmitting || !acknowledgmentNotes.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Acknowledge
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compliance Report Dialog */}
      <ComplianceReportDialog
        open={showComplianceReport}
        onOpenChange={setShowComplianceReport}
      />

      {/* Snooze Alert Dialog */}
      {snoozeAlert && (
        <SnoozeAlertDialog
          open={!!snoozeAlert}
          onOpenChange={(open) => { if (!open) setSnoozeAlert(null); }}
          alert={{
            id: snoozeAlert.dbAlertId || snoozeAlert.id,
            alertType: snoozeAlert.alertType,
            unit_id: snoozeAlert.unit_id,
            title: snoozeAlert.title,
          }}
          organizationId={effectiveOrgId || ""}
        />
      )}

      {/* Log Temp Modal */}
      <LogTempModal
        unit={selectedUnit}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleLogSuccess}
        session={session}
      />
    </DashboardLayout>
  );
};

export default Alerts;
