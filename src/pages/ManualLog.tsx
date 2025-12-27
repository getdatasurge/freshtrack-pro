import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { temperatureSchema, notesSchema, validateInput } from "@/lib/validation";

interface UnitForLogging {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  last_manual_log: string | null;
  manual_log_cadence: number;
  area: { name: string; site: { name: string } };
}

const ManualLog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOnline, pendingCount, isSyncing, saveLogOffline, syncPendingLogs } = useOfflineSync();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<UnitForLogging[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<UnitForLogging | null>(null);
  const [temperature, setTemperature] = useState("");
  const [notes, setNotes] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (session?.user) loadUnits();
  }, [session]);

  const loadUnits = async () => {
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", session!.user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        navigate("/onboarding");
        return;
      }

      // Get units - prioritize manual_required status
      const { data: unitsData } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, temp_limit_high, temp_limit_low, manual_log_cadence,
          area:areas!inner(name, site:sites!inner(name, organization_id))
        `)
        .eq("is_active", true);

      // Get most recent manual logs for each unit
      const { data: recentLogs } = await supabase
        .from("manual_temperature_logs")
        .select("unit_id, logged_at")
        .order("logged_at", { ascending: false });

      const logsByUnit: Record<string, string> = {};
      (recentLogs || []).forEach((log) => {
        if (!logsByUnit[log.unit_id]) {
          logsByUnit[log.unit_id] = log.logged_at;
        }
      });

      const filtered = (unitsData || [])
        .filter((u: any) => u.area?.site?.organization_id === profile.organization_id)
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          unit_type: u.unit_type,
          status: u.status,
          temp_limit_high: u.temp_limit_high,
          temp_limit_low: u.temp_limit_low,
          manual_log_cadence: u.manual_log_cadence || 14400,
          last_manual_log: logsByUnit[u.id] || null,
          area: { name: u.area.name, site: { name: u.area.site.name } },
        }))
        // Sort: manual_required first, then by last log time
        .sort((a: UnitForLogging, b: UnitForLogging) => {
          if (a.status === "manual_required" && b.status !== "manual_required") return -1;
          if (b.status === "manual_required" && a.status !== "manual_required") return 1;
          return 0;
        });

      setUnits(filtered);
    } catch (error) {
      console.error("Error loading units:", error);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!selectedUnit) {
      toast({ title: "Please select a unit", variant: "destructive" });
      return;
    }

    // Validate temperature
    const temp = parseFloat(temperature);
    const tempResult = validateInput(temperatureSchema, temp);
    if (!tempResult.success) {
      toast({ title: (tempResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    // Validate notes
    const notesResult = validateInput(notesSchema, notes);
    if (!notesResult.success) {
      toast({ title: (notesResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    // Check if out of range and require corrective action
    const validatedTemp = (tempResult as { success: true; data: number }).data;
    const isOutOfRange = validatedTemp > selectedUnit.temp_limit_high || 
      (selectedUnit.temp_limit_low !== null && validatedTemp < selectedUnit.temp_limit_low);
    
    if (isOutOfRange && !correctiveAction.trim()) {
      toast({ 
        title: "Corrective action required", 
        description: "Temperature is out of range. Please describe the corrective action taken.",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    const validatedNotes = (notesResult as { success: true; data: string | undefined }).data?.trim() || null;
    
    const logEntry = {
      id: crypto.randomUUID(),
      unit_id: selectedUnit.id,
      temperature: validatedTemp,
      notes: validatedNotes,
      logged_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      if (isOnline && session) {
        // Save to Supabase
        const { error } = await supabase.from("manual_temperature_logs").insert({
          unit_id: logEntry.unit_id,
          temperature: logEntry.temperature,
          notes: logEntry.notes,
          logged_at: logEntry.logged_at,
          logged_by: session.user.id,
          is_in_range: !isOutOfRange,
        });

        if (error) throw error;

        // If out of range, also create corrective action record
        if (isOutOfRange && correctiveAction.trim()) {
          await supabase.from("corrective_actions").insert({
            unit_id: selectedUnit.id,
            action_taken: correctiveAction.trim(),
            created_by: session.user.id,
          });
        }

        toast({ title: "Temperature logged successfully" });
      } else {
        await saveLogOffline(logEntry);
        toast({
          title: "Saved offline",
          description: "Will sync when back online",
        });
      }

      setSelectedUnit(null);
      setTemperature("");
      setNotes("");
      setCorrectiveAction("");
      loadUnits();
    } catch (error) {
      console.error("Error saving log:", error);
      await saveLogOffline(logEntry);
      toast({
        title: "Saved offline",
        description: "Will sync when back online",
        variant: "default",
      });
    }

    setIsSubmitting(false);
  };

  const getTimeSinceLog = (dateStr: string | null, cadenceSeconds: number) => {
    if (!dateStr) return null;
    const diffHours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
    return diffHours;
  };

  const getLogStatus = (unit: UnitForLogging) => {
    const cadenceHours = unit.manual_log_cadence / 3600;
    const hours = getTimeSinceLog(unit.last_manual_log, unit.manual_log_cadence);
    
    // Manual required status takes priority
    if (unit.status === "manual_required" || unit.status === "monitoring_interrupted" || unit.status === "offline") {
      return { status: "required", label: "REQUIRED", color: "text-alarm", urgent: true };
    }
    
    if (hours === null) return { status: "never", label: "Never logged", color: "text-warning", urgent: true };
    if (hours < cadenceHours * 0.75) return { status: "ok", label: `${Math.floor(hours)}h ago`, color: "text-safe", urgent: false };
    if (hours < cadenceHours) return { status: "due", label: "Due soon", color: "text-excursion", urgent: false };
    return { status: "overdue", label: "Overdue", color: "text-alarm", urgent: true };
  };

  const formatCadence = (seconds: number) => {
    const hours = seconds / 3600;
    if (hours < 1) return `${Math.round(seconds / 60)} min`;
    if (hours === 1) return "1 hour";
    return `${hours} hours`;
  };

  const unitsRequiringLog = units.filter(u => {
    const status = getLogStatus(u);
    return status.urgent;
  });

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
              {unitsRequiringLog.slice(0, 3).map((unit) => {
                const logStatus = getLogStatus(unit);
                return (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedUnit(unit)}
                  >
                    <div className="flex items-center gap-3">
                      <Thermometer className="w-4 h-4 text-alarm" />
                      <div>
                        <span className="font-medium text-foreground">{unit.name}</span>
                        <p className="text-xs text-muted-foreground">{unit.area.site.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive" className="mb-1">{logStatus.label}</Badge>
                      <p className="text-xs text-muted-foreground">
                        Every {formatCadence(unit.manual_log_cadence)}
                      </p>
                    </div>
                  </div>
                );
              })}
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
        {units.map((unit) => {
          const logStatus = getLogStatus(unit);
          const needsAttention = logStatus.status === "overdue" || logStatus.status === "never";

          return (
            <Card
              key={unit.id}
              className={`cursor-pointer transition-all ${
                needsAttention ? "border-warning/50 bg-warning/5" : "card-hover"
              }`}
              onClick={() => setSelectedUnit(unit)}
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
                  <div className={`flex items-center gap-1 text-xs ${logStatus.color}`}>
                    {logStatus.status === "ok" ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {logStatus.label}
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

      {/* Log Entry Dialog - Prevent silent dismissal */}
      <Dialog 
        open={!!selectedUnit} 
        onOpenChange={(open) => {
          if (!open && !isOnline) {
            // Prevent silent dismissal when offline - require confirmation
            const confirmed = window.confirm(
              "You are offline. Are you sure you want to close without logging? The unit may require a temperature log."
            );
            if (!confirmed) return;
          }
          if (!open) {
            setSelectedUnit(null);
            setTemperature("");
            setNotes("");
            setCorrectiveAction("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-accent" />
              Log Temperature
            </DialogTitle>
          </DialogHeader>

          {selectedUnit && (
            <div className="space-y-4 pt-2">
              {/* Unit Info with Status */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-foreground">{selectedUnit.name}</p>
                  {(selectedUnit.status === "manual_required" || selectedUnit.status === "monitoring_interrupted" || selectedUnit.status === "offline") && (
                    <Badge variant="destructive" className="text-xs">
                      {selectedUnit.status === "offline" ? "Sensor Offline" : "Manual Required"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedUnit.area.site.name} · {selectedUnit.area.name}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    Limit: ≤{selectedUnit.temp_limit_high}°F
                    {selectedUnit.temp_limit_low !== null && ` / ≥${selectedUnit.temp_limit_low}°F`}
                  </span>
                  <span className="text-muted-foreground border-l border-border pl-4">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Log every {formatCadence(selectedUnit.manual_log_cadence)}
                  </span>
                </div>
              </div>

              {/* Offline Warning */}
              {!isOnline && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
                  <WifiOff className="w-4 h-4 text-warning flex-shrink-0" />
                  <p className="text-xs text-warning">
                    You are offline. Log will be saved locally and synced when connection is restored.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Temperature (°F) *
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Enter temperature"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="text-2xl font-bold h-14 text-center"
                  autoFocus
                />
                {temperature && (
                  <div className="mt-2 text-center">
                    {parseFloat(temperature) > selectedUnit.temp_limit_high ? (
                      <Badge variant="destructive">Above Limit!</Badge>
                    ) : selectedUnit.temp_limit_low !== null &&
                      parseFloat(temperature) < selectedUnit.temp_limit_low ? (
                      <Badge variant="destructive">Below Limit!</Badge>
                    ) : (
                      <Badge className="bg-safe/10 text-safe border-safe/20">In Range</Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Corrective Action - Required when out of range */}
              {temperature && (parseFloat(temperature) > selectedUnit.temp_limit_high || 
                (selectedUnit.temp_limit_low !== null && parseFloat(temperature) < selectedUnit.temp_limit_low)) && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <label className="text-sm font-medium text-destructive mb-2 block">
                    Corrective Action Required *
                  </label>
                  <Textarea
                    placeholder="Describe the corrective action taken (e.g., 'Adjusted thermostat, discarded affected items, notified manager')"
                    value={correctiveAction}
                    onChange={(e) => setCorrectiveAction(e.target.value)}
                    rows={3}
                    className="border-destructive/30 focus:border-destructive"
                  />
                  <p className="text-xs text-destructive/80 mt-2">
                    Temperature is out of range. You must document the corrective action before submitting.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Notes (optional)
                </label>
                <Textarea
                  placeholder="Any observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedUnit(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !temperature}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save Log
                </Button>
              </div>

              {!isOnline && (
                <p className="text-xs text-center text-muted-foreground">
                  <WifiOff className="w-3 h-3 inline mr-1" />
                  Offline - will sync when connected
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ManualLog;
