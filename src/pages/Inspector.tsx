import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  Eye,
  Download,
  Calendar as CalendarIcon,
  Loader2,
  Thermometer,
  AlertTriangle,
  ClipboardCheck,
  WifiOff,
  Building2,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Site {
  id: string;
  name: string;
  timezone: string;
}

interface Unit {
  id: string;
  name: string;
  unit_type: string;
  temp_limit_high: number;
  temp_limit_low: number | null;
  area: { name: string };
}

interface TemperatureLog {
  id: string;
  unit_id: string;
  unit_name: string;
  temperature: number;
  logged_at: string;
  type: "sensor" | "manual";
  logged_by: string;
  is_in_range: boolean;
  notes?: string;
}

interface ExceptionLog {
  id: string;
  unit_id: string;
  unit_name: string;
  event_type: string;
  details: string;
  temperature?: number;
  severity: string;
  recorded_at: string;
  acknowledged_by?: string;
  action_taken?: string;
}

interface CorrectiveAction {
  id: string;
  unit_id: string;
  unit_name: string;
  action_taken: string;
  root_cause?: string;
  completed_at: string;
  created_by: string;
}

interface MonitoringGap {
  id: string;
  unit_id: string;
  unit_name: string;
  gap_type: string;
  start_at: string;
  end_at?: string;
  duration_minutes: number;
}

