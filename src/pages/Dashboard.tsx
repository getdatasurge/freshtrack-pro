import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Thermometer, 
  AlertTriangle, 
  CheckCircle2, 
  Plus,
  MapPin,
  Loader2,
  ChevronRight,
  Wifi,
  WifiOff
} from "lucide-react";
import { Session } from "@supabase/supabase-js";

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
  area: {
    name: string;
    site: {
      name: string;
    };
  };
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  ok: { color: "text-safe", bgColor: "bg-safe/10", label: "OK" },
  excursion: { color: "text-excursion", bgColor: "bg-excursion/10", label: "Excursion" },
  alarm_active: { color: "text-alarm", bgColor: "bg-alarm/10", label: "ALARM" },
  monitoring_interrupted: { color: "text-warning", bgColor: "bg-warning/10", label: "Interrupted" },
  manual_required: { color: "text-warning", bgColor: "bg-warning/10", label: "Manual Required" },
  restoring: { color: "text-accent", bgColor: "bg-accent/10", label: "Restoring" },
  offline: { color: "text-muted-foreground", bgColor: "bg-muted", label: "Offline" },
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

      const { data: unitsData } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, last_temp_reading, last_reading_at, temp_limit_high,
          area:areas!inner(name, site:sites!inner(name, organization_id))
        `)
        .eq("is_active", true)
        .limit(20);

      const filteredUnits = (unitsData || []).filter(
        (u: any) => u.area?.site?.organization_id === profile.organization_id
      ).map((u: any) => ({
        id: u.id,
        name: u.name,
        unit_type: u.unit_type,
        status: u.status,
        last_temp_reading: u.last_temp_reading,
        last_reading_at: u.last_reading_at,
        temp_limit_high: u.temp_limit_high,
        area: { name: u.area.name, site: { name: u.area.site.name } },
      }));

      setUnits(filteredUnits);

      const okCount = filteredUnits.filter((u) => u.status === "ok").length;
      const alarmCount = filteredUnits.filter((u) => 
        ["alarm_active", "excursion", "monitoring_interrupted"].includes(u.status)
      ).length;

      setStats({
        totalUnits: filteredUnits.length,
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

      {/* Units List */}
      {units.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Refrigeration Units</h2>
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
                <Card key={unit.id} className="unit-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${status.bgColor} flex items-center justify-center`}>
                          <Thermometer className={`w-6 h-6 ${status.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{unit.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>{status.label}</span>
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
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
