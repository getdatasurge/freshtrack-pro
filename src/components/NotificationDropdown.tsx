import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const NotificationDropdown = ({ alertCount }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Load user's organization_id on mount
  useEffect(() => {
    const loadOrgId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();
        setOrgId(data?.organization_id || null);
      }
    };
    loadOrgId();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setNotifications([]);
        return;
      }

      // Query alerts with unit/area/site context
      const { data: alerts, error } = await supabase
        .from("alerts")
        .select(`
          id,
          title,
          message,
          alert_type,
          severity,
          status,
          temp_reading,
          temp_limit,
          triggered_at,
          metadata,
          unit_id,
          unit:units!alerts_unit_id_fkey (
            id,
            name,
            area:areas!units_area_id_fkey (
              id,
              name,
              site:sites!areas_site_id_fkey (
                id,
                name
              )
            )
          )
        `)
        .eq("organization_id", profile.organization_id)
        .in("status", ["active", "acknowledged"])
        .order("triggered_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Map alerts to notification format
      const mappedNotifications = (alerts || []).map((alert: any) => {
        // Transform the nested unit data structure
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

      setNotifications(mappedNotifications);
    } catch (error) {
      console.error("Error loading notifications:", error);
      setNotifications([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

// Check if toast should be shown based on notification policy
  const shouldShowToast = async (
    alert: { unit_id: string; alert_type: string; severity: string }
  ): Promise<boolean> => {
    try {
      const { data: policy } = await supabase.rpc("get_effective_notification_policy", {
        p_unit_id: alert.unit_id,
        p_alert_type: alert.alert_type,
      });

      if (!policy || typeof policy !== "object") return false;

      const policyObj = policy as Record<string, unknown>;

      // Check if WEB_TOAST is in initial_channels
      const initialChannels = (policyObj.initial_channels as string[]) || [];
      if (!initialChannels.includes("WEB_TOAST")) return false;

      // Check severity threshold
      const severityThreshold = (policyObj.severity_threshold as string) || "WARNING";
      const allowWarnings = policyObj.allow_warning_notifications as boolean;

      if (alert.severity === "critical") return true;
      if (alert.severity === "warning" && allowWarnings) return true;
      if (alert.severity === "info" && severityThreshold === "INFO") return true;

      return false;
    } catch (error) {
      console.error("Error checking notification policy:", error);
      return false;
    }
  };

  // Real-time subscription for new alerts
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`alerts-realtime-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `organization_id=eq.${orgId}`,
        },
        async (payload) => {
          const alert = payload.new as any;
          const title = alertTypeLabels[alert.alert_type] || alert.title || "New Alert";
          
          // Check policy to determine if toast should be shown
          if (alert.status === "active") {
            const showToast = await shouldShowToast(alert);
            if (showToast) {
              const toastFn = alert.severity === "critical" ? toast.error : toast.warning;
              toastFn(title, {
                description: alert.message || `${alert.severity} alert triggered`,
                duration: 10000,
                action: {
                  label: "View",
                  onClick: () => navigate(`/unit/${alert.unit_id}`),
                },
              });
            }
          }
          
          // Refresh notifications if dropdown is open
          if (isOpen) {
            loadNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, orgId, isOpen]);

  const handleViewAll = () => {
    setIsOpen(false);
    navigate("/alerts");
  };

  const handleNotificationClick = (notification: AlertNotification) => {
    setIsOpen(false);
    navigate(`/unit/${notification.unitId}`);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-alarm text-alarm-foreground text-xs rounded-full flex items-center justify-center">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0 bg-popover border border-border shadow-lg" 
        align="end"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Notifications</h4>
            {alertCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {alertCount} active
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {notifications.length > 0 ? `Last updated just now` : "No recent updates"}
          </p>
        </div>

        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const Icon = alertTypeIcons[notif.alertType] || AlertTriangle;
                const severity = severityConfig[notif.severity] || severityConfig.warning;
                const isAcknowledged = notif.status === "acknowledged";

                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                      isAcknowledged ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg ${severity.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4.5 h-4.5 ${severity.textColor}`} />
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
                        <p className="text-xs text-muted-foreground truncate">
                          {notif.context}
                        </p>
                        <p className="text-xs text-foreground/80">
                          {notif.detail}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">
                          {notif.relativeTime}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No active alerts</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Alerts will appear here when triggered
              </p>
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t border-border space-y-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-accent hover:text-accent"
            onClick={handleViewAll}
          >
            View all alerts
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsOpen(false);
              navigate("/events");
            }}
          >
            Event history
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;