const Inspector = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  
  // Filters
  const [sites, setSites] = useState<Site[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  
  // Data
  const [temperatureLogs, setTemperatureLogs] = useState<TemperatureLog[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionLog[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([]);
  const [monitoringGaps, setMonitoringGaps] = useState<MonitoringGap[]>([]);

  useEffect(() => {
    initializeInspector();
  }, [tokenFromUrl]);

  useEffect(() => {
    if (organizationId && selectedSiteId) {
      loadUnits();
    }
  }, [organizationId, selectedSiteId]);

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId, selectedSiteId, selectedUnitId, dateRange]);

  const initializeInspector = async () => {
    try {
      // Check if using token-based access
      if (tokenFromUrl) {
        const { data: session } = await supabase
          .from("inspector_sessions")
          .select("organization_id, expires_at, is_active, allowed_site_ids")
          .eq("token", tokenFromUrl)
          .maybeSingle();

        if (!session || !session.is_active || new Date(session.expires_at) < new Date()) {
          toast.error("Invalid or expired inspector link");
          navigate("/auth");
          return;
        }

        // Update last used
        await supabase
          .from("inspector_sessions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("token", tokenFromUrl);

        setOrganizationId(session.organization_id);
        await loadOrgData(session.organization_id, session.allowed_site_ids);
      } else {
        // Check user auth and inspector role
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!profile?.organization_id) {
          navigate("/onboarding");
          return;
        }

        // Check if user has inspector role or higher
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("organization_id", profile.organization_id)
          .maybeSingle();

        if (!role) {
          toast.error("No access to inspector mode");
          navigate("/");
          return;
        }

        setOrganizationId(profile.organization_id);
        await loadOrgData(profile.organization_id, null);
      }
    } catch (error) {
      console.error("Error initializing inspector:", error);
      toast.error("Failed to load inspector mode");
    }
    setIsLoading(false);
  };

  const loadOrgData = async (orgId: string, allowedSiteIds: string[] | null) => {
    // Get org info
    const { data: org } = await supabase
      .from("organizations")
      .select("name, timezone")
      .eq("id", orgId)
      .maybeSingle();

    if (org) {
      setOrganizationName(org.name);
      setTimezone(org.timezone);
    }

    // Get sites
    let sitesQuery = supabase
      .from("sites")
      .select("id, name, timezone")
      .eq("organization_id", orgId)
      .eq("is_active", true);

    if (allowedSiteIds && allowedSiteIds.length > 0) {
      sitesQuery = sitesQuery.in("id", allowedSiteIds);
    }

    const { data: sitesData } = await sitesQuery;
    setSites(sitesData || []);
  };

  const loadUnits = async () => {
    if (!organizationId) return;

    let query = supabase
      .from("units")
      .select(`
        id, name, unit_type, temp_limit_high, temp_limit_low,
        area:areas!inner(name, site:sites!inner(id, organization_id))
      `)
      .eq("is_active", true);

    const { data } = await query;
    
    const filteredUnits = (data || []).filter((u: any) => {
      if (u.area?.site?.organization_id !== organizationId) return false;
      if (selectedSiteId !== "all" && u.area?.site?.id !== selectedSiteId) return false;
      return true;
    }).map((u: any) => ({
      id: u.id,
      name: u.name,
      unit_type: u.unit_type,
      temp_limit_high: u.temp_limit_high,
      temp_limit_low: u.temp_limit_low,
      area: { name: u.area.name },
    }));

    setUnits(filteredUnits);
  };

  const loadData = async () => {
    if (!organizationId) return;

    const startDate = dateRange.from.toISOString();
    const endDate = dateRange.to.toISOString();

    // Get unit IDs to filter
    const unitIds = selectedUnitId !== "all" 
      ? [selectedUnitId]
      : units.map(u => u.id);

    if (unitIds.length === 0) return;

    // Load sensor readings
    const { data: sensorData } = await supabase
      .from("sensor_readings")
      .select("id, unit_id, temperature, recorded_at")
      .in("unit_id", unitIds)
      .gte("recorded_at", startDate)
      .lte("recorded_at", endDate)
      .order("recorded_at", { ascending: false });

    // Load manual logs
    const { data: manualData } = await supabase
      .from("manual_temperature_logs")
      .select("id, unit_id, temperature, logged_at, logged_by, is_in_range, notes")
      .in("unit_id", unitIds)
      .gte("logged_at", startDate)
      .lte("logged_at", endDate)
      .order("logged_at", { ascending: false });

    // Get user names
    const userIds = [...new Set((manualData || []).map(m => m.logged_by))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const userMap: Record<string, string> = {};
    (profiles || []).forEach(p => {
      userMap[p.user_id] = p.full_name || p.email;
    });

    // Create unit map
    const unitMap: Record<string, Unit> = {};
    units.forEach(u => { unitMap[u.id] = u; });

    // Combine logs
    const logs: TemperatureLog[] = [];
    
    (sensorData || []).forEach(r => {
      const unit = unitMap[r.unit_id];
      if (!unit) return;
      const inRange = r.temperature <= unit.temp_limit_high && 
        (unit.temp_limit_low === null || r.temperature >= unit.temp_limit_low);
      logs.push({
        id: r.id,
        unit_id: r.unit_id,
        unit_name: unit.name,
        temperature: r.temperature,
        logged_at: r.recorded_at,
        type: "sensor",
        logged_by: "Automated",
        is_in_range: inRange,
      });
    });

    (manualData || []).forEach(m => {
      const unit = unitMap[m.unit_id];
      if (!unit) return;
      logs.push({
        id: m.id,
        unit_id: m.unit_id,
        unit_name: unit.name,
        temperature: m.temperature,
        logged_at: m.logged_at,
        type: "manual",
        logged_by: userMap[m.logged_by] || "Unknown",
        is_in_range: m.is_in_range ?? true,
        notes: m.notes || undefined,
      });
    });

    logs.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
    setTemperatureLogs(logs);

    // Load alerts as exceptions
    const { data: alertsData } = await supabase
      .from("alerts")
      .select("id, unit_id, alert_type, title, severity, status, triggered_at, acknowledged_by, acknowledgment_notes")
      .in("unit_id", unitIds)
      .gte("triggered_at", startDate)
      .lte("triggered_at", endDate)
      .order("triggered_at", { ascending: false });

    const exceptions: ExceptionLog[] = (alertsData || []).map(a => {
      const unit = unitMap[a.unit_id];
      return {
        id: a.id,
        unit_id: a.unit_id,
        unit_name: unit?.name || "Unknown",
        event_type: a.alert_type,
        details: a.title,
        severity: a.severity,
        recorded_at: a.triggered_at,
        acknowledged_by: a.acknowledged_by ? userMap[a.acknowledged_by] : undefined,
        action_taken: a.acknowledgment_notes || undefined,
      };
    });
    setExceptions(exceptions);

    // Load corrective actions
    const { data: caData } = await supabase
      .from("corrective_actions")
      .select("id, unit_id, action_taken, root_cause, completed_at, created_by")
      .in("unit_id", unitIds)
      .gte("completed_at", startDate)
      .lte("completed_at", endDate)
      .order("completed_at", { ascending: false });

    const caUserIds = [...new Set((caData || []).map(c => c.created_by))];
    const { data: caProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", caUserIds);

    const caUserMap: Record<string, string> = {};
    (caProfiles || []).forEach(p => {
      caUserMap[p.user_id] = p.full_name || p.email;
    });

    const correctiveActions: CorrectiveAction[] = (caData || []).map(ca => ({
      id: ca.id,
      unit_id: ca.unit_id,
      unit_name: unitMap[ca.unit_id]?.name || "Unknown",
      action_taken: ca.action_taken,
      root_cause: ca.root_cause || undefined,
      completed_at: ca.completed_at,
      created_by: caUserMap[ca.created_by] || "Unknown",
    }));
    setCorrectiveActions(correctiveActions);

    // Load monitoring gaps from event logs
    const { data: gapsData } = await supabase
      .from("event_logs")
      .select("id, unit_id, event_type, event_data, recorded_at")
      .in("unit_id", unitIds)
      .in("event_type", ["unit_state_change", "missed_manual_log"])
      .gte("recorded_at", startDate)
      .lte("recorded_at", endDate)
      .order("recorded_at", { ascending: false });

    const gaps: MonitoringGap[] = (gapsData || [])
      .filter(g => {
        const data = g.event_data as any;
        return data?.to_status === "offline" || 
               data?.to_status === "monitoring_interrupted" ||
               g.event_type === "missed_manual_log";
      })
      .map(g => {
        const data = g.event_data as any;
        return {
          id: g.id,
          unit_id: g.unit_id || "",
          unit_name: unitMap[g.unit_id || ""]?.name || "Unknown",
          gap_type: g.event_type === "missed_manual_log" ? "Missed Manual Log" : `${data.from_status} → ${data.to_status}`,
          start_at: g.recorded_at,
          duration_minutes: data.duration_minutes || 0,
        };
      });
    setMonitoringGaps(gaps);
  };

  const handleQuickDate = (days: number) => {
    const to = endOfDay(new Date());
    const from = startOfDay(subDays(new Date(), days - 1));
    setDateRange({ from, to });
  };

  const handleExport = async (reportType: "daily" | "exceptions") => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("export-temperature-logs", {
        body: {
          site_id: selectedSiteId !== "all" ? selectedSiteId : undefined,
          unit_id: selectedUnitId !== "all" ? selectedUnitId : undefined,
          start_date: dateRange.from.toISOString(),
          end_date: dateRange.to.toISOString(),
          report_type: reportType,
        },
      });

      if (response.error) throw response.error;

      // Add inspector watermark
      let csvContent = response.data as string;
      const watermark = `\n# ──────────────────────────────────────────────────\n# INSPECTOR VIEW – READ-ONLY\n# Generated by FrostGuard\n# Export Timestamp: ${new Date().toISOString()}\n# Timezone: ${timezone}\n# Site: ${selectedSiteId === "all" ? "All Sites" : sites.find(s => s.id === selectedSiteId)?.name || "Unknown"}\n# Unit: ${selectedUnitId === "all" ? "All Units" : units.find(u => u.id === selectedUnitId)?.name || "Unknown"}\n# ──────────────────────────────────────────────────\n`;
      csvContent = csvContent + watermark;

      // Download
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frostguard-inspector-${reportType}-${format(dateRange.from, "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${reportType === "daily" ? "Daily Log" : "Exceptions"} exported`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export report");
    }
    setIsExporting(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Inspector Mode">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Inspector Mode">
      {/* Read-only Badge */}
      <div className="mb-6 flex items-center gap-3">
        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 px-3 py-1 text-sm">
          <Eye className="w-4 h-4 mr-2" />
          Read-Only View
        </Badge>
        <span className="text-sm text-muted-foreground">
          {organizationName} • Timezone: {timezone}
        </span>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Filter Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            {/* Site Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Site</label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Unit</label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Buttons */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Select</label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleQuickDate(1)}>Today</Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickDate(7)}>7 Days</Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickDate(30)}>30 Days</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Tabs */}
      <Tabs defaultValue="daily" className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Daily Log ({temperatureLogs.length})
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Exceptions ({exceptions.length})
            </TabsTrigger>
            <TabsTrigger value="corrective" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Corrective ({correctiveActions.length})
            </TabsTrigger>
            <TabsTrigger value="gaps" className="flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              Gaps ({monitoringGaps.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport("daily")} disabled={isExporting}>
              <Download className="w-4 h-4 mr-2" />
              Export Daily CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport("exceptions")} disabled={isExporting}>
              <Download className="w-4 h-4 mr-2" />
              Export Exceptions CSV
            </Button>
          </div>
        </div>

        {/* Daily Temperature Log */}
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Daily Temperature Log</CardTitle>
              <CardDescription>All temperature readings for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Temp (°F)</TableHead>
                    <TableHead>In Range</TableHead>
                    <TableHead>Logged By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {temperatureLogs.slice(0, 100).map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.logged_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{log.unit_name}</TableCell>
                      <TableCell>
                        <Badge variant={log.type === "manual" ? "default" : "secondary"}>
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{log.temperature.toFixed(1)}°</TableCell>
                      <TableCell>
                        <Badge variant={log.is_in_range ? "outline" : "destructive"}>
                          {log.is_in_range ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.logged_by}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {temperatureLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No temperature logs for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {temperatureLogs.length > 100 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing first 100 of {temperatureLogs.length} records. Export CSV for full data.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exceptions */}
        <TabsContent value="exceptions">
          <Card>
            <CardHeader>
              <CardTitle>Exceptions Only</CardTitle>
              <CardDescription>Alerts and out-of-range readings</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Acknowledged By</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions.map(exc => (
                    <TableRow key={exc.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(exc.recorded_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{exc.unit_name}</TableCell>
                      <TableCell>{exc.event_type}</TableCell>
                      <TableCell>
                        <Badge variant={exc.severity === "critical" ? "destructive" : "secondary"}>
                          {exc.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{exc.details}</TableCell>
                      <TableCell>{exc.acknowledged_by || "-"}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{exc.action_taken || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {exceptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No exceptions for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Corrective Actions */}
        <TabsContent value="corrective">
          <Card>
            <CardHeader>
              <CardTitle>Corrective Actions</CardTitle>
              <CardDescription>Actions taken to address issues</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Root Cause</TableHead>
                    <TableHead>Action Taken</TableHead>
                    <TableHead>Completed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correctiveActions.map(ca => (
                    <TableRow key={ca.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(ca.completed_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{ca.unit_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{ca.root_cause || "-"}</TableCell>
                      <TableCell className="max-w-[300px]">{ca.action_taken}</TableCell>
                      <TableCell>{ca.created_by}</TableCell>
                    </TableRow>
                  ))}
                  {correctiveActions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No corrective actions for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Gaps */}
        <TabsContent value="gaps">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Gaps / Offline Periods</CardTitle>
              <CardDescription>Periods where monitoring was interrupted</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Gap Type</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitoringGaps.map(gap => (
                    <TableRow key={gap.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(gap.start_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{gap.unit_name}</TableCell>
                      <TableCell>{gap.gap_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {gap.duration_minutes > 0 ? `${gap.duration_minutes} min` : "Ongoing"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {monitoringGaps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No monitoring gaps for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer with timezone */}
      <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
        <p>All times shown in {timezone}</p>
        <p className="mt-1">FrostGuard Inspector View • Read-Only</p>
      </div>
    </DashboardLayout>
  );
};

export default Inspector;
