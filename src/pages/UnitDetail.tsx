import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEntityDashboardUrl } from "@/hooks/useEntityDashboardUrl";
import { supabase } from "@/integrations/supabase/client";
import { invalidateUnitCaches } from "@/lib/unitCacheInvalidation";
import DashboardLayout from "@/components/DashboardLayout";
import { HierarchyBreadcrumb, BreadcrumbSibling } from "@/components/HierarchyBreadcrumb";
import DeviceReadinessCard from "@/components/unit/DeviceReadinessCard";
import LastKnownGoodCard from "@/components/unit/LastKnownGoodCard";
import UnitSettingsSection from "@/components/unit/UnitSettingsSection";
import UnitAlertThresholdsSection from "@/components/unit/UnitAlertThresholdsSection";
import UnitAlertsBanner from "@/components/unit/UnitAlertsBanner";
import BatteryHealthCard from "@/components/unit/BatteryHealthCard";
import UnitSensorsCard from "@/components/unit/UnitSensorsCard";
import LogTempModal, { LogTempUnit } from "@/components/LogTempModal";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { LayoutHeaderDropdown } from "@/components/LayoutHeaderDropdown";
import { usePermissions } from "@/hooks/useUserRole";
import { softDeleteUnit, getActiveChildrenCount } from "@/hooks/useSoftDelete";
import { useLoraSensorsByUnit } from "@/hooks/useLoraSensors";
import { EntityDashboard } from "@/features/dashboard-layout";
import { UnitDebugBanner } from "@/components/debug";
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
  Copy,
  Settings,
  LayoutDashboard,
  History,
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
import { UnitStatusInfo, computeUnitStatus, ComputedUnitStatus } from "@/hooks/useUnitStatus";
import { DeviceInfo } from "@/hooks/useSensorInstallationStatus";
import { useUnitAlertRules, DEFAULT_ALERT_RULES, AlertRules } from "@/hooks/useAlertRules";

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
  door_state?: "open" | "closed" | "unknown" | null;
  door_last_changed_at?: string | null;
  door_sensor_enabled?: boolean;
  door_open_grace_minutes?: number;
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
  const { layoutKey } = useEntityDashboardUrl();
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
  
  // Realtime connection tracking + polling fallback
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  
  // State for last error tracking (for debug banner)
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Refresh tick counter - increments on realtime events to trigger widget re-fetches
  const [refreshTick, setRefreshTick] = useState(0);

  // Fetch LoRa sensors linked to this unit
  const { data: loraSensors } = useLoraSensorsByUnit(unitId || null);
  
  // Fetch the effective alert rules for this unit (uses hierarchical cascade: unit → site → org → default)
  const { data: alertRules } = useUnitAlertRules(unitId || null);
  
  // Select primary sensor: prefer is_primary flag, then most recent temperature sensor
  const primaryLoraSensor = useMemo(() => {
    if (!loraSensors?.length) return null;
    
    const primary = loraSensors.find(s => s.is_primary);
    if (primary) return primary;
    
    const tempSensors = loraSensors.filter(s => 
      s.sensor_type === 'temperature' || 
      s.sensor_type === 'temperature_humidity' || 
      s.sensor_type === 'combo'
    );
    if (tempSensors.length) {
      return tempSensors.sort((a, b) => 
        new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime()
      )[0];
    }
    
    return loraSensors[0];
  }, [loraSensors]);
  
  // Find door sensor linked to this unit
  const doorSensor = useMemo(() => 
    loraSensors?.find(s => s.sensor_type === 'door' || s.sensor_type === 'contact') || null,
    [loraSensors]
  );
  
  // State for door reading derived from sensor_readings
  const [derivedDoorState, setDerivedDoorState] = useState<{
    doorOpen: boolean | null;
    recordedAt: string | null;
  }>({ doorOpen: null, recordedAt: null });
  
  // Fetch latest door reading from sensor_readings when we have a door sensor
  useEffect(() => {
    if (!doorSensor?.id) {
      setDerivedDoorState({ doorOpen: null, recordedAt: null });
      return;
    }
    
    const fetchDoorReading = async () => {
      const { data } = await supabase
        .from('sensor_readings')
        .select('door_open, recorded_at')
        .eq('lora_sensor_id', doorSensor.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setDerivedDoorState({
          doorOpen: data.door_open,
          recordedAt: data.recorded_at,
        });
      }
    };
    
    fetchDoorReading();
  }, [doorSensor?.id]);

  const handleDeleteUnit = async () => {
    if (!session?.user?.id || !unitId) return;
    const result = await softDeleteUnit(unitId, session.user.id, true);
    if (result.success && unit) {
      navigate(`/sites/${unit.area.site.id}/areas/${unit.area.id}`);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      
      // STEP 1: Auth proof logging
      const DEV = import.meta.env.DEV;
      DEV && console.log('[AUTH]', { 
        hasSession: !!session, 
        uid: session?.user?.id 
      });
      
      // RLS verification query
      if (session) {
        const { data: profileCheck, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
        DEV && console.log('[AUTH] RLS check', { 
          success: !!profileCheck?.length, 
          error: profileError?.message 
        });
      }
    });
  }, []);

  // Persist last viewed unit for quick access from Units page
  useEffect(() => {
    if (unitId) {
      localStorage.setItem("lastViewedUnitId", unitId);
    }
  }, [unitId]);

  useEffect(() => {
    if (unitId) loadUnitData();
  }, [unitId, timeRange]);

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Reusable function to fetch fresh unit header data (door state, last reading, etc.)
  const fetchUnitHeader = async (id: string): Promise<UnitData | null> => {
    const { data, error } = await supabase
      .from("units")
      .select(`
        id, name, unit_type, status, temp_limit_high, temp_limit_low,
        last_temp_reading, last_reading_at, last_manual_log_at, manual_log_cadence,
        notes, door_state, door_last_changed_at, door_sensor_enabled, door_open_grace_minutes,
        area:areas!inner(id, name, site:sites!inner(id, name, organization_id))
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("[fetchUnitHeader] error:", error);
      return null;
    }

    console.log(`[fetchUnitHeader] door_state=${data.door_state} door_last_changed_at=${data.door_last_changed_at} last_reading_at=${data.last_reading_at} last_temp_reading=${data.last_temp_reading}`);

    return {
      ...data,
      last_manual_log_at: data.last_manual_log_at,
      manual_log_cadence: data.manual_log_cadence,
      door_state: data.door_state as "open" | "closed" | "unknown" | null | undefined,
      door_last_changed_at: data.door_last_changed_at,
      door_sensor_enabled: data.door_sensor_enabled,
      door_open_grace_minutes: data.door_open_grace_minutes,
      area: {
        id: data.area.id,
        name: data.area.name,
        site: {
          id: data.area.site.id,
          name: data.area.site.name,
          organization_id: data.area.site.organization_id,
        },
      },
    };
  };

  const DEV = import.meta.env.DEV;

  // Silent background refresh - updates data WITHOUT showing loading state
  const refreshUnitData = async () => {
    if (!unitId) return;
    
    DEV && console.log(`[REFRESH] start unitId=${unitId}`);
    
    try {
      // Fetch fresh unit header (door_state, last_reading_at, etc.) - REPLACE, don't merge
      const freshUnit = await fetchUnitHeader(unitId);
      if (freshUnit) {
        console.log(`[REFRESH] header door_state=${freshUnit.door_state} door_last_changed_at=${freshUnit.door_last_changed_at} last_reading_at=${freshUnit.last_reading_at}`);
        setUnit(freshUnit);
        
        // Update lastKnownGood if we have a newer reading
        if (freshUnit.last_temp_reading !== null && freshUnit.last_reading_at) {
          setLastKnownGood(prev => {
            const newTime = new Date(freshUnit.last_reading_at!).getTime();
            const prevTime = prev.at ? new Date(prev.at).getTime() : 0;
            if (newTime > prevTime) {
              return { temp: freshUnit.last_temp_reading, at: freshUnit.last_reading_at, source: "sensor" };
            }
            return prev;
          });
        }
      }

      // Fetch latest sensor reading to update readings array
      const { data: latestReading } = await supabase
        .from("sensor_readings")
        .select("id, temperature, humidity, recorded_at")
        .eq("unit_id", unitId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestReading) {
        setReadings(prev => {
          if (prev.some(r => r.id === latestReading.id)) return prev;
          const fromDate = getTimeRangeDate();
          const updated = [...prev, latestReading]
            .filter(r => new Date(r.recorded_at) >= fromDate)
            .slice(-500);
          return updated;
        });
      }

      // Fetch door sensor reading if available
      if (doorSensor?.id) {
        const { data: doorReading } = await supabase
          .from("sensor_readings")
          .select("door_open, recorded_at")
          .eq("lora_sensor_id", doorSensor.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (doorReading) {
          setDerivedDoorState({
            doorOpen: doorReading.door_open,
            recordedAt: doorReading.recorded_at,
          });
        }
      }

      DEV && console.log(`[REFRESH] done door_state=${freshUnit?.door_state} door_last_changed_at=${freshUnit?.door_last_changed_at} last_reading_at=${freshUnit?.last_reading_at} last_temp_reading=${freshUnit?.last_temp_reading}`);
    } catch (error) {
      console.error("[REFRESH] failed:", error);
    }
  };

  // Tab visibility tracking for polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      console.log(`[TAB] visibility=${visible ? 'visible' : 'hidden'}`);
      setIsTabVisible(visible);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Realtime subscription for sensor_readings with connection tracking
  useEffect(() => {
    if (!unitId) return;
    
    setRealtimeConnected(false);
    console.log(`[RT] subscribing unit-readings-${unitId} filter=unit_id=eq.${unitId}`);
    
    const channel = supabase
      .channel(`unit-readings-${unitId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `unit_id=eq.${unitId}`,
        },
        (payload) => {
          console.log(`[RT] sensor_readings INSERT payload id=${payload.new?.id} unit_id=${payload.new?.unit_id} recorded_at=${payload.new?.recorded_at}`);
          refreshUnitData();
          invalidateUnitCaches(queryClient, unitId);
          
          // Increment refreshTick to trigger widget re-fetches (e.g., DoorActivityWidget)
          setRefreshTick(prev => prev + 1);
          DEV && console.log('[RT] incremented refreshTick for door widget re-fetch');
        }
      )
      .subscribe((status) => {
        console.log(`[RT] subscribed status=${status}`);
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeConnected(false);
        }
      });

    // Timeout warning if not connected in 2s
    const timeoutId = setTimeout(() => {
      setRealtimeConnected(prev => {
        if (!prev) {
          console.log(`[RT] Connection timeout after 2s - polling fallback will activate`);
        }
        return prev;
      });
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [unitId, queryClient, unit, doorSensor?.id]);

  // Polling fallback when realtime not connected AND tab visible
  useEffect(() => {
    if (!unitId || realtimeConnected || !isTabVisible) {
      return;
    }
    
    DEV && console.warn(`[RT] realtime not subscribed; starting polling fallback 15s`);
    
    const interval = setInterval(() => {
      DEV && console.log(`[POLL] tick - refreshing unitId=${unitId}`);
      refreshUnitData();
      invalidateUnitCaches(queryClient, unitId);
    }, 15000);

    return () => {
      DEV && console.log(`[POLL] Stopping polling`);
      clearInterval(interval);
    };
  }, [unitId, realtimeConnected, isTabVisible]);

  // Realtime subscription for lora_sensors
  useEffect(() => {
    if (!unitId) return;
    
    const channel = supabase
      .channel(`unit-lora-sensors-${unitId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lora_sensors',
          filter: `unit_id=eq.${unitId}`,
        },
        () => {
          queryClient.invalidateQueries({ 
            queryKey: ['lora-sensors-by-unit', unitId] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId, queryClient]);

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
    const DEV_LOAD = import.meta.env.DEV;
    try {
      // Use shared fetchUnitHeader for consistent unit data
      const unitData = await fetchUnitHeader(unitId!);

      if (!unitData) {
        toast({ title: "Unit not found", variant: "destructive" });
        return;
      }

      // STEP 2: Unit load proof logging
      DEV_LOAD && console.log('[UNIT LOAD]', {
        unitId: unitData.id,
        orgId: unitData.area?.site?.organization_id,
        siteId: unitData.area?.site?.id,
        areaId: unitData.area?.id,
        door_state: unitData.door_state,
        door_last_changed_at: unitData.door_last_changed_at,
      });

      setUnit(unitData);

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

      const { data: readingsData, error: readingsError } = await supabase
        .from("sensor_readings")
        .select("id, temperature, humidity, recorded_at")
        .eq("unit_id", unitId)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: true })
        .limit(500);

      // STEP 3: Telemetry query proof logging
      DEV_LOAD && console.log('[READINGS]', {
        unitId,
        fromDate,
        rows: readingsData?.length ?? 0,
        first: readingsData?.[0],
        last: readingsData?.[readingsData.length - 1],
        error: readingsError?.message,
      });

      // Also run a simple all-time check to verify data exists
      const { data: allTimeCheck } = await supabase
        .from('sensor_readings')
        .select('id, recorded_at')
        .eq('unit_id', unitId)
        .order('recorded_at', { ascending: false })
        .limit(5);
      DEV_LOAD && console.log('[READINGS] all-time check', { count: allTimeCheck?.length ?? 0 });

      setReadings(readingsData || []);

      const { data: logsData } = await supabase
        .from("manual_temperature_logs")
        .select("id, temperature, notes, logged_at, is_in_range")
        .eq("unit_id", unitId)
        .gte("logged_at", fromDate)
        .order("logged_at", { ascending: false })
        .limit(50);

      setManualLogs(logsData || []);

      const { data: eventsData } = await supabase
        .from("event_logs")
        .select("id, event_type, event_data, recorded_at")
        .eq("unit_id", unitId)
        .gte("recorded_at", fromDate)
        .order("recorded_at", { ascending: false })
        .limit(50);

      setEvents(eventsData || []);

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
      const { data: lastValidSensor } = await supabase
        .from("sensor_readings")
        .select("temperature, recorded_at")
        .eq("unit_id", unitId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: lastValidManual } = await supabase
        .from("manual_temperature_logs")
        .select("temperature, logged_at")
        .eq("unit_id", unitId)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();

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

      // Compute alerts
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

      const computedSummary = computeUnitAlerts([unitStatusInfo]);
      
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

  const exportToCSV = async (reportType: "daily" | "exceptions" = "daily") => {
    if (!unit) return;
    setIsExporting(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast({ title: "Session expired. Please sign in again.", variant: "destructive" });
        navigate("/auth");
        return;
      }

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

  const formatTemp = (temp: number | null) => {
    if (temp === null) return "--";
    return `${temp.toFixed(1)}°F`;
  };

  const effectiveRules: AlertRules = alertRules || DEFAULT_ALERT_RULES;

  const unitStatusInfo: UnitStatusInfo | null = useMemo(() => {
    if (!unit) return null;
    return {
      id: unit.id,
      name: unit.name,
      unit_type: unit.unit_type,
      status: unit.status,
      temp_limit_high: unit.temp_limit_high,
      temp_limit_low: unit.temp_limit_low,
      manual_log_cadence: unit.manual_log_cadence,
      last_manual_log_at: unit.last_manual_log_at,
      last_reading_at: unit.last_reading_at,
      last_temp_reading: unit.last_temp_reading,
      last_checkin_at: primaryLoraSensor?.last_seen_at || unit.last_reading_at,
      checkin_interval_minutes: effectiveRules.expected_reading_interval_seconds / 60,
      area: { name: unit.area.name, site: { name: unit.area.site.name } },
    };
  }, [unit, primaryLoraSensor?.last_seen_at, effectiveRules.expected_reading_interval_seconds]);

  const computedStatus: ComputedUnitStatus | null = useMemo(() => {
    if (!unitStatusInfo) return null;
    return computeUnitStatus(unitStatusInfo, effectiveRules);
  }, [unitStatusInfo, effectiveRules]);

  // Derived status - SINGLE SOURCE OF TRUTH
  const derivedStatus = useMemo(() => {
    const now = Date.now();
    
    const lastSeenAt = primaryLoraSensor?.last_seen_at || null;
    const lastReadingAtVal = unit?.last_reading_at || null;
    const effectiveLastCheckin = lastSeenAt || lastReadingAtVal;
    
    const lastSeenAgeSec = effectiveLastCheckin 
      ? Math.floor((now - new Date(effectiveLastCheckin).getTime()) / 1000) 
      : null;
    const lastReadingAgeSec = lastReadingAtVal 
      ? Math.floor((now - new Date(lastReadingAtVal).getTime()) / 1000) 
      : null;
    
    const sensorId = primaryLoraSensor?.id || device?.id || null;
    
    const offlineSeverity = computedStatus?.offlineSeverity ?? "critical";
    const isOnline = offlineSeverity === "none";
    const missedCheckins = computedStatus?.missedCheckins ?? 999;
    
    let statusLabel: string;
    let statusColor: string;
    let statusBgColor: string;
    
    if (isOnline) {
      statusLabel = computedStatus?.statusLabel ?? "OK";
      statusColor = computedStatus?.statusColor ?? "text-safe";
      statusBgColor = computedStatus?.statusBgColor ?? "bg-safe/10";
    } else if (offlineSeverity === "warning") {
      statusLabel = "Offline";
      statusColor = "text-warning";
      statusBgColor = "bg-warning/10";
    } else {
      statusLabel = "Offline";
      statusColor = "text-alarm";
      statusBgColor = "bg-alarm/10";
    }
    
    return {
      sensorId,
      isOnline,
      status: isOnline ? "online" : offlineSeverity === "warning" ? "offline_warning" : "offline_critical",
      statusLabel,
      statusColor,
      statusBgColor,
      offlineSeverity,
      missedCheckins,
      lastSeenAt,
      lastSeenAgeSec,
      lastReadingAt: lastReadingAtVal,
      lastReadingAgeSec,
      checkinIntervalMinutes: effectiveRules.expected_reading_interval_seconds / 60,
      sources: {
        primaryLoraSensorId: primaryLoraSensor?.id || null,
        loraSensorLastSeenAt: primaryLoraSensor?.last_seen_at || null,
        deviceId: device?.id || null,
        unitLastReadingAt: unit?.last_reading_at || null,
        computedOnline: computedStatus?.sensorOnline ?? null,
      },
    };
  }, [
    unit?.last_reading_at,
    primaryLoraSensor?.last_seen_at,
    primaryLoraSensor?.id,
    device?.id,
    computedStatus,
    effectiveRules.expected_reading_interval_seconds,
  ]);

  if (isLoading && !unit) {
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    <DashboardLayout>
      {/* STEP 0: UnitDebugBanner - DEV ONLY diagnostic banner */}
      {DEV && (
        <UnitDebugBanner
          session={session}
          unitId={unitId}
          orgId={unit.area.site.organization_id}
          siteId={unit.area.site.id}
          areaId={unit.area.id}
          readingsCount={readings.length}
          sensorsCount={loraSensors?.length ?? 0}
          doorState={unit.door_state}
          realtimeConnected={realtimeConnected}
          lastError={lastError}
        />
      )}
      {/* Route indicator for debugging/verification */}
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <span className="font-mono bg-muted px-2 py-0.5 rounded">/units/{unitId}{layoutKey !== 'default' ? `/layout/${layoutKey}` : ''}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5"
          onClick={handleCopyLink}
        >
          <Copy className="w-3 h-3" />
        </Button>
        {DEV && (
          <Button
            variant="outline"
            size="sm"
            className="h-5 px-2 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-300"
            onClick={() => {
              console.log('[SMOKE] manual refresh triggered');
              refreshUnitData();
              invalidateUnitCaches(queryClient, unitId!);
            }}
          >
            🔄 Simulate Update (DEV)
          </Button>
        )}
      </div>
      <HierarchyBreadcrumb
        items={[
          { label: "All Equipment", href: "/units" },
          { label: unit.area.site.name, href: `/sites/${unit.area.site.id}` },
          { label: unit.area.name, href: `/sites/${unit.area.site.id}/areas/${unit.area.id}` },
          { label: unit.name, isCurrentPage: true, siblings: siblingUnits },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Layout Selector Dropdown */}
            <LayoutHeaderDropdown
              entityType="unit"
              entityId={unitId!}
              organizationId={unit.area.site.organization_id}
              currentLayoutKey={layoutKey}
            />
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

      {/* Tab-based layout */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab - Customizable Grid */}
        <TabsContent value="dashboard" className="space-y-4">
          <EntityDashboard
            entityType="unit"
            entityId={unitId!}
            organizationId={unit.area.site.organization_id}
            siteId={unit.area.site.id}
            unit={{
              id: unit.id,
              name: unit.name,
              unit_type: unit.unit_type,
              temp_limit_high: unit.temp_limit_high,
              temp_limit_low: unit.temp_limit_low,
              last_temp_reading: unit.last_temp_reading,
              last_reading_at: unit.last_reading_at,
              door_state: unit.door_state,
              door_last_changed_at: unit.door_last_changed_at,
            }}
            sensor={primaryLoraSensor ? {
              id: primaryLoraSensor.id,
              name: primaryLoraSensor.name,
              last_seen_at: primaryLoraSensor.last_seen_at,
              battery_level: primaryLoraSensor.battery_level,
              signal_strength: primaryLoraSensor.signal_strength,
              status: primaryLoraSensor.status,
              sensor_type: primaryLoraSensor.sensor_type,
            } : undefined}
            readings={readings}
            derivedStatus={derivedStatus}
            alerts={unitAlerts}
            loraSensors={loraSensors?.map(s => ({
              id: s.id,
              name: s.name,
              battery_level: s.battery_level,
              signal_strength: s.signal_strength,
              last_seen_at: s.last_seen_at,
              status: s.status,
            })) || []}
            lastKnownGood={lastKnownGood}
            onLogTemp={() => setModalOpen(true)}
            refreshTick={refreshTick}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Unit Settings */}
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

          {/* Alert Thresholds */}
          <UnitAlertThresholdsSection
            unitId={unit.id}
            siteId={unit.area.site.id}
            onSettingsUpdated={loadUnitData}
          />

          {/* Connected LoRa Sensors */}
          {unit.area.site.organization_id && (
            <UnitSensorsCard
              unitId={unit.id}
              organizationId={(unit.area.site as any).organization_id}
              siteId={unit.area.site.id}
              doorState={(unit as any).door_state}
              doorLastChangedAt={(unit as any).door_last_changed_at}
            />
          )}

          {/* Battery Health */}
          {device?.id && (
            <BatteryHealthCard deviceId={device.id} />
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {/* Time Range Selector for History */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Event History</h3>
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
          </div>

          {/* Sub-tabs for Manual Logs and Events */}
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setModalOpen(true)}
                    >
                      Log Temperature
                    </Button>
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
        </TabsContent>
      </Tabs>

      {/* Log Temp Modal */}
      {unit && session && (
        <LogTempModal
          unit={{
            id: unit.id,
            name: unit.name,
            unit_type: unit.unit_type,
            status: unit.status,
            temp_limit_high: unit.temp_limit_high,
            temp_limit_low: unit.temp_limit_low,
            manual_log_cadence: 14400,
            area: unit.area,
          }}
          session={session}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSuccess={loadUnitData}
        />
      )}

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        entityType="unit"
        entityName={unit.name}
        onConfirm={handleDeleteUnit}
      />
    </DashboardLayout>
  );
};

export default UnitDetail;
