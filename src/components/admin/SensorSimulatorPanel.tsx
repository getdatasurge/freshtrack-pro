import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Play, 
  Square, 
  Zap, 
  Loader2, 
  Thermometer,
  Clock,
  Activity,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  DoorOpen,
  DoorClosed,
  Link2,
  Link2Off,
  RotateCcw,
  AlertTriangle,
  Radio,
  Route,
} from "lucide-react";
import { EmulatorTTNRoutingCard } from "./EmulatorTTNRoutingCard";
import { useTTNConfig } from "@/contexts/TTNConfigContext";
import { TTNConfigSourceBadge } from "@/components/ttn/TTNConfigSourceBadge";
import { TTNGuardDisplay } from "@/components/ttn/TTNGuardDisplay";
import { checkTTNOperationAllowed } from "@/lib/ttn/guards";

interface Unit {
  id: string;
  name: string;
  unit_type: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  last_reading_at: string | null;
  last_temp_reading: number | null;
  door_state: string | null;
  area: {
    name: string;
    site: {
      name: string;
    };
  };
}

interface SimulatedDeviceConfig {
  id: string;
  unit_id: string;
  device_id: string | null;
  is_active: boolean;
  sensor_paired: boolean;
  sensor_online: boolean;
  door_sensor_present: boolean;
  battery_level: number;
  signal_strength: number;
  current_temperature: number;
  current_humidity: number;
  door_state: string;
  door_open_since: string | null;
  streaming_enabled: boolean;
  streaming_interval_seconds: number;
  last_heartbeat_at: string | null;
  door_cycle_enabled: boolean;
  door_cycle_open_seconds: number;
  door_cycle_closed_seconds: number;
}

interface SimulatorEvent {
  id: string;
  event_type: string;
  recorded_at: string;
  event_data: Record<string, unknown>;
}

interface SensorSimulatorPanelProps {
  organizationId: string | null;
}

