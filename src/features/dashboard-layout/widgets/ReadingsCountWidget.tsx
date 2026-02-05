/**
 * Readings Count Widget
 *
 * Displays the count of sensor readings in the current time period,
 * along with expected readings based on uplink interval and coverage percentage.
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
import { Activity } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps, TimelineState } from "../types";

// Range to seconds mapping for preset ranges
const RANGE_SECONDS: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
};

// Human-readable labels for preset ranges
const RANGE_LABELS: Record<string, string> = {
  "1h": "Last 1 hour",
  "6h": "Last 6 hours",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

// Maximum expected count to display (prevents layout blowups)
const MAX_EXPECTED_DISPLAY = 99999;

// Coverage thresholds for status determination
const COVERAGE_GOOD_THRESHOLD = 95;  // >= 95% = Good (green)
const COVERAGE_FAIR_THRESHOLD = 80;  // >= 80% = Fair (yellow), < 80% = Poor (red)

type CoverageStatus = "good" | "fair" | "poor" | "unknown";

interface ReadingsCountWidgetProps extends WidgetProps {
  count?: number;
}

/**
 * Calculate range duration in seconds from timeline state
 */
function getRangeSeconds(state: TimelineState | undefined): number | null {
  if (!state) return RANGE_SECONDS["24h"];

  if (state.range === "custom") {
    if (state.customFrom && state.customTo) {
      const from = new Date(state.customFrom).getTime();
      const to = new Date(state.customTo).getTime();
      const seconds = Math.floor((to - from) / 1000);
      if (seconds <= 0) return null;
      return seconds;
    }
    return null;
  }

  return RANGE_SECONDS[state.range] || RANGE_SECONDS["24h"];
}

/**
 * Get human-readable time range label
 */
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

/**
 * Infer uplink interval from readings by calculating median time delta
 * between consecutive readings. Requires at least 5 readings.
 */
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

/**
 * Format interval for display
 */
function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  if (hours < 24) return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
  return `${(hours / 24).toFixed(1).replace(/\.0$/, "")}d`;
}

/**
 * Format large numbers with commas
 */
function formatNumber(num: number): string {
  if (num > MAX_EXPECTED_DISPLAY) return `${MAX_EXPECTED_DISPLAY.toLocaleString()}+`;
  return num.toLocaleString();
}

/**
 * Calculate coverage percentage (raw value for logic, not display)
 */
function getCoveragePercent(actual: number, expected: number | null): number | null {
  if (expected === null || expected <= 0) return null;
  return (actual / expected) * 100;
}

/**
 * Format coverage percentage for display
 */
function formatCoverage(pct: number | null): string {
  if (pct === null) return "—";
  if (pct > 100) return "100%+";
  return `${Math.max(0, Math.round(pct))}%`;
}

/**
 * Determine coverage status based on percentage
 */
function getCoverageStatus(pct: number | null): CoverageStatus {
  if (pct === null) return "unknown";
  if (pct >= COVERAGE_GOOD_THRESHOLD) return "good";
  if (pct >= COVERAGE_FAIR_THRESHOLD) return "fair";
  return "poor";
}

/**
 * Get status-based styling
 */
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
    default:
      return {
        bgTint: "",
        textColor: "text-muted-foreground",
        badgeClass: "bg-muted text-muted-foreground",
        badgeLabel: "Unknown",
      };
  }
}

export function ReadingsCountWidget({
  sensor,
  loraSensors,
  readings,
  timelineState,
  count,
}: ReadingsCountWidgetProps) {
  const [configuredInterval, setConfiguredInterval] = useState<number | null>(null);
  const [intervalLoading, setIntervalLoading] = useState(false);
  const fetchedSensorIdRef = useRef<string | null>(null);

  const sensorId = useMemo(() => {
    const primarySensor = sensor || loraSensors?.find(s => s.is_primary) || loraSensors?.[0];
    return primarySensor?.id || null;
  }, [sensor, loraSensors]);

  useEffect(() => {
    if (!sensorId || fetchedSensorIdRef.current === sensorId) {
      return;
    }

    let cancelled = false;

    async function fetchConfig() {
      setIntervalLoading(true);
      try {
        const { data } = await supabase
          .from("sensor_configurations")
          .select("uplink_interval_s")
          .eq("sensor_id", sensorId)
          .maybeSingle();

        if (!cancelled && data?.uplink_interval_s) {
          setConfiguredInterval(data.uplink_interval_s);
        }
      } catch (err) {
        console.warn("Failed to fetch sensor config for readings widget:", err);
      } finally {
        if (!cancelled) {
          setIntervalLoading(false);
          fetchedSensorIdRef.current = sensorId;
        }
      }
    }

    fetchConfig();

    return () => {
      cancelled = true;
    };
  }, [sensorId]);

  const actualCount = count ?? readings?.length ?? 0;

  const { expectedCount, intervalSeconds, isEstimated } = useMemo(() => {
    const rangeSeconds = getRangeSeconds(timelineState);

    let interval = configuredInterval;
    let estimated = false;

    if (!interval) {
      const inferred = inferIntervalFromReadings(readings);
      if (inferred) {
        interval = inferred.intervalSeconds;
        estimated = true;
      }
    }

    if (!interval || interval <= 0 || !rangeSeconds) {
      return { expectedCount: null, intervalSeconds: null, isEstimated: false };
    }

    let expected = Math.floor(rangeSeconds / interval);
    if (expected < 1) expected = 1;

    return {
      expectedCount: expected,
      intervalSeconds: interval,
      isEstimated: estimated
    };
  }, [configuredInterval, readings, timelineState]);

  const coveragePct = getCoveragePercent(actualCount, expectedCount);
  const coverageStatus = getCoverageStatus(coveragePct);
  const styles = getStatusStyles(coverageStatus);
  const timeRangeLabel = getTimeRangeLabel(timelineState);

  return (
    <div className={`h-full flex flex-col p-3 rounded-lg ${styles.bgTint}`}>
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-1">
        <Activity className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground truncate">
          Readings in Period
        </span>
      </div>

      {/* Time range label */}
      <p className="text-[10px] text-muted-foreground/70 mb-2 truncate">
        {timeRangeLabel}
      </p>

      {/* Main number */}
      <p className="text-2xl font-bold text-foreground leading-none mb-3">
        {formatNumber(actualCount)}
      </p>

      {/* Stats grid - compact rows */}
      <div className="space-y-1 text-xs">
        {/* Expected */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Expected</span>
          <span className="font-medium tabular-nums">
            {expectedCount !== null ? formatNumber(expectedCount) : "—"}
          </span>
        </div>

        {/* Coverage with badge */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Coverage</span>
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold tabular-nums ${styles.textColor}`}>
              {formatCoverage(coveragePct)}
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
            {intervalSeconds !== null ? (
              <>
                {formatInterval(intervalSeconds)}
                {isEstimated && <span className="opacity-60 ml-0.5">(est.)</span>}
              </>
            ) : intervalLoading ? (
              "..."
            ) : (
              <span className="opacity-60">unknown</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
