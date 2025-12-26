import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
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
  Wifi,
  WifiOff,
  ArrowUpCircle,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AlertType = Database["public"]["Enums"]["alert_type"];
type AlertSeverity = Database["public"]["Enums"]["alert_severity"];
type AlertStatus = Database["public"]["Enums"]["alert_status"];

interface Alert {
  id: string;
  title: string;
  message: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  escalation_level: number;
  temp_reading: number | null;
  temp_limit: number | null;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  unit: {
    id: string;
    name: string;
    area: {
      name: string;
      site: { name: string };
    };
  };
}

const alertTypeConfig: Record<AlertType, { icon: typeof AlertTriangle; label: string }> = {
  alarm_active: { icon: Thermometer, label: "Temperature Alarm" },
  monitoring_interrupted: { icon: WifiOff, label: "Monitoring Interrupted" },
  missed_manual_entry: { icon: Clock, label: "Missed Manual Entry" },
  low_battery: { icon: Battery, label: "Low Battery" },
  sensor_fault: { icon: AlertTriangle, label: "Sensor Fault" },
  door_open: { icon: AlertTriangle, label: "Door Open" },
  calibration_due: { icon: AlertTriangle, label: "Calibration Due" },
};

const severityConfig: Record<AlertSeverity, { color: string; bgColor: string }> = {
  info: { color: "text-accent", bgColor: "bg-accent/10" },
  warning: { color: "text-warning", bgColor: "bg-warning/10" },
  critical: { color: "text-alarm", bgColor: "bg-alarm/10" },
};

const Alerts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

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
    if (session?.user) loadAlerts();
  }, [session]);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select(`
          id, title, message, alert_type, severity, status, escalation_level,
          temp_reading, temp_limit, triggered_at, acknowledged_at, resolved_at,
          unit:units!inner(
            id, name,
            area:areas!inner(name, site:sites!inner(name))
          )
        `)
        .order("triggered_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const formatted = (data || []).map((a: any) => ({
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

      setAlerts(formatted);
    } catch (error) {
      console.error("Error loading alerts:", error);
      toast({ title: "Failed to load alerts", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleAcknowledge = async (alert: Alert) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: session!.user.id,
        })
        .eq("id", alert.id);

      if (error) throw error;

      toast({ title: "Alert acknowledged" });
      loadAlerts();
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      toast({ title: "Failed to acknowledge", variant: "destructive" });
    }
    setIsSubmitting(false);
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
          alert_id: selectedAlert.id,
          unit_id: selectedAlert.unit.id,
          action_taken: correctiveAction,
          root_cause: rootCause || null,
          created_by: session!.user.id,
        });

      if (actionError) throw actionError;

      // Update alert status
      const { error: alertError } = await supabase
        .from("alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: session!.user.id,
        })
        .eq("id", selectedAlert.id);

      if (alertError) throw alertError;

      toast({ title: "Alert resolved with corrective action" });
      setShowResolveDialog(false);
      setSelectedAlert(null);
      setCorrectiveAction("");
      setRootCause("");
      loadAlerts();
    } catch (error) {
      console.error("Error resolving alert:", error);
      toast({ title: "Failed to resolve", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const getTimeAgo = (dateStr: string) => {
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const filteredAlerts = alerts.filter((a) => {
    if (activeTab === "active") return a.status === "active" || a.status === "escalated";
    if (activeTab === "acknowledged") return a.status === "acknowledged";
    if (activeTab === "resolved") return a.status === "resolved";
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === "active" || a.status === "escalated").length;
  const acknowledgedCount = alerts.filter((a) => a.status === "acknowledged").length;

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
              const typeConfig = alertTypeConfig[alert.alert_type];
              const severity = severityConfig[alert.severity];
              const Icon = typeConfig?.icon || AlertTriangle;

              return (
                <Card
                  key={alert.id}
                  className={`${alert.status === "active" || alert.status === "escalated" ? "border-alarm/30" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${severity.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${severity.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{alert.title}</h3>
                              <Badge className={`${severity.bgColor} ${severity.color} border-0`}>
                                {alert.severity}
                              </Badge>
                              {alert.escalation_level > 1 && (
                                <Badge variant="outline" className="text-warning border-warning">
                                  <ArrowUpCircle className="w-3 h-3 mr-1" />
                                  Level {alert.escalation_level}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.unit.area.site.name} · {alert.unit.area.name} · {alert.unit.name}
                            </p>
                            {alert.message && (
                              <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                            )}
                            {alert.temp_reading !== null && (
                              <p className="text-sm mt-1">
                                <span className="text-alarm font-semibold">{alert.temp_reading}°F</span>
                                {alert.temp_limit && (
                                  <span className="text-muted-foreground"> (limit: {alert.temp_limit}°F)</span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">{getTimeAgo(alert.triggered_at)}</p>
                            {alert.acknowledged_at && (
                              <p className="text-xs text-safe mt-1">
                                <Check className="w-3 h-3 inline mr-1" />
                                Ack'd {getTimeAgo(alert.acknowledged_at)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {(alert.status === "active" || alert.status === "escalated") && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledge(alert)}
                              disabled={isSubmitting}
                            >
                              <Bell className="w-4 h-4 mr-1" />
                              Acknowledge
                            </Button>
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
                          </div>
                        )}

                        {alert.status === "acknowledged" && (
                          <div className="flex gap-2 mt-3">
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
                  {selectedAlert.unit.area.site.name} · {selectedAlert.unit.name}
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
    </DashboardLayout>
  );
};

export default Alerts;
