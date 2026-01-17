import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import LogTempModal, { LogTempUnit } from "@/components/LogTempModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer,
  Loader2,
  WifiOff,
  Wifi,
  CloudOff,
  RefreshCw,
  Check,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Session } from "@supabase/supabase-js";
import { computeUnitStatus, UnitStatusInfo } from "@/hooks/useUnitStatus";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";

interface UnitForLogging extends UnitStatusInfo {}

const ManualLog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline, pendingCount, isSyncing, syncPendingLogs } = useOfflineSync();
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<UnitForLogging[]>([]);
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
      loadUnits();
    }
  }, [isInitialized, effectiveOrgId, session]);

  const loadUnits = useCallback(async () => {
    if (!session?.user || !effectiveOrgId) return;
    setIsLoading(true);
    try {
      // Get units including sensor reliability fields using effectiveOrgId
      const { data: unitsData } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, temp_limit_high, temp_limit_low, manual_log_cadence,
          last_temp_reading, last_reading_at,
          sensor_reliable, manual_logging_enabled, consecutive_checkins,
          area:areas!inner(name, site:sites!inner(name, organization_id))
        `)
        .eq("is_active", true);

      // Get most recent manual logs for each unit
      const unitIds = (unitsData || [])
        .filter((u: any) => u.area?.site?.organization_id === effectiveOrgId)
        .map((u: any) => u.id);

      const { data: recentLogs } = await supabase
        .from("manual_temperature_logs")
        .select("unit_id, logged_at")
        .in("unit_id", unitIds)
        .order("logged_at", { ascending: false });

      const logsByUnit: Record<string, string> = {};
      (recentLogs || []).forEach((log) => {
        if (!logsByUnit[log.unit_id]) {
          logsByUnit[log.unit_id] = log.logged_at;
        }
      });

      const filtered: UnitForLogging[] = (unitsData || [])
        .filter((u: any) => u.area?.site?.organization_id === effectiveOrgId)
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          unit_type: u.unit_type,
          status: u.status,
          temp_limit_high: u.temp_limit_high,
          temp_limit_low: u.temp_limit_low,
          manual_log_cadence: u.manual_log_cadence || 14400,
          last_manual_log_at: logsByUnit[u.id] || null,
          last_reading_at: u.last_reading_at,
          last_temp_reading: u.last_temp_reading,
          sensor_reliable: u.sensor_reliable,
          manual_logging_enabled: u.manual_logging_enabled,
          consecutive_checkins: u.consecutive_checkins,
          area: { name: u.area.name, site: { name: u.area.site.name } },
        }));

      // Sort by action required first, then by manual required
      filtered.sort((a, b) => {
        const aStatus = computeUnitStatus(a);
        const bStatus = computeUnitStatus(b);
        if (aStatus.manualRequired && !bStatus.manualRequired) return -1;
        if (!aStatus.manualRequired && bStatus.manualRequired) return 1;
        return 0;
      });

      setUnits(filtered);
    } catch (error) {
      console.error("Error loading units:", error);
    }
    setIsLoading(false);
  }, [session, navigate]);

  const formatCadence = (seconds: number) => {
    const hours = seconds / 3600;
    if (hours < 1) return `${Math.round(seconds / 60)} min`;
    if (hours === 1) return "1 hour";
    return `${hours} hours`;
  };

  // Compute which units need logging using unified logic
  const unitsWithStatus = units.map(u => ({
    ...u,
    computed: computeUnitStatus(u),
  }));

  const unitsRequiringLog = unitsWithStatus.filter(u => u.computed.manualRequired);

  const handleUnitClick = (unit: UnitForLogging) => {
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
    // Reload units to get fresh data
    loadUnits();
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
    <DashboardLayout title="Manual Temperature Log">
      {/* Offline/Sync Status Bar */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <div className="flex items-center gap-2 text-safe">
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-warning">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">Offline Mode</span>
            </div>
          )}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-warning/10 text-warning">
              <CloudOff className="w-3 h-3 mr-1" />
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadUnits}
            disabled={isLoading}
            title="Refresh units"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          {pendingCount > 0 && isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncPendingLogs}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Now
            </Button>
          )}
        </div>
      </div>

      {/* Manual Logging Required Alert */}
      {unitsRequiringLog.length > 0 && (
        <Card className="mb-6 border-alarm/50 bg-alarm/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-alarm">
              <AlertTriangle className="w-5 h-5" />
              Manual Logging Required ({unitsRequiringLog.length} units)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              The following units require immediate manual temperature logs due to sensor issues or missed log intervals.
            </p>
            <div className="grid gap-2">
              {unitsRequiringLog.slice(0, 3).map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleUnitClick(unit)}
                >
                  <div className="flex items-center gap-3">
                    <Thermometer className="w-4 h-4 text-alarm" />
                    <div>
                      <span className="font-medium text-foreground">{unit.name}</span>
                      <p className="text-xs text-muted-foreground">{unit.area.site.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-1">
                      {unit.computed.minutesSinceManualLog === null 
                        ? "Never logged" 
                        : `${Math.floor(unit.computed.manualOverdueMinutes / 60)}h overdue`}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Every {formatCadence(unit.manual_log_cadence)}
                    </p>
                  </div>
                </div>
              ))}
              {unitsRequiringLog.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{unitsRequiringLog.length - 3} more units need logging
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Units Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unitsWithStatus.map((unit) => {
          const { computed } = unit;
          const needsAttention = computed.manualRequired;

          return (
            <Card
              key={unit.id}
              className={`cursor-pointer transition-all ${
                needsAttention ? "border-warning/50 bg-warning/5" : "card-hover"
              }`}
              onClick={() => handleUnitClick(unit)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      needsAttention ? "bg-warning/10" : "bg-accent/10"
                    }`}>
                      <Thermometer className={`w-5 h-5 ${needsAttention ? "text-warning" : "text-accent"}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{unit.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {unit.area.site.name} · {unit.area.name}
                      </p>
                    </div>
                  </div>
                  {needsAttention && (
                    <AlertTriangle className="w-4 h-4 text-warning" />
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {unit.unit_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · Every {formatCadence(unit.manual_log_cadence)}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${computed.manualRequired ? "text-warning" : "text-safe"}`}>
                    {computed.manualRequired ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {computed.manualRequired 
                      ? (computed.minutesSinceManualLog === null ? "Never" : "Overdue")
                      : `${Math.floor((computed.minutesSinceManualLog || 0) / 60)}h ago`}
                  </div>
                </div>

              </CardContent>
            </Card>
          );
        })}
      </div>

      {units.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Thermometer className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No units available for logging</p>
          </CardContent>
        </Card>
      )}

      {/* Log Entry Modal */}
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

export default ManualLog;
