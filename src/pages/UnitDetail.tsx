import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { HierarchyBreadcrumb, BreadcrumbSibling } from "@/components/HierarchyBreadcrumb";
import DeviceReadinessCard from "@/components/unit/DeviceReadinessCard";
import LastKnownGoodCard from "@/components/unit/LastKnownGoodCard";
import UnitSettingsSection from "@/components/unit/UnitSettingsSection";
import UnitAlertsBanner from "@/components/unit/UnitAlertsBanner";
import BatteryHealthCard from "@/components/unit/BatteryHealthCard";
import UnitSensorsCard from "@/components/unit/UnitSensorsCard";
import LogTempModal, { LogTempUnit } from "@/components/LogTempModal";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { usePermissions } from "@/hooks/useUserRole";
import { softDeleteUnit, getActiveChildrenCount } from "@/hooks/useSoftDelete";
import { useLoraSensorsByUnit } from "@/hooks/useLoraSensors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Thermometer,
  Loader2,
  Download,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  FileText,
  Activity,
  ClipboardEdit,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { format } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { computeUnitAlerts, ComputedAlert } from "@/hooks/useUnitAlerts";
import { UnitStatusInfo } from "@/hooks/useUnitStatus";
import { DeviceInfo } from "@/hooks/useSensorInstallationStatus";

interface UnitData {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  last_temp_reading: number | null;
  last_reading_at: string | null;
  last_manual_log_at: string | null;
  manual_log_cadence: number;
  area: { id: string; name: string; site: { id: string; name: string; organization_id: string } };
}

interface SensorReading {
  id: string;
  temperature: number;
  humidity: number | null;
  recorded_at: string;
}

interface ManualLog {
  id: string;
  temperature: number;
  notes: string | null;
  logged_at: string;
  is_in_range: boolean | null;
}

interface EventLog {
  id: string;
  event_type: string;
  event_data: any;
  recorded_at: string;
}

interface UnitAlert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  clearCondition: string;
}

import { STATUS_CONFIG, getStatusConfig } from "@/lib/statusConfig";
import { getAlertClearCondition } from "@/lib/alertConfig";

