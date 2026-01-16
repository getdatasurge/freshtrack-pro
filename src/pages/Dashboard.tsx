import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import LogTempModal, { LogTempUnit } from "@/components/LogTempModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RBACDebugPanel } from "@/components/debug/RBACDebugPanel";
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
  ShieldAlert,
  ClipboardEdit,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";
import { computeUnitStatus, UnitStatusInfo } from "@/hooks/useUnitStatus";
import { useUnitAlerts, ComputedAlert } from "@/hooks/useUnitAlerts";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";

interface DashboardStats {
  totalUnits: number;
  unitsOk: number;
  unitsWithAlerts: number;
  totalSites: number;
}

import { STATUS_CONFIG } from "@/lib/statusConfig";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalUnits: 0,
    unitsOk: 0,
    unitsWithAlerts: 0,
    totalSites: 0,
  });
  const [units, setUnits] = useState<(UnitStatusInfo & { computed: ReturnType<typeof computeUnitStatus> })[]>([]);
  const [unitsRequiringAction, setUnitsRequiringAction] = useState<(UnitStatusInfo & { computed: ReturnType<typeof computeUnitStatus> })[]>([]);
  
  // Use effective identity for impersonation support
  const { effectiveOrgId, isImpersonating, isInitialized } = useEffectiveIdentity();
  
  // Log temp modal state
  const [selectedUnit, setSelectedUnit] = useState<LogTempUnit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load dashboard data when effective org changes (supports impersonation)
  useEffect(() => {
    if (!isInitialized) return;
    
    if (isImpersonating && effectiveOrgId) {
      // Use impersonated org directly
      setOrganizationId(effectiveOrgId);
      loadDashboardData(effectiveOrgId);
    } else if (session?.user) {
      // Normal flow - fetch user's org
      loadDashboardData();
    }
  }, [session, isImpersonating, effectiveOrgId, isInitialized]);

  const loadDashboardData = useCallback(async (overrideOrgId?: string) => {
    if (!session?.user && !overrideOrgId) return;
    
    let orgId = overrideOrgId || organizationId;
    
    // Fetch org if we don't have it yet
    if (!orgId) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error loading profile:", profileError);
          setIsLoading(false);
          return;
        }

        // Redirect to callback to properly handle routing
        if (!profile?.organization_id) {
          setIsLoading(false);
          navigate("/auth/callback", { replace: true });
          return;
        }
        
        orgId = profile.organization_id;
        setOrganizationId(orgId);
      } catch (error) {
        console.error("Error checking organization:", error);
        setIsLoading(false);
        return;
      }
    }
    
    try {
      const { count: sitesCount } = await supabase
        .from("sites")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId);

      // Fetch units with area and site info, including sensor reliability fields
      const { data: unitsData } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, last_temp_reading, last_reading_at, 
          temp_limit_high, temp_limit_low, manual_log_cadence,
          sensor_reliable, manual_logging_enabled, consecutive_checkins,
          area:areas!inner(name, site:sites!inner(name, organization_id))
        `)
        .eq("is_active", true)
        .limit(50);

      const filteredUnits = (unitsData || []).filter(
        (u: any) => u.area?.site?.organization_id === orgId
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

      const formattedUnits: UnitStatusInfo[] = filteredUnits.map((u: any) => ({
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
        sensor_reliable: u.sensor_reliable,
        manual_logging_enabled: u.manual_logging_enabled,
        consecutive_checkins: u.consecutive_checkins,
        area: { name: u.area.name, site: { name: u.area.site.name } },
      }));

      // Compute status for each unit
      const unitsWithComputed = formattedUnits.map(u => ({
        ...u,
        computed: computeUnitStatus(u),
      }));

      // Sort units by action required priority
      unitsWithComputed.sort((a, b) => {
        if (a.computed.actionRequired && !b.computed.actionRequired) return -1;
        if (!a.computed.actionRequired && b.computed.actionRequired) return 1;
        const aPriority = STATUS_CONFIG[a.status]?.priority || 99;
        const bPriority = STATUS_CONFIG[b.status]?.priority || 99;
        return aPriority - bPriority;
      });

      setUnits(unitsWithComputed);
      setUnitsRequiringAction(unitsWithComputed.filter(u => u.computed.actionRequired));

      setStats({
        totalUnits: unitsWithComputed.length,
        unitsOk: 0, // Will be computed by useUnitAlerts
        unitsWithAlerts: 0, // Will be computed by useUnitAlerts
        totalSites: sitesCount || 0,
      });
    } catch (error) {
      console.error("Error loading dashboard:", error);
    }
    setIsLoading(false);
  }, [session, organizationId, navigate]);

  // Use unified alert computation - single source of truth
  const alertsSummary = useUnitAlerts(units);

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

  const getComplianceBadge = (unit: UnitStatusInfo & { computed: ReturnType<typeof computeUnitStatus> }) => {
    if (unit.status === "ok" && !unit.computed.actionRequired) {
      return (
        <Badge variant="outline" className="gap-1 text-safe border-safe/30 bg-safe/5">
          <ShieldCheck className="w-3 h-3" />
          Compliant
        </Badge>
      );
    } else if (unit.computed.manualRequired) {
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

  const getLastLogDisplay = (unit: UnitStatusInfo) => {
    if (!unit.last_manual_log_at) {
      return <span className="text-muted-foreground">No logs</span>;
    }
    
    const computed = computeUnitStatus(unit);

    return (
      <span className={computed.manualRequired ? "text-warning" : "text-muted-foreground"}>
        {formatDistanceToNow(new Date(unit.last_manual_log_at), { addSuffix: true })}
      </span>
    );
  };

  const handleLogTemp = (unit: UnitStatusInfo, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    loadDashboardData();
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
      {/* RBAC Debug Panel - only visible with ?debug_rbac=1 */}
      <RBACDebugPanel />
      
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
                <p className="text-3xl font-bold text-safe">{alertsSummary.unitsOk}</p>
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
                <p className={`text-3xl font-bold ${alertsSummary.totalCount > 0 ? "text-alarm" : "text-foreground"}`}>{alertsSummary.totalCount}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${alertsSummary.totalCount > 0 ? "bg-alarm/10" : "bg-muted"}`}>
                <AlertTriangle className={`w-6 h-6 ${alertsSummary.totalCount > 0 ? "text-alarm" : "text-muted-foreground"}`} />
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

      {/* Units Requiring Action - grouped by severity */}
      {alertsSummary.totalCount > 0 && (
        <>
          {/* Critical Alerts (Manual Required, Alarm Active) */}
          {alertsSummary.criticalCount > 0 && (
            <Card className="mb-4 border-alarm/50 bg-alarm/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-alarm">
                  <AlertCircle className="w-5 h-5" />
                  Critical ({alertsSummary.criticalCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {alertsSummary.alerts
                    .filter(a => a.severity === "critical")
                    .slice(0, 5)
                    .map((alert) => {
                      const unit = units.find(u => u.id === alert.unit_id);
                      if (!unit) return null;
                      const showLogButton = alert.type === "MANUAL_REQUIRED";
                      
                      return (
                        <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-background hover:bg-muted/50 transition-colors">
                          <Link to={`/units/${alert.unit_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-alarm/10 flex items-center justify-center flex-shrink-0">
                              <Thermometer className="w-5 h-5 text-alarm" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground">{alert.unit_name}</span>
                                <Badge variant="destructive" className="text-xs">{alert.type === "MANUAL_REQUIRED" ? "Log Required" : "Alarm"}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{alert.site_name} · {alert.area_name}</p>
                              {/* Show message on mobile and desktop - no truncation */}
                              <p className="text-xs text-muted-foreground mt-1 break-words leading-relaxed">
                                {alert.message}
                              </p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0 pl-13 sm:pl-0">
                            {showLogButton && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-alarm/50 text-alarm hover:bg-alarm/10"
                                onClick={(e) => handleLogTemp(unit, e)}
                              >
                                <ClipboardEdit className="w-4 h-4 mr-1" />
                                Log
                              </Button>
                            )}
                            <Link to={`/units/${alert.unit_id}`}>
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning Alerts (Offline, Excursion) */}
          {alertsSummary.warningCount > 0 && (
            <Card className="mb-6 border-warning/50 bg-warning/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-warning">
                  <WifiOff className="w-5 h-5" />
                  Warnings ({alertsSummary.warningCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {alertsSummary.alerts
                    .filter(a => a.severity === "warning")
                    .slice(0, 5)
                    .map((alert) => {
                      return (
                        <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-background hover:bg-muted/50 transition-colors">
                          <Link to={`/units/${alert.unit_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                              {alert.type === "OFFLINE" ? (
                                <WifiOff className="w-5 h-5 text-warning" />
                              ) : (
                                <Thermometer className="w-5 h-5 text-warning" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground">{alert.unit_name}</span>
                                <Badge variant="secondary" className="text-xs bg-warning/10 text-warning border-0">
                                  {alert.type === "OFFLINE" ? "Offline" : "Excursion"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{alert.site_name} · {alert.area_name}</p>
                              {/* Show message - no truncation, fully wrapping */}
                              <p className="text-xs text-muted-foreground mt-1 break-words leading-relaxed">
                                {alert.message}
                              </p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0 pl-13 sm:pl-0">
                            <Link to={`/units/${alert.unit_id}`}>
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
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
              // Use computed status when offline, otherwise use database status
              const effectiveStatus = unit.computed.offlineSeverity !== 'none' 
                ? 'offline' 
                : unit.status;
              const status = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.offline;
              const isOnline = unit.computed.sensorOnline;
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
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Get Started</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first site and refrigeration units to begin monitoring
            </p>
            <Link to="/sites">
              <Button className="bg-accent hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Site
              </Button>
            </Link>
          </CardContent>
        </Card>
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

export default Dashboard;
