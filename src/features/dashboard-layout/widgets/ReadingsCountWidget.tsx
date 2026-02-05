/**
 * Readings Count Widget
 *
 * Displays the count of sensor readings in the current time period,
 * along with expected readings based on uplink interval and coverage percentage.
 *
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { Activity } from "lucide-react";
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

// Maximum expected count to display (prevents layout blowups)
const MAX_EXPECTED_DISPLAY = 99999;

interface ReadingsCountWidgetProps extends WidgetProps {
  count?: number;
}

/**
 * Calculate range duration in seconds from timeline state
 */
function getRangeSeconds(state: TimelineState | undefined): number | null {
  if (!state) return RANGE_SECONDS["24h"]; // Default to 24h

  if (state.range === "custom") {
    if (state.customFrom && state.customTo) {
      const from = new Date(state.customFrom).getTime();
      const to = new Date(state.customTo).getTime();
      const seconds = Math.floor((to - from) / 1000);
      // Guard against invalid ranges
      if (seconds <= 0) return null;
      return seconds;
    }
    return null;
  }

  return RANGE_SECONDS[state.range] || RANGE_SECONDS["24h"];
}

/**
 * Infer uplink interval from readings by calculating median time delta
 * between consecutive readings. Requires at least 5 readings.
 */
function inferIntervalFromReadings(
  readings: Array<{ recorded_at: string }> | undefined
): { intervalSeconds: number; isEstimated: true } | null {
  if (!readings || readings.length < 5) return null;

  // Sort readings by time (should already be sorted, but ensure)
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  // Calculate deltas between consecutive readings (use last 20 for efficiency)
  const recentReadings = sorted.slice(-20);
  const deltas: number[] = [];

  for (let i = 1; i < recentReadings.length; i++) {
    const delta =
      (new Date(recentReadings[i].recorded_at).getTime() -
       new Date(recentReadings[i - 1].recorded_at).getTime()) / 1000;
    // Only include reasonable deltas (between 30s and 24h)
    if (delta >= 30 && delta <= 86400) {
      deltas.push(delta);
    }
  }

  if (deltas.length < 3) return null;

  // Calculate median
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const medianSeconds = deltas.length % 2 === 0
    ? Math.round((deltas[mid - 1] + deltas[mid]) / 2)
    : Math.round(deltas[mid]);

  // Validate reasonable interval (1 minute to 24 hours)
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
 * Format coverage percentage
 */
function formatCoverage(actual: number, expected: number | null): string {
  if (expected === null || expected <= 0) return "—";
  const pct = Math.round((actual / expected) * 100);
  if (pct > 100) return "100%+";
  return `${Math.max(0, pct)}%`;
}

/**
 * Get coverage color class
 */
function getCoverageColor(actual: number, expected: number | null): string {
  if (expected === null || expected <= 0) return "text-muted-foreground";
  const pct = (actual / expected) * 100;
  if (pct >= 90) return "text-safe";
  if (pct >= 70) return "text-warning";
  return "text-alarm";
}

export function ReadingsCountWidget({
  sensor,
  loraSensors,
  readings,
  timelineState,
  count,
}: ReadingsCountWidgetProps) {
  // State for fetched uplink interval from sensor configuration
  const [configuredInterval, setConfiguredInterval] = useState<number | null>(null);
  const [intervalLoading, setIntervalLoading] = useState(false);
  const fetchedSensorIdRef = useRef<string | null>(null);

  // Get the primary sensor ID
  const sensorId = useMemo(() => {
    const primarySensor = sensor || loraSensors?.find(s => s.is_primary) || loraSensors?.[0];
    return primarySensor?.id || null;
  }, [sensor, loraSensors]);

  // Fetch sensor configuration for uplink interval
  useEffect(() => {
    // Skip if no sensor or already fetched for this sensor
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

  // Actual readings count
  const actualCount = count ?? readings?.length ?? 0;

  // Calculate expected readings and coverage
  const { expectedCount, intervalSeconds, isEstimated } = useMemo(() => {
    const rangeSeconds = getRangeSeconds(timelineState);

    // Try configured interval first, then infer from readings
    let interval = configuredInterval;
    let estimated = false;

    if (!interval) {
      const inferred = inferIntervalFromReadings(readings);
      if (inferred) {
        interval = inferred.intervalSeconds;
        estimated = true;
      }
    }

    // If no interval available or range invalid, return null expected
    if (!interval || interval <= 0 || !rangeSeconds) {
      return { expectedCount: null, intervalSeconds: null, isEstimated: false };
    }

    // Calculate expected count
    let expected = Math.floor(rangeSeconds / interval);
    if (expected < 1) expected = 1;

    return {
      expectedCount: expected,
      intervalSeconds: interval,
      isEstimated: estimated
    };
  }, [configuredInterval, readings, timelineState]);

  const coverageText = formatCoverage(actualCount, expectedCount);
  const coverageColor = getCoverageColor(actualCount, expectedCount);

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Readings in Period</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center space-y-3">
        {/* Actual count - headline */}
        <div>
          <p className="text-3xl font-bold text-foreground">{formatNumber(actualCount)}</p>
          <p className="text-xs text-muted-foreground">actual readings</p>
        </div>

        {/* Expected and Coverage */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          {/* Expected */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expected</span>
            <span className="font-medium">
              {expectedCount !== null ? formatNumber(expectedCount) : "—"}
            </span>
          </div>

          {/* Coverage */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Coverage</span>
            <span className={`font-semibold ${coverageColor}`}>
              {coverageText}
            </span>
          </div>

          {/* Interval hint */}
          {intervalSeconds !== null && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground/70">Interval</span>
              <span className="text-muted-foreground">
                {formatInterval(intervalSeconds)}
                {isEstimated && (
                  <span className="ml-1 text-muted-foreground/60">(est.)</span>
                )}
              </span>
            </div>
          )}
          {intervalSeconds === null && !intervalLoading && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground/70">Interval</span>
              <span className="text-muted-foreground/60">unknown</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
