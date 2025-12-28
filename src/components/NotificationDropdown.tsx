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
  Mail,
  MailCheck,
  MailX,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface NotificationEvent {
  id: string;
  organization_id: string;
  site_id: string | null;
  unit_id: string | null;
  alert_id: string | null;
  channel: string;
  event_type: string;
  to_recipients: string[];
  status: string;
  reason: string | null;
  created_at: string;
}

interface NotificationDropdownProps {
  alertCount: number;
}

const alertTypeIcons: Record<string, typeof AlertTriangle> = {
  temp_excursion: Thermometer,
  alarm_active: Thermometer,
  monitoring_interrupted: WifiOff,
  missed_manual_entry: Clock,
  low_battery: Battery,
  TEMP_EXCURSION: Thermometer,
  ALARM_ACTIVE: Thermometer,
};

const statusConfig = {
  SENT: { icon: MailCheck, color: "text-safe", label: "Sent" },
  SKIPPED: { icon: Mail, color: "text-muted-foreground", label: "Skipped" },
  FAILED: { icon: MailX, color: "text-alarm", label: "Failed" },
};

const getTimeAgo = (dateStr: string) => {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const NotificationDropdown = ({ alertCount }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .maybeSingle();

      if (!profile?.organization_id) {
        setNotifications([]);
        return;
      }

      const { data, error } = await supabase
        .from("notification_events")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Parse recipients from JSON
      const parsed = (data || []).map((n: any) => ({
        ...n,
        to_recipients: Array.isArray(n.to_recipients) 
          ? n.to_recipients 
          : (typeof n.to_recipients === 'string' ? JSON.parse(n.to_recipients) : []),
      }));

      setNotifications(parsed);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Real-time subscription for new alerts - scoped by organization_id
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
        (payload) => {
          const alert = payload.new as any;
          if (alert.severity === "critical" && alert.status === "active") {
            toast.error(`${alert.title}`, {
              description: alert.message || "Critical alert triggered",
              duration: 10000,
              action: {
                label: "View",
                onClick: () => navigate("/alerts"),
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, orgId]);

  const handleViewAll = () => {
    setIsOpen(false);
    navigate("/alerts");
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
        className="w-80 p-0 bg-popover border border-border shadow-lg" 
        align="end"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Notifications</h4>
            {alertCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {alertCount} active
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const status = statusConfig[notif.status as keyof typeof statusConfig] || statusConfig.SENT;
                const StatusIcon = status.icon;
                const TypeIcon = alertTypeIcons[notif.event_type] || AlertTriangle;

                return (
                  <div key={notif.id} className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <TypeIcon className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {notif.event_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <StatusIcon className={`w-3.5 h-3.5 ${status.color} flex-shrink-0`} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {notif.status === "SENT" && notif.to_recipients?.length > 0
                            ? `Sent to ${notif.to_recipients.length} recipient${notif.to_recipients.length > 1 ? "s" : ""}`
                            : notif.reason || status.label
                          }
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {getTimeAgo(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No recent notifications</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Email notifications will appear here
              </p>
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t border-border">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-accent hover:text-accent"
            onClick={handleViewAll}
          >
            View all alerts
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;
