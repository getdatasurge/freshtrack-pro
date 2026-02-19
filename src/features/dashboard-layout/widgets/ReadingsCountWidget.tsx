/**
 * Readings Count Widget — Per-Sensor Breakdown with Smart Default
 *
 * Displays the count of sensor readings in the current time period,
 * along with expected readings based on uplink interval and coverage percentage.
 *
 * Per-sensor breakdown:
 * - Queries sensor_readings grouped by lora_sensor_id for each sensor in the unit
 * - Batch-fetches sensor_configurations for all sensors
 * - Dropdown selector to pick a specific sensor or "All Sensors"
 * - Smart default: auto-selects the sensor with lowest coverage if any < 100%
 *
 * Coverage Status Thresholds:
 * - Green (Good):    >= 95% coverage - sensor is reporting reliably
 * - Yellow (Fair):   80-94% coverage - some missed uplinks
 * - Red (Poor):      < 80% coverage - significant missed uplinks
 * - Neutral:         Unknown interval - cannot calculate coverage
 *
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps, TimelineState } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGE_SECONDS: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
};

const RANGE_LABELS: Record<string, string> = {
  "1h": "Last 1 hour",
  "6h": "Last 6 hours",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const MAX_EXPECTED_DISPLAY = 99999;

// Coverage thresholds — easy to adjust
const COVERAGE_GOOD_THRESHOLD = 95;
const COVERAGE_FAIR_THRESHOLD = 80;

// Don't flag as underperforming if expected < this (newly provisioned)
const MIN_EXPECTED_FOR_ALERT = 3;

type CoverageStatus = "good" | "fair" | "poor" | "nodata" | "unknown";

/** "all" means combined view, otherwise a sensor ID */
type SensorSelection = "all" | string;

// ---------------------------------------------------------------------------
// Per-sensor stats
// ---------------------------------------------------------------------------

