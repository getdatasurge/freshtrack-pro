import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
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

interface UnitData {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  last_temp_reading: number | null;
  last_reading_at: string | null;
  area: { id: string; name: string; site: { id: string; name: string } };
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

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  ok: { color: "text-safe", bgColor: "bg-safe/10", label: "OK" },
  excursion: { color: "text-excursion", bgColor: "bg-excursion/10", label: "Excursion" },
  alarm_active: { color: "text-alarm", bgColor: "bg-alarm/10", label: "ALARM" },
  monitoring_interrupted: { color: "text-warning", bgColor: "bg-warning/10", label: "Interrupted" },
  manual_required: { color: "text-warning", bgColor: "bg-warning/10", label: "Manual Required" },
  restoring: { color: "text-accent", bgColor: "bg-accent/10", label: "Restoring" },
  offline: { color: "text-muted-foreground", bgColor: "bg-muted", label: "Offline" },
};

const UnitDetail = () => {
  const { unitId } = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [manualLogs, setManualLogs] = useState<ManualLog[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [timeRange, setTimeRange] = useState("24h");
  const [isExporting, setIsExporting] = useState(false);

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
      // Load unit details
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, temp_limit_high, temp_limit_low,
          last_temp_reading, last_reading_at,
          area:areas!inner(id, name, site:sites!inner(id, name))
        `)
        .eq("id", unitId)
        .maybeSingle();

      if (unitError || !unitData) {
        toast({ title: "Unit not found", variant: "destructive" });
        return;
      }

      setUnit({
        ...unitData,
        area: {
          id: unitData.area.id,
          name: unitData.area.name,
          site: { id: unitData.area.site.id, name: unitData.area.site.name },
        },
      });

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
    } catch (error) {
      console.error("Error loading unit:", error);
      toast({ title: "Failed to load unit data", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const exportToCSV = async () => {
    if (!unit) return;
    setIsExporting(true);

    try {
      const fromDate = getTimeRangeDate().toISOString();
      
      // Get all readings for export
      const { data: allReadings } = await supabase
        .from("sensor_readings")
        .select("temperature, humidity, recorded_at")
        .eq("unit_id", unitId)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: true });

      const { data: allManualLogs } = await supabase
        .from("manual_temperature_logs")
        .select("temperature, notes, logged_at")
        .eq("unit_id", unitId)
        .gte("logged_at", fromDate)
        .order("logged_at", { ascending: true });

      // Build CSV content
      let csv = "Temperature Log Report\n";
      csv += `Unit: ${unit.name}\n`;
      csv += `Location: ${unit.area.site.name} - ${unit.area.name}\n`;
      csv += `Type: ${unit.unit_type.replace(/_/g, " ")}\n`;
      csv += `Limits: High ${unit.temp_limit_high}°F${unit.temp_limit_low ? `, Low ${unit.temp_limit_low}°F` : ""}\n`;
      csv += `Report Period: ${timeRange}\n`;
      csv += `Generated: ${format(new Date(), "PPpp")}\n\n`;

      csv += "SENSOR READINGS\n";
      csv += "Timestamp,Temperature (°F),Humidity (%)\n";
      (allReadings || []).forEach((r) => {
        csv += `${format(new Date(r.recorded_at), "yyyy-MM-dd HH:mm:ss")},${r.temperature},${r.humidity || ""}\n`;
      });

      csv += "\nMANUAL LOGS\n";
      csv += "Timestamp,Temperature (°F),Notes\n";
      (allManualLogs || []).forEach((l) => {
        csv += `${format(new Date(l.logged_at), "yyyy-MM-dd HH:mm:ss")},${l.temperature},"${(l.notes || "").replace(/"/g, '""')}"\n`;
      });

      // Download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${unit.name.replace(/\s+/g, "_")}_temperature_log_${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Report exported successfully" });
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

  const status = statusConfig[unit.status] || statusConfig.offline;
  const isOnline = unit.status !== "offline" && unit.last_reading_at;

  return (
    <DashboardLayout
      showBack
      backHref={`/sites/${unit.area.site.id}/areas/${unit.area.id}`}
    >
      <div className="space-y-6">
        {/* Unit Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${status.bgColor} flex items-center justify-center`}>
              <Thermometer className={`w-7 h-7 ${status.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{unit.name}</h1>
                <Badge className={`${status.bgColor} ${status.color} border-0`}>
                  {status.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {unit.area.site.name} · {unit.area.name}
              </p>
            </div>
          </div>
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
            <Button variant="outline" onClick={exportToCSV} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Current Temp</p>
              <p className={`text-2xl font-bold ${
                unit.last_temp_reading && unit.last_temp_reading > unit.temp_limit_high
                  ? "text-alarm"
                  : status.color
              }`}>
                {formatTemp(unit.last_temp_reading)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">High Limit</p>
              <p className="text-2xl font-bold text-foreground">{unit.temp_limit_high}°F</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Readings</p>
              <p className="text-2xl font-bold text-foreground">{readings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-1 mt-1">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-safe" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">{isOnline ? "Online" : "Offline"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Temperature Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Temperature History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-72">
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
              <div className="h-72 flex items-center justify-center">
                <p className="text-muted-foreground">No sensor readings in this time period</p>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>
    </DashboardLayout>
  );
};

export default UnitDetail;