export function SensorSimulatorPanel({ organizationId }: SensorSimulatorPanelProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<SimulatorEvent[]>([]);
  const [activeTab, setActiveTab] = useState<string>("readings");
  const [routeViaTTN, setRouteViaTTN] = useState(false);
  
  // TTN Config Context for state awareness
  const { context: ttnContext } = useTTNConfig();
  const guardResult = checkTTNOperationAllowed('simulate', ttnContext);
  
  // Simulated device config
  const [config, setConfig] = useState<SimulatedDeviceConfig | null>(null);
  
  // Form state
  const [customTemp, setCustomTemp] = useState<string>("38.0");
  const [customHumidity, setCustomHumidity] = useState<string>("55");
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [signalStrength, setSignalStrength] = useState<number>(-50);
  const [streamingInterval, setStreamingInterval] = useState<string>("60");

  const loadUnits = useCallback(async () => {
    if (!organizationId) {
      setUnits([]);
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Get area IDs for this organization
      // PostgREST can't filter through multiple nested relationships (units->areas->sites->org)
      // so we need to first get area IDs, then filter units by those
      const { data: areasData } = await supabase
        .from("areas")
        .select("id, site:sites!inner(organization_id)")
        .eq("is_active", true)
        .eq("sites.organization_id", organizationId);

      const areaIds = (areasData || []).map(a => a.id);

      if (areaIds.length === 0) {
        setUnits([]);
        setIsLoading(false);
        return;
      }

      // Step 2: Query units filtered by those area IDs
      const { data, error } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, temp_limit_high, temp_limit_low,
          last_reading_at, last_temp_reading, door_state,
          area:areas!inner(name, site:sites!inner(name, organization_id))
        `)
        .in("area_id", areaIds)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;

      const formattedUnits = (data || []).map(u => ({
        id: u.id,
        name: u.name,
        unit_type: u.unit_type,
        temp_limit_high: u.temp_limit_high,
        temp_limit_low: u.temp_limit_low,
        last_reading_at: u.last_reading_at,
        last_temp_reading: u.last_temp_reading,
        door_state: u.door_state,
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
  }, [organizationId]);

  const loadSimConfig = useCallback(async (unitId: string) => {
    try {
      const { data } = await supabase
        .from("simulated_devices")
        .select("*")
        .eq("unit_id", unitId)
        .maybeSingle();

      if (data) {
        setConfig(data as SimulatedDeviceConfig);
        setCustomTemp(String(data.current_temperature));
        setCustomHumidity(String(data.current_humidity));
        setBatteryLevel(data.battery_level);
        setSignalStrength(data.signal_strength);
        setStreamingInterval(String(data.streaming_interval_seconds));
      } else {
        setConfig(null);
      }
    } catch (error) {
      console.error("Error loading sim config:", error);
    }
  }, []);

  const loadRecentEvents = useCallback(async (unitId: string) => {
    try {
      const { data } = await supabase
        .from("event_logs")
        .select("id, event_type, recorded_at, event_data")
        .eq("unit_id", unitId)
        .eq("event_type", "sensor_simulation")
        .order("recorded_at", { ascending: false })
        .limit(8);

      setRecentEvents((data || []) as SimulatorEvent[]);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadUnits();
    }
  }, [organizationId, loadUnits]);

  useEffect(() => {
    if (selectedUnit) {
      loadSimConfig(selectedUnit);
      loadRecentEvents(selectedUnit);
    } else {
      setConfig(null);
      setRecentEvents([]);
    }
  }, [selectedUnit, loadSimConfig, loadRecentEvents]);

  const invokeSimulator = async (action: string, extraParams: Record<string, unknown> = {}) => {
    if (!selectedUnit) {
      toast.error("Please select a unit");
      return;
    }

    setLoadingAction(action);
    try {
      const body = {
        action,
        unit_id: selectedUnit,
        ...extraParams
      };

      const { data, error } = await supabase.functions.invoke("sensor-simulator", { body });

      if (error) throw error;

      toast.success(data.message || `Action ${action} completed`);
      
      // Refresh data
      await Promise.all([
        loadSimConfig(selectedUnit),
        loadRecentEvents(selectedUnit),
        loadUnits()
      ]);
    } catch (error: unknown) {
      console.error("Simulator error:", error);
      toast.error(error instanceof Error ? error.message : "Simulator action failed");
    }
    setLoadingAction(null);
  };

  const handleInjectReading = () => {
    const temp = parseFloat(customTemp);
    const humidity = parseFloat(customHumidity);
    if (isNaN(temp)) {
      toast.error("Please enter a valid temperature");
      return;
    }
    invokeSimulator("inject", { 
      temperature: temp,
      humidity: isNaN(humidity) ? undefined : humidity
    });
  };

  const handleUpdateTelemetry = () => {
    invokeSimulator("update_telemetry", {
      battery_level: batteryLevel,
      signal_strength: signalStrength,
    });
  };

  const handleToggleStreaming = () => {
    if (config?.streaming_enabled) {
      invokeSimulator("stop_streaming");
    } else {
      invokeSimulator("start_streaming", {
        interval_seconds: parseInt(streamingInterval) || 60
      });
    }
  };

  const handleToggleDoorCycle = () => {
    // For now, just toggle door state - full cycle would need additional UI
    const newDoorState = config?.door_state === "open" ? "closed" : "open";
    
    invokeSimulator("set_door_state", { door_state: newDoorState });
  };

  const selectedUnitData = units.find(u => u.id === selectedUnit);

  const getSignalLabel = (strength: number) => {
    if (strength >= -60) return "Excellent";
    if (strength >= -70) return "Good";
    if (strength >= -80) return "Fair";
    return "Weak";
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-500">Developer Tool — Simulated Data Only</p>
          <p className="text-sm text-muted-foreground">
            This simulator injects test data into the production pipeline. Alerts, emails, and compliance records will be real.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Sensor Simulator
            </CardTitle>
            {routeViaTTN && (
              <TTNConfigSourceBadge context={ttnContext} size="sm" />
            )}
          </div>
          <CardDescription>
            Fully simulate hardware installations. All data flows through production ingestion paths.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Unit Selector */}
          <div className="space-y-2">
            <Label>Select Unit</Label>
            {!organizationId ? (
              <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading organization...</p>
              </div>
            ) : units.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No units found</p>
                <p className="text-xs mt-1">Create units in Sites → [Site] → [Area] first.</p>
              </div>
            ) : (
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
            )}
          </div>

          {selectedUnitData && (
            <>
              {/* Unit Info */}
              <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedUnitData.name}</span>
                  <Badge variant="outline">
                    {selectedUnitData.unit_type.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                  <p>High Limit: {selectedUnitData.temp_limit_high}°F</p>
                  {selectedUnitData.temp_limit_low !== null && (
                    <p>Low Limit: {selectedUnitData.temp_limit_low}°F</p>
                  )}
                  <p className="flex items-center gap-1">
                    <Thermometer className="w-3 h-3" />
                    Current: {selectedUnitData.last_temp_reading ?? "—"}°F
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedUnitData.last_reading_at 
                      ? new Date(selectedUnitData.last_reading_at).toLocaleString() 
                      : "Never"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Tabs for Readings vs TTN Routing */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="readings" className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4" />
                    Readings
                  </TabsTrigger>
                  <TabsTrigger value="ttn" className="flex items-center gap-2">
                    <Route className="w-4 h-4" />
                    TTN Routing
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="readings" className="mt-4 space-y-6">

              {/* Device State Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  Device State
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Sensor Paired */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      {config?.sensor_paired ? (
                        <Link2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Link2Off className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">Sensor Paired</span>
                    </div>
                    <Switch
                      checked={config?.sensor_paired ?? false}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          invokeSimulator("pair_sensor");
                        } else {
                          invokeSimulator("unpair_sensor");
                        }
                      }}
                      disabled={loadingAction !== null}
                    />
                  </div>

                  {/* Sensor Online */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      {config?.sensor_online ? (
                        <Wifi className="w-4 h-4 text-green-500" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">Sensor Online</span>
                    </div>
                    <Switch
                      checked={config?.sensor_online ?? false}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          invokeSimulator("set_online");
                        } else {
                          invokeSimulator("set_offline");
                        }
                      }}
                      disabled={loadingAction !== null || !config?.sensor_paired}
                    />
                  </div>

                  {/* Door Sensor Present */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      {config?.door_sensor_present ? (
                        <DoorOpen className="w-4 h-4 text-blue-500" />
                      ) : (
                        <DoorClosed className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">Door Sensor</span>
                    </div>
                    <Switch
                      checked={config?.door_sensor_present ?? false}
                      onCheckedChange={(checked) => {
                        invokeSimulator("update_telemetry", { door_sensor_present: checked });
                      }}
                      disabled={loadingAction !== null || !config?.sensor_paired}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Readings Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Readings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Temperature (°F)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={customTemp}
                      onChange={(e) => setCustomTemp(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Humidity (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={customHumidity}
                      onChange={(e) => setCustomHumidity(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleInjectReading}
                  disabled={loadingAction !== null}
                  className="w-full"
                >
                  {loadingAction === "inject" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Inject Single Reading
                </Button>

                {/* Streaming */}
                <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                  <div className="flex-1 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    <span className="text-sm">Continuous Streaming</span>
                    {config?.streaming_enabled && (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-20"
                      value={streamingInterval}
                      onChange={(e) => setStreamingInterval(e.target.value)}
                      disabled={config?.streaming_enabled}
                    />
                    <span className="text-xs text-muted-foreground">sec</span>
                    <Button
                      size="sm"
                      variant={config?.streaming_enabled ? "destructive" : "secondary"}
                      onClick={handleToggleStreaming}
                      disabled={loadingAction !== null || !config?.sensor_paired}
                    >
                      {config?.streaming_enabled ? (
                        <>
                          <Square className="w-3 h-3 mr-1" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Start
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Telemetry Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Signal className="w-4 h-4" />
                  Telemetry
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Battery className="w-4 h-4" />
                        Battery Level
                      </Label>
                      <span className="text-sm font-medium">{batteryLevel}%</span>
                    </div>
                    <Slider
                      value={[batteryLevel]}
                      onValueChange={(v) => setBatteryLevel(v[0])}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Signal className="w-4 h-4" />
                        Signal Strength
                      </Label>
                      <span className="text-sm font-medium">{signalStrength} dBm ({getSignalLabel(signalStrength)})</span>
                    </div>
                    <Slider
                      value={[signalStrength]}
                      onValueChange={(v) => setSignalStrength(v[0])}
                      min={-100}
                      max={-30}
                      step={1}
                    />
                  </div>
                </div>

                <Button
                  variant="secondary"
                  onClick={handleUpdateTelemetry}
                  disabled={loadingAction !== null || !config?.sensor_paired}
                  className="w-full"
                >
                  {loadingAction === "update_telemetry" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Apply Telemetry
                </Button>
              </div>

              {/* Door Sensor Section */}
              {config?.door_sensor_present && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <DoorOpen className="w-4 h-4" />
                      Door Sensor
                    </h3>

                    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Door State: {config.door_state === "open" ? "Open" : "Closed"}
                        </p>
                        {config.door_state === "open" && config.door_open_since && (
                          <p className="text-xs text-muted-foreground">
                            Open since {new Date(config.door_open_since).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleToggleDoorCycle}
                        disabled={loadingAction !== null}
                      >
                        {config.door_state === "open" ? (
                          <>
                            <DoorClosed className="w-4 h-4 mr-2" />
                            Close Door
                          </>
                        ) : (
                          <>
                            <DoorOpen className="w-4 h-4 mr-2" />
                            Open Door
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Quick Actions */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => invokeSimulator("reset")}
                    disabled={loadingAction !== null}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const excursionTemp = selectedUnitData.temp_limit_high + 5;
                      setCustomTemp(String(excursionTemp));
                      invokeSimulator("inject", { temperature: excursionTemp });
                    }}
                    disabled={loadingAction !== null}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Excursion
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => invokeSimulator("set_offline")}
                    disabled={loadingAction !== null || !config?.sensor_online}
                  >
                    <WifiOff className="w-3 h-3 mr-1" />
                    Go Offline
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBatteryLevel(15);
                      invokeSimulator("update_telemetry", { battery_level: 15 });
                    }}
                    disabled={loadingAction !== null || !config?.sensor_paired}
                  >
                    <Battery className="w-3 h-3 mr-1" />
                    Low Battery
                  </Button>
                </div>
              </div>
                </TabsContent>

                <TabsContent value="ttn" className="mt-4">
                  <EmulatorTTNRoutingCard
                    organizationId={organizationId}
                    selectedUnitId={selectedUnit}
                    emulatorDevEui={config?.device_id || undefined}
                    onRoutingModeChange={setRouteViaTTN}
                  />
                </TabsContent>
              </Tabs>
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
              {recentEvents.map((event) => {
                const eventData = event.event_data as Record<string, unknown>;
                return (
                  <div 
                    key={event.id} 
                    className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {String(eventData.action || "unknown")}
                      </Badge>
                      {eventData.temperature !== undefined && (
                        <span className="text-muted-foreground">
                          {String(eventData.temperature)}°F
                        </span>
                      )}
                      {eventData.serial_number && (
                        <span className="text-muted-foreground text-xs">
                          {String(eventData.serial_number)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.recorded_at).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
