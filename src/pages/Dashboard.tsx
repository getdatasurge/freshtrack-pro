import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Thermometer, 
  AlertTriangle, 
  CheckCircle2, 
  Plus,
  MapPin,
  Loader2,
  ChevronRight,
  Wifi,
  WifiOff,
  Clock,
  ClipboardList,
  AlertCircle,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";

interface DashboardStats {
  totalUnits: number;
  unitsOk: number;
  unitsInAlarm: number;
  totalSites: number;
}

interface UnitWithDetails {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  last_temp_reading: number | null;
  last_reading_at: string | null;
  temp_limit_high: number;
  temp_limit_low: number | null;
  manual_log_cadence: number;
  last_manual_log_at: string | null;
  area: {
    name: string;
    site: {
      name: string;
    };
  };
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string; priority: number }> = {
  alarm_active: { color: "text-alarm", bgColor: "bg-alarm/10", label: "ALARM", priority: 1 },
  excursion: { color: "text-excursion", bgColor: "bg-excursion/10", label: "Excursion", priority: 2 },
  monitoring_interrupted: { color: "text-warning", bgColor: "bg-warning/10", label: "Interrupted", priority: 3 },
  manual_required: { color: "text-warning", bgColor: "bg-warning/10", label: "Manual Required", priority: 4 },
  offline: { color: "text-muted-foreground", bgColor: "bg-muted", label: "Offline", priority: 5 },
  restoring: { color: "text-accent", bgColor: "bg-accent/10", label: "Restoring", priority: 6 },
  ok: { color: "text-safe", bgColor: "bg-safe/10", label: "OK", priority: 7 },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUnits: 0,
    unitsOk: 0,
    unitsInAlarm: 0,
    totalSites: 0,
  });
  const [units, setUnits] = useState<UnitWithDetails[]>([]);
  const [unitsRequiringAction, setUnitsRequiringAction] = useState<UnitWithDetails[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadDashboardData();
    }
  }, [session]);

  const loadDashboardData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", session!.user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setIsLoading(false);
        navigate("/onboarding");
        return;
      }

      const { count: sitesCount } = await supabase
        .from("sites")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id);

      // Fetch units with area and site info
      const { data: unitsData } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, last_temp_reading, last_reading_at, 
          temp_limit_high, temp_limit_low, manual_log_cadence,
          area:areas!inner(name, site:sites!inner(name, organization_id))
        `)
        .eq("is_active", true)
        .limit(50);

      const filteredUnits = (unitsData || []).filter(
        (u: any) => u.area?.site?.organization_id === profile.organization_id
      );

      // Fetch last manual log for each unit
      const unitIds = filteredUnits.map((u: any) => u.id);
      const { data: manualLogs } = await supabase
        .from("manual_temperature_logs")
        .select("unit_id, logged_at")
        .in("unit_id", unitIds)
        .order("logged_at", { ascending: false });

      // Get the latest log per unit
      const latestLogByUnit: Record<string, string> = {};
      manualLogs?.forEach((log) => {
        if (!latestLogByUnit[log.unit_id]) {
          latestLogByUnit[log.unit_id] = log.logged_at;
        }
      });

      const formattedUnits: UnitWithDetails[] = filteredUnits.map((u: any) => ({
        id: u.id,
        name: u.name,
        unit_type: u.unit_type,
        status: u.status,
        last_temp_reading: u.last_temp_reading,
        last_reading_at: u.last_reading_at,
        temp_limit_high: u.temp_limit_high,
        temp_limit_low: u.temp_limit_low,
        manual_log_cadence: u.manual_log_cadence,
        last_manual_log_at: latestLogByUnit[u.id] || null,
        area: { name: u.area.name, site: { name: u.area.site.name } },
      }));

      // Sort units by status priority
      formattedUnits.sort((a, b) => {
        const aPriority = statusConfig[a.status]?.priority || 99;
        const bPriority = statusConfig[b.status]?.priority || 99;
        return aPriority - bPriority;
      });

      setUnits(formattedUnits);

      // Filter units requiring action
      const actionStatuses = ["alarm_active", "excursion", "monitoring_interrupted", "manual_required", "offline"];
      const actionUnits = formattedUnits.filter((u) => actionStatuses.includes(u.status));
      setUnitsRequiringAction(actionUnits);

      const okCount = formattedUnits.filter((u) => u.status === "ok").length;
      const alarmCount = formattedUnits.filter((u) => 
        ["alarm_active", "excursion", "monitoring_interrupted"].includes(u.status)
      ).length;

      setStats({
        totalUnits: formattedUnits.length,
        unitsOk: okCount,
        unitsInAlarm: alarmCount,
        totalSites: sitesCount || 0,
      });
    } catch (error) {
      console.error("Error loading dashboard:", error);
    }
    setIsLoading(false);
  };

  const formatTemp = (temp: number | null) => {
    if (temp === null) return "--";
    return `${temp.toFixed(1)}°F`;
  };

  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getComplianceBadge = (unit: UnitWithDetails) => {
    const isInRange = unit.last_temp_reading !== null && 
      unit.last_temp_reading <= unit.temp_limit_high &&
      (unit.temp_limit_low === null || unit.last_temp_reading >= unit.temp_limit_low);
    
    const hasRecentLog = unit.last_manual_log_at && 
      (Date.now() - new Date(unit.last_manual_log_at).getTime()) < unit.manual_log_cadence * 1000;

    if (unit.status === "ok" && isInRange) {
      return (
        <Badge variant="outline" className="gap-1 text-safe border-safe/30 bg-safe/5">
          <ShieldCheck className="w-3 h-3" />
          Compliant
        </Badge>
      );
    } else if (unit.status === "manual_required" || !hasRecentLog) {
      return (
        <Badge variant="outline" className="gap-1 text-warning border-warning/30 bg-warning/5">
          <ClipboardList className="w-3 h-3" />
          Log Due
        </Badge>
      );
    } else if (["alarm_active", "excursion"].includes(unit.status)) {
      return (
        <Badge variant="outline" className="gap-1 text-alarm border-alarm/30 bg-alarm/5">
          <ShieldAlert className="w-3 h-3" />
          Non-Compliant
        </Badge>
      );
    }
    return null;
  };

  const getLastLogDisplay = (unit: UnitWithDetails) => {
    if (!unit.last_manual_log_at) {
      return <span className="text-muted-foreground">No logs</span>;
    }
    
    const cadenceMs = unit.manual_log_cadence * 1000;
    const timeSinceLog = Date.now() - new Date(unit.last_manual_log_at).getTime();
    const isOverdue = timeSinceLog > cadenceMs;

    return (
      <span className={isOverdue ? "text-warning" : "text-muted-foreground"}>
        {formatDistanceToNow(new Date(unit.last_manual_log_at), { addSuffix: true })}
      </span>
    );
  };

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
    <DashboardLayout>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="stat-card card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalUnits}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Thermometer className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">All OK</p>
                <p className="text-3xl font-bold text-safe">{stats.unitsOk}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-safe/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-safe" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alerts</p>
                <p className={`text-3xl font-bold ${stats.unitsInAlarm > 0 ? "text-alarm" : "text-foreground"}`}>{stats.unitsInAlarm}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.unitsInAlarm > 0 ? "bg-alarm/10" : "bg-muted"}`}>
                <AlertTriangle className={`w-6 h-6 ${stats.unitsInAlarm > 0 ? "text-alarm" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sites</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalSites}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Units Requiring Action */}
      {unitsRequiringAction.length > 0 && (
        <Card className="mb-6 border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-warning">
              <AlertCircle className="w-5 h-5" />
              Action Required ({unitsRequiringAction.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {unitsRequiringAction.slice(0, 5).map((unit) => {
                const status = statusConfig[unit.status] || statusConfig.offline;
                return (
                  <Link key={unit.id} to={`/units/${unit.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${status.bgColor} flex items-center justify-center`}>
                          <Thermometer className={`w-5 h-5 ${status.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{unit.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{unit.area.site.name} · {unit.area.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className={`font-semibold ${status.color}`}>
                            {formatTemp(unit.last_temp_reading)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(unit.last_reading_at)}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
              {unitsRequiringAction.length > 5 && (
                <Link to="/alerts">
                  <Button variant="ghost" className="w-full text-warning">
                    View all {unitsRequiringAction.length} units requiring action
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Units List */}
      {units.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">All Refrigeration Units</h2>
            <Link to="/sites">
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Unit
              </Button>
            </Link>
          </div>
          <div className="grid gap-3">
            {units.map((unit) => {
              const status = statusConfig[unit.status] || statusConfig.offline;
              const isOnline = unit.status !== "offline" && unit.last_reading_at;
              return (
                <Link key={unit.id} to={`/units/${unit.id}`}>
                  <Card className="unit-card card-hover cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl ${status.bgColor} flex items-center justify-center`}>
                            <Thermometer className={`w-6 h-6 ${status.color}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{unit.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>{status.label}</span>
                              {getComplianceBadge(unit)}
                            </div>
                            <p className="text-sm text-muted-foreground">{unit.area.site.name} · {unit.area.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <div className={`temp-display text-xl font-semibold ${unit.last_temp_reading && unit.last_temp_reading > unit.temp_limit_high ? "text-alarm" : status.color}`}>
                              {formatTemp(unit.last_temp_reading)}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {isOnline ? <Wifi className="w-3 h-3 text-safe" /> : <WifiOff className="w-3 h-3" />}
                              {getTimeAgo(unit.last_reading_at)}
                            </div>
                          </div>
                          <div className="text-right hidden md:block">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <ClipboardList className="w-3 h-3" />
                              Last Log
                            </div>
                            <div className="text-xs">
                              {getLastLogDisplay(unit)}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <Thermometer className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Units Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">Add refrigeration units to start monitoring temperatures.</p>
            <Link to="/sites">
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Go to Sites
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
