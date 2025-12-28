import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Play, 
  Square, 
  Zap, 
  Loader2, 
  Thermometer,
  Clock,
  Activity
} from "lucide-react";

interface Unit {
  id: string;
  name: string;
  unit_type: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  last_reading_at: string | null;
  area: {
    name: string;
    site: {
      name: string;
    };
  };
}

interface SimulatorEvent {
  id: string;
  event_type: string;
  recorded_at: string;
  event_data: Record<string, unknown>;
}

export function SensorSimulatorPanel() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [customTemp, setCustomTemp] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<SimulatorEvent[]>([]);

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    if (selectedUnit) {
      loadRecentEvents(selectedUnit);
    }
  }, [selectedUnit]);

  const loadUnits = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, temp_limit_high, temp_limit_low, last_reading_at,
          area:areas(name, site:sites(name))
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const formattedUnits = (data || []).map(u => ({
        id: u.id,
        name: u.name,
        unit_type: u.unit_type,
        temp_limit_high: u.temp_limit_high,
        temp_limit_low: u.temp_limit_low,
        last_reading_at: u.last_reading_at,
        area: {
          name: u.area?.name || "",
          site: { name: u.area?.site?.name || "" }
        }
      }));
      setUnits(formattedUnits);
    } catch (error) {
      console.error("Error loading units:", error);
      toast.error("Failed to load units");
    }
    setIsLoading(false);
  };

  const loadRecentEvents = async (unitId: string) => {
    try {
      const { data } = await supabase
        .from("event_logs")
        .select("id, event_type, recorded_at, event_data")
        .eq("unit_id", unitId)
        .in("event_type", ["simulator_start", "simulator_stop", "simulator_inject", "sensor_reading_ingested"])
        .order("recorded_at", { ascending: false })
        .limit(5);

      setRecentEvents((data || []) as SimulatorEvent[]);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };

  const invokeSimulator = async (action: "start" | "stop" | "inject", temperature?: number) => {
    if (!selectedUnit) {
      toast.error("Please select a unit");
      return;
    }

    setLoadingAction(action);
    try {
      const body: Record<string, unknown> = {
        action,
        unit_id: selectedUnit
      };

      if (action === "inject" && temperature !== undefined) {
        body.temperature = temperature;
      }

      const { data, error } = await supabase.functions.invoke("sensor-simulator", {
        body
      });

      if (error) throw error;

      const messages = {
        start: "Simulation started - 5 readings injected",
        stop: "Simulation stopped - unit marked offline",
        inject: `Reading injected: ${temperature}°F`
      };

      toast.success(messages[action]);
      loadRecentEvents(selectedUnit);
      loadUnits(); // Refresh unit status
    } catch (error: unknown) {
      console.error("Simulator error:", error);
      toast.error(error instanceof Error ? error.message : "Simulator action failed");
    }
    setLoadingAction(null);
  };

  const handleInject = () => {
    const temp = parseFloat(customTemp);
    if (isNaN(temp)) {
      toast.error("Please enter a valid temperature");
      return;
    }
    invokeSimulator("inject", temp);
  };

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Sensor Simulator
          </CardTitle>
          <CardDescription>
            Test compliance logic by simulating sensor readings. Start/stop simulations or inject specific temperatures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Unit Selector */}
          <div className="space-y-2">
            <Label>Select Unit</Label>
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a unit to simulate..." />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name} ({unit.area.site.name} / {unit.area.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUnitData && (
            <>
              {/* Unit Info */}
              <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedUnitData.name}</span>
                  <Badge variant="outline">
                    {selectedUnitData.unit_type.replace("_", " ")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>High Limit: {selectedUnitData.temp_limit_high}°F</p>
                  {selectedUnitData.temp_limit_low !== null && (
                    <p>Low Limit: {selectedUnitData.temp_limit_low}°F</p>
                  )}
                  <p className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last Reading: {selectedUnitData.last_reading_at 
                      ? new Date(selectedUnitData.last_reading_at).toLocaleString() 
                      : "Never"}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={() => invokeSimulator("start")}
                  disabled={loadingAction !== null}
                  className="flex items-center gap-2"
                >
                  {loadingAction === "start" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Start Simulation
                </Button>
                <Button
                  onClick={() => invokeSimulator("stop")}
                  disabled={loadingAction !== null}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  {loadingAction === "stop" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  Stop (Go Offline)
                </Button>
              </div>

              {/* Custom Temperature Injection */}
              <div className="space-y-2">
                <Label>Inject Custom Temperature</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Thermometer className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 42.5"
                      value={customTemp}
                      onChange={(e) => setCustomTemp(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleInject}
                    disabled={loadingAction !== null || !customTemp}
                    variant="secondary"
                  >
                    {loadingAction === "inject" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span className="ml-2">Inject</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Inject a reading above {selectedUnitData.temp_limit_high}°F to trigger an excursion
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Simulator Events */}
      {selectedUnit && recentEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Simulator Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {event.event_type.replace(/_/g, " ")}
                    </Badge>
                    {event.event_data?.temperature && (
                      <span className="text-muted-foreground">
                        {String(event.event_data.temperature)}°F
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.recorded_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