const UnitDetail = () => {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canDeleteEntities, isLoading: permissionsLoading } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [siblingUnits, setSiblingUnits] = useState<BreadcrumbSibling[]>([]);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [manualLogs, setManualLogs] = useState<ManualLog[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [unitAlerts, setUnitAlerts] = useState<UnitAlert[]>([]);
  const [timeRange, setTimeRange] = useState("24h");
  const [isExporting, setIsExporting] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lastKnownGood, setLastKnownGood] = useState<{
    temp: number | null;
    at: null | string;
    source: "sensor" | "manual" | null;
  }>({ temp: null, at: null, source: null });

  // Fetch LoRa sensors linked to this unit
  const { data: loraSensors } = useLoraSensorsByUnit(unitId || null);
  // Use the first LoRa sensor for DeviceReadinessCard display
  const primaryLoraSensor = loraSensors?.[0] || null;

  const handleDeleteUnit = async () => {
    if (!session?.user?.id || !unitId) return;
    const result = await softDeleteUnit(unitId, session.user.id, true);
    if (result.success && unit) {
      navigate(`/sites/${unit.area.site.id}/areas/${unit.area.id}`);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  useEffect(() => {
    if (unitId) loadUnitData();
  }, [unitId, timeRange]);

  const getTimeRangeDate = () => {
    const now = new Date();
    switch (timeRange) {
      case "1h": return new Date(now.getTime() - 60 * 60 * 1000);
      case "6h": return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  };

  const loadUnitData = async () => {
    setIsLoading(true);
    try {
      // Load unit details including fields needed for alert computation
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, temp_limit_high, temp_limit_low,
          last_temp_reading, last_reading_at, last_manual_log_at, manual_log_cadence,
          notes, door_state, door_last_changed_at, door_sensor_enabled, door_open_grace_minutes,
          area:areas!inner(id, name, site:sites!inner(id, name, organization_id))
        `)
        .eq("id", unitId)
        .maybeSingle();

      if (unitError || !unitData) {
        toast({ title: "Unit not found", variant: "destructive" });
        return;
      }

      setUnit({
        ...unitData,
        last_manual_log_at: unitData.last_manual_log_at,
        manual_log_cadence: unitData.manual_log_cadence,
        area: {
          id: unitData.area.id,
          name: unitData.area.name,
          site: { 
            id: unitData.area.site.id, 
            name: unitData.area.site.name,
            organization_id: unitData.area.site.organization_id,
          },
        },
      });

      // Load sibling units for breadcrumb dropdown
      const { data: siblingsData } = await supabase
        .from("units")
        .select("id, name")
        .eq("area_id", unitData.area.id)
        .eq("is_active", true)
        .neq("id", unitId)
        .order("name");

      if (siblingsData) {
        setSiblingUnits(siblingsData.map(u => ({
          id: u.id,
          name: u.name,
          href: `/units/${u.id}`,
        })));
      }

      const fromDate = getTimeRangeDate().toISOString();

      // Load sensor readings
      const { data: readingsData } = await supabase
        .from("sensor_readings")
        .select("id, temperature, humidity, recorded_at")
        .eq("unit_id", unitId)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: true })
        .limit(500);

      setReadings(readingsData || []);

      // Load manual logs
      const { data: logsData } = await supabase
        .from("manual_temperature_logs")
        .select("id, temperature, notes, logged_at, is_in_range")
        .eq("unit_id", unitId)
        .gte("logged_at", fromDate)
        .order("logged_at", { ascending: false })
        .limit(50);

      setManualLogs(logsData || []);

      // Load events
      const { data: eventsData } = await supabase
        .from("event_logs")
        .select("id, event_type, event_data, recorded_at")
        .eq("unit_id", unitId)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: false })
        .limit(50);

      setEvents(eventsData || []);

      // Fetch device linked to this unit for installation status
      const { data: deviceData } = await supabase
        .from("devices")
        .select("id, unit_id, last_seen_at, serial_number, battery_level, signal_strength, status")
        .eq("unit_id", unitId)
        .maybeSingle();

      if (deviceData) {
        setDevice({
          id: deviceData.id,
          unit_id: deviceData.unit_id,
          last_seen_at: deviceData.last_seen_at,
          serial_number: deviceData.serial_number,
          battery_level: deviceData.battery_level,
          signal_strength: deviceData.signal_strength,
          status: deviceData.status,
        });
      } else {
        setDevice(null);
      }

      // Compute Last Known Good reading
      // Get the most recent valid sensor reading
      const { data: lastValidSensor } = await supabase
        .from("sensor_readings")
        .select("temperature, recorded_at")
        .eq("unit_id", unitId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get the most recent valid manual log
      const { data: lastValidManual } = await supabase
        .from("manual_temperature_logs")
        .select("temperature, logged_at")
        .eq("unit_id", unitId)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Determine which is more recent
      let lkgTemp: number | null = null;
      let lkgAt: string | null = null;
      let lkgSource: "sensor" | "manual" | null = null;

      const sensorTime = lastValidSensor?.recorded_at ? new Date(lastValidSensor.recorded_at).getTime() : 0;
      const manualTime = lastValidManual?.logged_at ? new Date(lastValidManual.logged_at).getTime() : 0;

      if (sensorTime > manualTime && lastValidSensor) {
        lkgTemp = lastValidSensor.temperature;
        lkgAt = lastValidSensor.recorded_at;
        lkgSource = "sensor";
      } else if (lastValidManual) {
        lkgTemp = lastValidManual.temperature;
        lkgAt = lastValidManual.logged_at;
        lkgSource = "manual";
      }

      setLastKnownGood({ temp: lkgTemp, at: lkgAt, source: lkgSource });

      // Use computeUnitAlerts - same source of truth as Alerts Center
      // Build UnitStatusInfo from unit data
      const unitStatusInfo: UnitStatusInfo = {
        id: unitData.id,
        name: unitData.name,
        unit_type: unitData.unit_type,
        status: unitData.status,
        temp_limit_high: unitData.temp_limit_high,
        temp_limit_low: unitData.temp_limit_low,
        manual_log_cadence: unitData.manual_log_cadence,
        last_manual_log_at: unitData.last_manual_log_at,
        last_reading_at: unitData.last_reading_at,
        last_temp_reading: unitData.last_temp_reading,
        area: {
          name: unitData.area.name,
          site: { name: unitData.area.site.name },
        },
      };

      // Compute alerts using the same function as Alerts Center
      const computedSummary = computeUnitAlerts([unitStatusInfo]);
      
      // Map computed alerts to UnitAlert format for the banner
      const bannerAlerts: UnitAlert[] = computedSummary.alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        clearCondition: getAlertClearCondition(a.type),
      }));

      setUnitAlerts(bannerAlerts);
    } catch (error) {
      console.error("Error loading unit:", error);
      toast({ title: "Failed to load unit data", variant: "destructive" });
    }
    setIsLoading(false);
  };

  // getAlertClearCondition is now imported from @/lib/alertConfig

  const exportToCSV = async (reportType: "daily" | "exceptions" = "daily") => {
    if (!unit) return;
    setIsExporting(true);

    try {
      const startDate = getTimeRangeDate().toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase.functions.invoke("export-temperature-logs", {
        body: {
          unit_id: unit.id,
          start_date: startDate,
          end_date: endDate,
          report_type: reportType,
        },
      });

      if (error) throw error;

      // Download the CSV
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frostguard-${reportType}-${unit.name.replace(/\s+/g, "_")}-${startDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: `${reportType === "daily" ? "Daily" : "Exception"} report exported` });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Export failed", variant: "destructive" });
    }
    setIsExporting(false);
  };

  const chartData = readings.map((r) => ({
    time: format(new Date(r.recorded_at), "HH:mm"),
    fullTime: format(new Date(r.recorded_at), "MMM d, HH:mm"),
    temperature: r.temperature,
    humidity: r.humidity,
  }));

  const formatTemp = (temp: number | null) => {
    if (temp === null) return "--";
    return `${temp.toFixed(1)}°F`;
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

  if (!unit) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unit not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const status = STATUS_CONFIG[unit.status] || STATUS_CONFIG.offline;
  const isOnline = Boolean(unit.status !== "offline" && unit.last_reading_at);

  return (
    <DashboardLayout>
      <HierarchyBreadcrumb
        items={[
          { label: "All Equipment", href: "/sites" },
          { label: unit.area.site.name, href: `/sites/${unit.area.site.id}` },
          { label: unit.area.name, href: `/sites/${unit.area.site.id}/areas/${unit.area.id}` },
          { label: unit.name, isCurrentPage: true, siblings: siblingUnits },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1h</SelectItem>
                <SelectItem value="6h">Last 6h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="default"
              className="bg-accent hover:bg-accent/90"
              onClick={() => setModalOpen(true)}
            >
              <ClipboardEdit className="w-4 h-4 mr-2" />
              Log Temp
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportToCSV("daily")} 
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Daily Log
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportToCSV("exceptions")} 
              disabled={isExporting}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Exceptions
            </Button>
            {canDeleteEntities && !permissionsLoading && (
              <Button 
                variant="ghost" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        {/* Alerts Banner - Full Width, Prominent Position */}
        {unitAlerts.length > 0 && (
          <UnitAlertsBanner
            alerts={unitAlerts}
            onLogTemp={() => setModalOpen(true)}
          />
        )}

        {/* Two Column Layout: Chart + Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Temperature Chart (2/3 width) */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent" />
                  Temperature History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="time"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          domain={["auto", "auto"]}
                          tickFormatter={(v) => `${v}°`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelFormatter={(_, payload) => payload[0]?.payload?.fullTime || ""}
                          formatter={(value: number) => [`${value.toFixed(1)}°F`, "Temperature"]}
                        />
                        <ReferenceLine
                          y={unit.temp_limit_high}
                          stroke="hsl(var(--alarm))"
                          strokeDasharray="5 5"
                          label={{ value: `Limit: ${unit.temp_limit_high}°F`, fill: "hsl(var(--alarm))", fontSize: 11 }}
                        />
                        {unit.temp_limit_low !== null && (
                          <ReferenceLine
                            y={unit.temp_limit_low}
                            stroke="hsl(var(--accent))"
                            strokeDasharray="5 5"
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="temperature"
                          stroke="hsl(var(--accent))"
                          fill="url(#tempGradient)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          stroke="hsl(var(--accent))"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "hsl(var(--accent))" }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <p className="text-muted-foreground">No sensor readings in this time period</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Summary Cards (1/3 width) */}
          <div className="space-y-4">
            {/* Current Temperature - Large Display */}
            <Card>
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Current Temperature</p>
                  <div className="flex items-center gap-1">
                    {isOnline ? (
                      <Wifi className="w-4 h-4 text-safe" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground">{isOnline ? "Live" : "Offline"}</span>
                  </div>
                </div>
                <p className={`text-5xl font-bold ${
                  unit.last_temp_reading && unit.last_temp_reading > unit.temp_limit_high
                    ? "text-alarm"
                    : unit.last_temp_reading && unit.temp_limit_low && unit.last_temp_reading < unit.temp_limit_low
                    ? "text-accent"
                    : "text-safe"
                }`}>
                  {formatTemp(unit.last_temp_reading)}
                </p>
                {unit.last_reading_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last reading: {format(new Date(unit.last_reading_at), "MMM d, h:mm a")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Device Status Card */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Device Status</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status.bgColor}`}>
                    <Thermometer className={`w-5 h-5 ${status.color}`} />
                  </div>
                  <div>
                    <Badge className={`${status.bgColor} ${status.color} border-0`}>
                      {status.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {unit.unit_type.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Temperature Limits Card */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Configured Limits</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">High Limit</span>
                    <span className="font-medium text-alarm">{unit.temp_limit_high}°F</span>
                  </div>
                  {unit.temp_limit_low !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Low Limit</span>
                      <span className="font-medium text-accent">{unit.temp_limit_low}°F</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Readings Count Card */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Readings in Period</p>
                <p className="text-3xl font-bold text-foreground">{readings.length}</p>
                <p className="text-xs text-muted-foreground">sensor readings</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Last Known Good Card (shows when offline) */}
        <LastKnownGoodCard
          lastValidTemp={lastKnownGood.temp}
          lastValidAt={lastKnownGood.at}
          source={lastKnownGood.source}
          tempLimitHigh={unit.temp_limit_high}
          tempLimitLow={unit.temp_limit_low}
          isCurrentlyOnline={isOnline}
        />

        {/* Device Readiness */}
        <DeviceReadinessCard
          unitStatus={unit.status}
          lastReadingAt={unit.last_reading_at}
          device={device}
          batteryLevel={device?.battery_level}
          signalStrength={device?.signal_strength}
          lastHeartbeat={device?.last_seen_at}
          deviceSerial={device?.serial_number}
          doorState={(unit as any).door_state}
          doorLastChangedAt={(unit as any).door_last_changed_at}
          loraSensor={primaryLoraSensor}
        />

        {/* Connected LoRa Sensors */}
        {unit.area.site.organization_id && (
          <UnitSensorsCard
            unitId={unit.id}
            organizationId={(unit.area.site as any).organization_id}
            siteId={unit.area.site.id}
          />
        )}

        {/* Battery Health */}
        {device?.id && (
          <BatteryHealthCard deviceId={device.id} />
        )}

        {/* Unit Settings (collapsed by default) */}
        <UnitSettingsSection
          unitId={unit.id}
          unitType={unit.unit_type}
          tempLimitLow={unit.temp_limit_low}
          tempLimitHigh={unit.temp_limit_high}
          notes={(unit as any).notes}
          doorSensorEnabled={(unit as any).door_sensor_enabled}
          doorOpenGraceMinutes={(unit as any).door_open_grace_minutes}
          onSettingsUpdated={loadUnitData}
        />

        {/* Tabs for Manual Logs and Events */}
        <Tabs defaultValue="manual" className="space-y-4">
          <TabsList>
            <TabsTrigger value="manual">
              <FileText className="w-4 h-4 mr-2" />
              Manual Logs ({manualLogs.length})
            </TabsTrigger>
            <TabsTrigger value="events">
              <Clock className="w-4 h-4 mr-2" />
              Events ({events.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            {manualLogs.length > 0 ? (
              <div className="space-y-2">
                {manualLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(log.logged_at), "MMM d, yyyy · h:mm a")}
                        </p>
                        {log.notes && <p className="text-sm mt-1">{log.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${
                          log.is_in_range === false ? "text-alarm" : "text-safe"
                        }`}>
                          {log.temperature}°F
                        </p>
                        {log.is_in_range === false && (
                          <Badge variant="destructive" className="text-xs">Out of range</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No manual logs in this time period</p>
                  <Link to="/manual-log">
                    <Button variant="outline" size="sm" className="mt-2">
                      Log Temperature
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="events">
            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map((event) => (
                  <Card key={event.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground capitalize">
                            {event.event_type.replace(/_/g, " ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(event.recorded_at), "MMM d, yyyy · h:mm a")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Clock className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No events in this time period</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Log Temp Modal */}
        {unit && (
          <LogTempModal
            unit={{
              id: unit.id,
              name: unit.name,
              unit_type: unit.unit_type,
              status: unit.status,
              temp_limit_high: unit.temp_limit_high,
              temp_limit_low: unit.temp_limit_low,
              manual_log_cadence: 14400, // Default 4 hours
              area: unit.area,
            }}
            open={modalOpen}
            onOpenChange={setModalOpen}
            onSuccess={loadUnitData}
            session={session}
          />
        )}

        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          entityName={unit.name}
          entityType="unit"
          onConfirm={handleDeleteUnit}
        />
      </div>
    </DashboardLayout>
  );
};

export default UnitDetail;
