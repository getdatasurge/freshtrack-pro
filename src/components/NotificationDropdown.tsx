import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Thermometer,
  WifiOff,
  Clock,
  Battery,
  AlertTriangle,
  DoorOpen,
  Snowflake,
  Wrench,
  Loader2,
  CheckCircle2,
  Check,
  CheckCheck,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  mapAlertToNotification,
  alertTypeLabels,
  severityConfig,
  type AlertNotification,
  type AlertWithContext,
} from "@/lib/alertNotificationMapper";

interface NotificationDropdownProps {
  alertCount: number;
}

interface InAppNotification {
  id: string;
  user_id: string;
  alert_id: string | null;
  title: string;
  body: string;
  severity: string;
  read: boolean;
  read_at: string | null;
  dismissed: boolean;
  action_url: string | null;
  escalation_step: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Map alert types to icons
const alertTypeIcons: Record<string, typeof AlertTriangle> = {
  temp_excursion: Thermometer,
  alarm_active: Thermometer,
  monitoring_interrupted: WifiOff,
  missed_manual_entry: Clock,
  low_battery: Battery,
  door_open: DoorOpen,
  suspected_cooling_failure: Snowflake,
  calibration_due: Wrench,
  sensor_fault: AlertTriangle,
};

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function getSeverityForIcon(severity: string) {
  if (severity === "critical") return { textColor: "text-alarm", iconBg: "bg-alarm/10" };
  if (severity === "warning") return { textColor: "text-warning", iconBg: "bg-warning/10" };
  return { textColor: "text-accent", iconBg: "bg-accent/10" };
}

const NotificationDropdown = ({ alertCount }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const [inAppNotifs, setInAppNotifs] = useState<InAppNotification[]>([]);
  const [alertNotifs, setAlertNotifs] = useState<AlertNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Load user identity on mount
  useEffect(() => {
    const loadIdentity = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();
        setOrgId(data?.organization_id || null);
      }
    };
    loadIdentity();
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!userId || !orgId) return;
    setIsLoading(true);
    try {
      // Load in_app_notifications (per-user, with read state)
      const { data: inAppData } = await supabase
        .from("in_app_notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(50);

      setInAppNotifs((inAppData || []) as InAppNotification[]);

      // Also load alerts as fallback (for backwards compat / orgs without in_app_notifications)
      const { data: alerts } = await supabase
        .from("alerts")
        .select(`
          id, title, message, alert_type, severity, status, temp_reading, temp_limit,
          triggered_at, metadata, unit_id,
          unit:units!alerts_unit_id_fkey (
            id, name,
            area:areas!units_area_id_fkey (
              id, name,
              site:sites!areas_site_id_fkey ( id, name )
            )
          )
        `)
        .eq("organization_id", orgId)
        .in("status", ["active", "acknowledged"])
        .order("triggered_at", { ascending: false })
        .limit(20);

      const mapped = (alerts || []).map((alert: any) => {
        const alertWithContext: AlertWithContext = {
          ...alert,
          unit: alert.unit ? {
            id: alert.unit.id,
            name: alert.unit.name,
            area: alert.unit.area ? {
              id: alert.unit.area.id,
              name: alert.unit.area.name,
              site: alert.unit.area.site ? {
                id: alert.unit.area.site.id,
                name: alert.unit.area.site.name,
              } : undefined,
            } : undefined,
          } : undefined,
        };
        return mapAlertToNotification(alertWithContext);
      });
      setAlertNotifs(mapped);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setIsLoading(false);
  }, [userId, orgId]);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen, loadNotifications]);

  // Real-time subscription for new in_app_notifications
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`in-app-notifs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "in_app_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as InAppNotification;
          setInAppNotifs(prev => [newNotif, ...prev]);

          // Show toast for critical alerts
          if (newNotif.severity === "critical") {
            toast.error(newNotif.title, {
              description: newNotif.body,
              duration: 10000,
              action: newNotif.action_url ? {
                label: "View",
                onClick: () => navigate(newNotif.action_url!),
              } : undefined,
            });
          } else if (newNotif.severity === "warning") {
            toast.warning(newNotif.title, {
              description: newNotif.body,
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, navigate]);

  // Real-time subscription for alert changes (status updates)
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`alerts-realtime-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          if (isOpen) loadNotifications();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, isOpen, loadNotifications]);

  // === Actions ===
  const markAsRead = async (notifId: string) => {
    await supabase
      .from("in_app_notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", notifId);
    setInAppNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: true, read_at: new Date().toISOString() } : n));
  };

  const markAsUnread = async (notifId: string) => {
    await supabase
      .from("in_app_notifications")
      .update({ read: false, read_at: null })
      .eq("id", notifId);
    setInAppNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: false, read_at: null } : n));
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    await supabase
      .from("in_app_notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("read", false);
    setInAppNotifs(prev => prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() })));
  };

  const clearResolved = async () => {
    if (!userId) return;
    // Dismiss notifications whose alerts are resolved
    const resolvedAlertIds = alertNotifs
      .filter(a => a.status === "resolved")
      .map(a => a.id);

    if (resolvedAlertIds.length > 0) {
      await supabase
        .from("in_app_notifications")
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .in("alert_id", resolvedAlertIds);
      setInAppNotifs(prev => prev.filter(n => !resolvedAlertIds.includes(n.alert_id || "")));
    }
  };

  const handleNotifClick = (notif: InAppNotification) => {
    if (!notif.read) markAsRead(notif.id);
    setIsOpen(false);
    if (notif.action_url) navigate(notif.action_url);
    else navigate("/alerts");
  };

  const handleAlertClick = (notif: AlertNotification) => {
    setIsOpen(false);
    navigate(`/unit/${notif.unitId}`);
  };

  // Computed values
  const unreadCount = inAppNotifs.filter(n => !n.read).length;
  const criticalNotifs = inAppNotifs.filter(n => n.severity === "critical");
  const displayCount = unreadCount > 0 ? unreadCount : alertCount;

  // Determine which notifications to show based on tab
  const useInApp = inAppNotifs.length > 0;

  const filteredInApp = activeTab === "unread"
    ? inAppNotifs.filter(n => !n.read)
    : activeTab === "critical"
    ? criticalNotifs
    : inAppNotifs;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {displayCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-alarm text-alarm-foreground text-xs rounded-full flex items-center justify-center">
              {displayCount > 9 ? "9+" : displayCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:w-[460px] p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Notifications</SheetTitle>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} unread
                </Badge>
              )}
              {alertCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {alertCount} active
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-[calc(100%-60px)]">
          <div className="px-4 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="flex-1 text-xs">
                Unread {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="critical" className="flex-1 text-xs">
                Critical {criticalNotifs.length > 0 && `(${criticalNotifs.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 mt-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : useInApp ? (
              /* === In-App Notifications (per-user, with read state) === */
              filteredInApp.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredInApp.map((notif) => {
                    const alertType = (notif.metadata?.alert_type as string) || "temp_excursion";
                    const Icon = alertTypeIcons[alertType] || AlertTriangle;
                    const sev = getSeverityForIcon(notif.severity);

                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                          !notif.read ? "bg-accent/5" : ""
                        }`}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <div className={`w-9 h-9 rounded-lg ${sev.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon className={`w-4 h-4 ${sev.textColor}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium leading-tight ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                              {notif.title}
                            </span>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notif.body}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground/70">
                              {getRelativeTime(notif.created_at)}
                            </span>
                            {notif.escalation_step > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-alarm border-alarm/30">
                                Escalation {notif.escalation_step}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            notif.read ? markAsUnread(notif.id) : markAsRead(notif.id);
                          }}
                          className="flex-shrink-0 p-1 rounded hover:bg-muted"
                          title={notif.read ? "Mark as unread" : "Mark as read"}
                        >
                          {notif.read ? (
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "unread" ? "All caught up!" : activeTab === "critical" ? "No critical alerts" : "No notifications"}
                  </p>
                </div>
              )
            ) : (
              /* === Fallback: Alert-based notifications (legacy) === */
              alertNotifs.length > 0 ? (
                <div className="divide-y divide-border">
                  {alertNotifs.map((notif) => {
                    const Icon = alertTypeIcons[notif.alertType] || AlertTriangle;
                    const severity = severityConfig[notif.severity] || severityConfig.warning;
                    const isAcknowledged = notif.status === "acknowledged";

                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleAlertClick(notif)}
                        className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                          isAcknowledged ? "opacity-70" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg ${severity.iconBg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${severity.textColor}`} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${severity.textColor}`}>
                                {notif.title}
                              </span>
                              {isAcknowledged && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              )}
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${severity.textColor} ${severity.borderColor} ml-auto`}
                              >
                                {notif.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{notif.context}</p>
                            <p className="text-xs text-foreground/80">{notif.detail}</p>
                            <p className="text-[11px] text-muted-foreground/70">{notif.relativeTime}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Alerts will appear here when triggered
                  </p>
                </div>
              )
            )}
          </ScrollArea>

          <div className="border-t border-border p-2 space-y-1">
            {useInApp && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all as read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-accent hover:text-accent"
              onClick={() => { setIsOpen(false); navigate("/alerts"); }}
            >
              View all alerts
            </Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationDropdown;
