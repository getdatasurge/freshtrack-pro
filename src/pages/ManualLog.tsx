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
    if (unit.status === "manual_required") {
      return { status: "required", label: "REQUIRED", color: "text-alarm" };
    }
    
    if (hours === null) return { status: "never", label: "Never logged", color: "text-warning" };
    if (hours < cadenceHours * 0.75) return { status: "ok", label: `${Math.floor(hours)}h ago`, color: "text-safe" };
    if (hours < cadenceHours) return { status: "due", label: "Due soon", color: "text-excursion" };
    return { status: "overdue", label: "Overdue", color: "text-alarm" };
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
      <div className="flex items-center justify-between mb-6 p-3 rounded-lg bg-card border border-border">
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
                  <span className="text-xs text-muted-foreground capitalize">
                    {unit.unit_type.replace(/_/g, " ")}
                  </span>
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

      {/* Log Entry Dialog */}
      <Dialog open={!!selectedUnit} onOpenChange={() => setSelectedUnit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-accent" />
              Log Temperature
            </DialogTitle>
          </DialogHeader>

          {selectedUnit && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-semibold text-foreground">{selectedUnit.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedUnit.area.site.name} · {selectedUnit.area.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Limit: ≤{selectedUnit.temp_limit_high}°F
                  {selectedUnit.temp_limit_low !== null && ` / ≥${selectedUnit.temp_limit_low}°F`}
                </p>
              </div>

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