interface SensorStats {
  sensorId: string;
  sensorName: string;
  sensorType: string;
  actualCount: number;
  expectedCount: number | null;
  intervalSeconds: number | null;
  isEstimated: boolean;
  coveragePct: number | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReadingsCountWidgetProps extends WidgetProps {
  count?: number;
}

// ---------------------------------------------------------------------------
// Pure helpers (no state)
// ---------------------------------------------------------------------------

function getRangeSeconds(state: TimelineState | undefined): number | null {
  if (!state) return RANGE_SECONDS["24h"];
  if (state.range === "custom") {
    if (state.customFrom && state.customTo) {
      const from = new Date(state.customFrom).getTime();
      const to = new Date(state.customTo).getTime();
      const seconds = Math.floor((to - from) / 1000);
      return seconds > 0 ? seconds : null;
    }
    return null;
  }
  return RANGE_SECONDS[state.range] || RANGE_SECONDS["24h"];
}

function getTimeRangeLabel(state: TimelineState | undefined): string {
  if (!state) return RANGE_LABELS["24h"];
  if (state.range === "custom") {
    if (state.customFrom && state.customTo) {
      const from = new Date(state.customFrom);
      const to = new Date(state.customTo);
      return `${format(from, "MMM d, h:mm a")} – ${format(to, "MMM d, h:mm a")}`;
    }
    return "Custom range";
  }
  return RANGE_LABELS[state.range] || RANGE_LABELS["24h"];
}

/** Get ISO date string for "now minus rangeSeconds" */
function getRangeFromDate(state: TimelineState | undefined): string {
  if (state?.range === "custom" && state.customFrom) {
    return state.customFrom;
  }
  const rangeSeconds = getRangeSeconds(state) ?? 86400;
  return new Date(Date.now() - rangeSeconds * 1000).toISOString();
}

function getRangeToDate(state: TimelineState | undefined): string {
  if (state?.range === "custom" && state.customTo) {
    return state.customTo;
  }
  return new Date().toISOString();
}

function inferIntervalFromReadings(
  readings: Array<{ recorded_at: string }> | undefined
): { intervalSeconds: number; isEstimated: true } | null {
  if (!readings || readings.length < 5) return null;

  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const recentReadings = sorted.slice(-20);
  const deltas: number[] = [];

  for (let i = 1; i < recentReadings.length; i++) {
    const delta =
      (new Date(recentReadings[i].recorded_at).getTime() -
       new Date(recentReadings[i - 1].recorded_at).getTime()) / 1000;
    if (delta >= 30 && delta <= 86400) {
      deltas.push(delta);
    }
  }

  if (deltas.length < 3) return null;

  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const medianSeconds = deltas.length % 2 === 0
    ? Math.round((deltas[mid - 1] + deltas[mid]) / 2)
    : Math.round(deltas[mid]);

  if (medianSeconds < 60 || medianSeconds > 86400) return null;

  return { intervalSeconds: medianSeconds, isEstimated: true };
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  if (hours < 24) return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
  return `${(hours / 24).toFixed(1).replace(/\.0$/, "")}d`;
}

function formatNumber(num: number): string {
  if (num > MAX_EXPECTED_DISPLAY) return `${MAX_EXPECTED_DISPLAY.toLocaleString()}+`;
  return num.toLocaleString();
}

function getCoveragePercent(actual: number, expected: number | null): number | null {
  if (expected === null || expected <= 0) return null;
  return (actual / expected) * 100;
}

function formatCoverage(pct: number | null): string {
  if (pct === null) return "—";
  if (pct > 100) return "100%+";
  return `${Math.max(0, Math.round(pct))}%`;
}

function getCoverageStatus(pct: number | null, actual?: number): CoverageStatus {
  if (actual === 0) return "nodata";
  if (pct === null) return "unknown";
  if (pct >= COVERAGE_GOOD_THRESHOLD) return "good";
  if (pct >= COVERAGE_FAIR_THRESHOLD) return "fair";
  return "poor";
}

function getStatusStyles(status: CoverageStatus): {
  bgTint: string;
  textColor: string;
  badgeClass: string;
  badgeLabel: string;
} {
  switch (status) {
    case "good":
      return {
        bgTint: "bg-safe/[0.08]",
        textColor: "text-safe",
        badgeClass: "bg-safe/20 text-safe",
        badgeLabel: "Good",
      };
    case "fair":
      return {
        bgTint: "bg-warning/[0.08]",
        textColor: "text-warning",
        badgeClass: "bg-warning/20 text-warning",
        badgeLabel: "Fair",
      };
    case "poor":
      return {
        bgTint: "bg-alarm/[0.08]",
        textColor: "text-alarm",
        badgeClass: "bg-alarm/20 text-alarm",
        badgeLabel: "Poor",
      };
    case "nodata":
      return {
        bgTint: "bg-alarm/[0.08]",
        textColor: "text-alarm",
        badgeClass: "bg-alarm/20 text-alarm",
        badgeLabel: "No Data",
      };
    default:
      return {
        bgTint: "",
        textColor: "text-muted-foreground",
        badgeClass: "bg-muted text-muted-foreground",
        badgeLabel: "Unknown",
      };
  }
}

// ---------------------------------------------------------------------------
// Smart default: pick the sensor with worst coverage if any < 100%
// ---------------------------------------------------------------------------

function getSmartDefault(stats: SensorStats[]): SensorSelection {
  if (stats.length <= 1) return "all";

  const underperforming = stats
    .filter((s) => {
      if (s.expectedCount === null) return false;
      // Don't flag newly provisioned sensors
      if (s.expectedCount < MIN_EXPECTED_FOR_ALERT) return false;
      return s.actualCount < s.expectedCount;
    })
    .sort((a, b) => {
      const aCov = a.coveragePct ?? 100;
      const bCov = b.coveragePct ?? 100;
      return aCov - bCov;
    });

  if (underperforming.length > 0) {
    return underperforming[0].sensorId;
  }

  return "all";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReadingsCountWidget({
  sensor,
  loraSensors,
  readings,
  timelineState,
  count,
  entityId,
}: ReadingsCountWidgetProps) {
  // ---- Per-sensor reading counts (queried from DB) ----
  const [perSensorCounts, setPerSensorCounts] = useState<Map<string, number>>(new Map());
  const [configIntervals, setConfigIntervals] = useState<Map<string, number | null>>(new Map());
  const [catalogIntervals, setCatalogIntervals] = useState<Map<string, number>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);

  // ---- Sensor selection ----
  const [selectedSensor, setSelectedSensor] = useState<SensorSelection>("all");
  const [smartDefaultApplied, setSmartDefaultApplied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Stable sensor list (exclude deleted)
  const sensorList = useMemo(() => {
    return loraSensors?.filter((s) => s.status !== "deleted") ?? [];
  }, [loraSensors]);

  const singleSensor = sensorList.length <= 1;

  // ---- Fetch per-sensor reading counts + configurations ----
  const fetchKeyRef = useRef<string>("");

  useEffect(() => {
    if (sensorList.length === 0) return;

    const sensorIds = sensorList.map((s) => s.id);
    const fromDate = getRangeFromDate(timelineState);
    const toDate = getRangeToDate(timelineState);
    const key = `${sensorIds.join(",")}-${fromDate}-${toDate}`;

    // Skip if already fetched for same params
    if (fetchKeyRef.current === key) return;

    let cancelled = false;

    async function fetchData() {
      setDataLoading(true);
      try {
        // Fetch reading counts per sensor
        const countPromises = sensorIds.map(async (id) => {
          const { count: cnt, error } = await supabase
            .from("sensor_readings")
            .select("*", { count: "exact", head: true })
            .eq("lora_sensor_id", id)
            .gte("recorded_at", fromDate)
            .lte("recorded_at", toDate);
          return { id, count: error ? 0 : (cnt ?? 0) };
        });

        // Fetch configs (uplink_interval_s) for all sensors
        const { data: configs } = await supabase
          .from("sensor_configurations")
          .select("sensor_id, uplink_interval_s")
          .in("sensor_id", sensorIds);

        // Fetch catalog default intervals for sensors with a catalog reference
        const catalogIds = [
          ...new Set(
            sensorList
              .map((s) => s.sensor_catalog_id)
              .filter((id): id is string => !!id)
          ),
        ];
        const { data: catalogRows } = catalogIds.length > 0
          ? await supabase
              .from("sensor_catalog")
              .select("id, uplink_info")
              .in("id", catalogIds)
          : { data: [] as { id: string; uplink_info: unknown }[] };

        const [counts] = await Promise.all([
          Promise.all(countPromises),
        ]);

        if (cancelled) return;

        const countMap = new Map<string, number>();
        for (const c of counts) {
          countMap.set(c.id, c.count);
        }
        setPerSensorCounts(countMap);

        const configMap = new Map<string, number | null>();
        for (const row of configs ?? []) {
          configMap.set(row.sensor_id, row.uplink_interval_s ?? null);
        }
        setConfigIntervals(configMap);

        // Build catalog_id → default_interval_s map
        const catIntervalMap = new Map<string, number>();
        for (const cat of catalogRows ?? []) {
          const info = cat.uplink_info as Record<string, unknown> | null;
          const defaultInterval = info?.default_interval_s;
          if (typeof defaultInterval === "number" && defaultInterval > 0) {
            catIntervalMap.set(cat.id, defaultInterval);
          }
        }
        setCatalogIntervals(catIntervalMap);

        fetchKeyRef.current = key;
      } catch (err) {
        console.warn("ReadingsCountWidget: fetch error", err);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [sensorList, timelineState]);

  // ---- Build per-sensor stats ----
  const perSensorStats: SensorStats[] = useMemo(() => {
    const rangeSeconds = getRangeSeconds(timelineState);
    if (!rangeSeconds) return [];

    return sensorList.map((s) => {
      const actual = perSensorCounts.get(s.id) ?? 0;
      const configInterval = configIntervals.get(s.id) ?? null;

      let interval = configInterval;
      let isEstimated = false;

      // No configured interval — try catalog default before hardcoded fallback
      if (!interval) {
        const catalogId = s.sensor_catalog_id;
        const catalogDefault = catalogId ? catalogIntervals.get(catalogId) : undefined;
        if (catalogDefault) {
          interval = catalogDefault;
        } else {
          interval = 600; // last resort
        }
        isEstimated = true;
      }

      const expected = interval > 0 ? Math.max(1, Math.floor(rangeSeconds / interval)) : null;
      const coveragePct = getCoveragePercent(actual, expected);

      return {
        sensorId: s.id,
        sensorName: s.name,
        sensorType: s.sensor_type,
        actualCount: actual,
        expectedCount: expected,
        intervalSeconds: interval,
        isEstimated,
        coveragePct,
      };
    });
  }, [sensorList, perSensorCounts, configIntervals, catalogIntervals, timelineState]);

  // ---- Smart default (apply once after data loads) ----
  useEffect(() => {
    if (smartDefaultApplied || dataLoading || perSensorStats.length === 0) return;
    const defaultSensor = getSmartDefault(perSensorStats);
    setSelectedSensor(defaultSensor);
    setSmartDefaultApplied(true);
  }, [perSensorStats, dataLoading, smartDefaultApplied]);

  // Reset smart default when timeline changes
  useEffect(() => {
    setSmartDefaultApplied(false);
  }, [timelineState?.range, timelineState?.customFrom, timelineState?.customTo]);

  // ---- Close dropdown on click outside ----
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  // ---- Compute display values for selected sensor ----
  const displayStats = useMemo(() => {
    if (selectedSensor === "all" || singleSensor) {
      // Combined view
      const totalActual = singleSensor
        ? (perSensorStats[0]?.actualCount ?? (count ?? readings?.length ?? 0))
        : perSensorStats.reduce((sum, s) => sum + s.actualCount, 0);
      const totalExpected = perSensorStats.reduce((sum, s) => sum + (s.expectedCount ?? 0), 0);
      const hasAnyExpected = perSensorStats.some((s) => s.expectedCount !== null);

      // For combined "All" interval, show the primary sensor interval
      const primaryStat = perSensorStats.find((s) =>
        sensorList.find((ls) => ls.id === s.sensorId)?.is_primary
      ) ?? perSensorStats[0];

      return {
        actual: totalActual,
        expected: hasAnyExpected ? totalExpected : null,
        intervalSeconds: primaryStat?.intervalSeconds ?? null,
        isEstimated: primaryStat?.isEstimated ?? false,
        coveragePct: hasAnyExpected && totalExpected > 0
          ? (totalActual / totalExpected) * 100
          : null,
      };
    }

    const stat = perSensorStats.find((s) => s.sensorId === selectedSensor);
    if (!stat) {
      return { actual: 0, expected: null, intervalSeconds: null, isEstimated: false, coveragePct: null };
    }

    return {
      actual: stat.actualCount,
      expected: stat.expectedCount,
      intervalSeconds: stat.intervalSeconds,
      isEstimated: stat.isEstimated,
      coveragePct: stat.coveragePct,
    };
  }, [selectedSensor, singleSensor, perSensorStats, sensorList, count, readings]);

  const coverageStatus = getCoverageStatus(displayStats.coveragePct, displayStats.actual);
  const styles = getStatusStyles(coverageStatus);
  const timeRangeLabel = getTimeRangeLabel(timelineState);

  // Selected sensor display name
  const selectedLabel = useMemo(() => {
    if (selectedSensor === "all" || singleSensor) return "All Sensors";
    const s = sensorList.find((ls) => ls.id === selectedSensor);
    return s?.name ?? "Sensor";
  }, [selectedSensor, singleSensor, sensorList]);

  return (
    <div className={`h-full flex flex-col p-3 rounded-lg ${styles.bgTint}`}>
      {/* Header row with optional sensor selector */}
      <div className="flex items-center gap-1.5 mb-1">
        <Activity className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground truncate">
          Readings in Period
        </span>

        {/* Sensor selector dropdown — only if multiple sensors */}
        {!singleSensor && sensorList.length > 1 && (
          <div className="relative ml-auto flex-shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors bg-background/60 rounded px-1.5 py-0.5 border border-border/50"
            >
              <span className="truncate max-w-[80px]">{selectedLabel}</span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px] max-w-[200px]">
                {/* All Sensors option */}
                <button
                  type="button"
                  onClick={() => { setSelectedSensor("all"); setDropdownOpen(false); }}
                  className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 ${
                    selectedSensor === "all" ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span>All Sensors</span>
                  {selectedSensor === "all" && (
                    <span className="text-[9px] opacity-60">selected</span>
                  )}
                </button>

                <div className="h-px bg-border/50 mx-2 my-0.5" />

                {/* Per-sensor options with inline coverage */}
                {sensorList.map((s) => {
                  const stat = perSensorStats.find((ps) => ps.sensorId === s.id);
                  const pct = stat?.coveragePct;
                  const coverageStr = pct !== null && pct !== undefined
                    ? pct > 100 ? "100%+" : `${Math.round(pct)}%`
                    : "—";
                  const isSelected = selectedSensor === s.id;
                  const covStatus = getCoverageStatus(pct, stat?.actualCount);
                  const covStyles = getStatusStyles(covStatus);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelectedSensor(s.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 ${
                        isSelected ? "font-semibold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className={`text-[9px] font-medium flex-shrink-0 ${covStyles.textColor}`}>
                        {coverageStr}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Time range label */}
      <p className="text-[10px] text-muted-foreground/70 mb-2 truncate">
        {timeRangeLabel}
      </p>

      {/* Main number */}
      <p className="text-2xl font-bold text-foreground leading-none mb-3">
        {dataLoading ? "..." : formatNumber(displayStats.actual)}
      </p>

      {/* Stats grid - compact rows */}
      <div className="space-y-1 text-xs">
        {/* Expected */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Expected</span>
          <span className="font-medium tabular-nums">
            {displayStats.expected !== null ? formatNumber(displayStats.expected) : "—"}
          </span>
        </div>

        {/* Coverage with badge */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Coverage</span>
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold tabular-nums ${styles.textColor}`}>
              {formatCoverage(displayStats.coveragePct)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${styles.badgeClass}`}>
              {styles.badgeLabel}
            </span>
          </div>
        </div>

        {/* Interval */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Interval</span>
          <span className="text-muted-foreground tabular-nums">
            {displayStats.intervalSeconds !== null ? (
              <>
                {formatInterval(displayStats.intervalSeconds)}
                {displayStats.isEstimated && <span className="opacity-60 ml-0.5">(est.)</span>}
              </>
            ) : dataLoading ? (
              "..."
            ) : (
              <span className="opacity-60">unknown</span>
            )}
          </span>
        </div>

        {/* Mini sensor breakdown when "All Sensors" is selected and multiple sensors */}
        {!singleSensor && selectedSensor === "all" && perSensorStats.length > 1 && !dataLoading && (
          <div className="pt-1 mt-1 border-t border-border/30">
            {perSensorStats.map((stat) => {
              const covStatus = getCoverageStatus(stat.coveragePct, stat.actualCount);
              const covStyles = getStatusStyles(covStatus);
              const pctStr = stat.coveragePct !== null
                ? stat.coveragePct > 100 ? "100%+" : `${Math.round(stat.coveragePct)}%`
                : "—";
              return (
                <div key={stat.sensorId} className="flex items-center justify-between py-0.5">
                  <span className="text-muted-foreground truncate mr-2">{stat.sensorName}</span>
                  <span className={`font-medium tabular-nums flex-shrink-0 ${covStyles.textColor}`}>
                    {pctStr}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
