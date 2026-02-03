import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { voltageToPercent } from "@/lib/devices/batteryProfiles";

export interface BatteryDataPoint {
  battery_level: number;
  recorded_at: string;
}

export interface BatteryForecast {
  currentLevel: number | null;
  trend: "stable" | "declining" | "unknown";
  estimatedMonthsRemaining: number | null;
  dataPoints: BatteryDataPoint[];
  hasEnoughData: boolean;
  dailyDecayRate: number | null;
}

const MIN_DATA_POINTS = 5;
const REPLACEMENT_THRESHOLD = 10; // Replace at 10% battery

/**
 * Hook to compute battery lifecycle forecast for a device.
 *
 * Prefers battery_voltage + chemistry-specific curves for accurate SOC.
 * Falls back to stored battery_level for readings without voltage data.
 */
export function useBatteryForecast(deviceId: string | null): {
  forecast: BatteryForecast;
  loading: boolean;
  error: string | null;
} {
  const [forecast, setForecast] = useState<BatteryForecast>({
    currentLevel: null,
    trend: "unknown",
    estimatedMonthsRemaining: null,
    dataPoints: [],
    hasEnoughData: false,
    dailyDecayRate: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setForecast({
        currentLevel: null,
        trend: "unknown",
        estimatedMonthsRemaining: null,
        dataPoints: [],
        hasEnoughData: false,
        dailyDecayRate: null,
      });
      setLoading(false);
      return;
    }

    loadBatteryData();
  }, [deviceId]);

  const loadBatteryData = async () => {
    if (!deviceId) return;

    setLoading(true);
    setError(null);

    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch readings with voltage AND level (voltage preferred), plus sensor chemistry
      const [readingsResult, profileResult] = await Promise.all([
        supabase
          .from("sensor_readings")
          .select("battery_level, battery_voltage, recorded_at")
          .eq("device_id", deviceId)
          .gte("recorded_at", ninetyDaysAgo)
          .order("recorded_at", { ascending: true })
          .limit(500),
        // Look up chemistry via the sensor's battery profile
        supabase
          .from("lora_sensors")
          .select("model, battery_voltage, battery_voltage_filtered")
          .eq("id", deviceId)
          .maybeSingle()
          .then(async (sensorRes) => {
            if (!sensorRes.data?.model) return { chemistry: null as string | null };
            const { data: profile } = await supabase
              .from("battery_profiles")
              .select("chemistry")
              .eq("model", sensorRes.data.model)
              .maybeSingle();
            return { chemistry: profile?.chemistry ?? null };
          }),
      ]);

      if (readingsResult.error) throw readingsResult.error;

      const readings = readingsResult.data ?? [];
      const chemistry = profileResult.chemistry;

      if (readings.length === 0) {
        setForecast({
          currentLevel: null,
          trend: "unknown",
          estimatedMonthsRemaining: null,
          dataPoints: [],
          hasEnoughData: false,
          dailyDecayRate: null,
        });
        setLoading(false);
        return;
      }

      // Derive battery_level from voltage + chemistry when voltage is available.
      // Fall back to stored battery_level for historical readings without voltage.
      const validReadings: BatteryDataPoint[] = [];
      for (const r of readings) {
        let level: number | null = null;
        if (r.battery_voltage != null && chemistry) {
          level = voltageToPercent(r.battery_voltage, chemistry);
        } else if (r.battery_level != null && r.battery_level > 0) {
          level = r.battery_level;
        }
        if (level != null && level > 0) {
          validReadings.push({ battery_level: level, recorded_at: r.recorded_at });
        }
      }

      const currentLevel = validReadings.length > 0
        ? validReadings[validReadings.length - 1].battery_level
        : null;

      // Get unique daily values (average per day to reduce noise)
      const dailyReadings = aggregateByDay(validReadings);

      if (dailyReadings.length < MIN_DATA_POINTS) {
        setForecast({
          currentLevel,
          trend: "unknown",
          estimatedMonthsRemaining: null,
          dataPoints: validReadings.slice(-30), // Last 30 for chart
          hasEnoughData: false,
          dailyDecayRate: null,
        });
        setLoading(false);
        return;
      }

      // Calculate linear regression
      const { slope, intercept } = linearRegression(dailyReadings);

      // Slope is change in battery per day
      const dailyDecayRate = -slope; // Positive value = decay

      let trend: "stable" | "declining" | "unknown" = "unknown";
      let estimatedMonthsRemaining: number | null = null;

      if (dailyDecayRate < 0.01) {
        // Less than 0.01% per day = stable
        trend = "stable";
        estimatedMonthsRemaining = null; // Effectively infinite
      } else if (dailyDecayRate > 0) {
        trend = "declining";

        // Calculate days until battery reaches threshold
        const currentBattery = intercept + slope * dailyReadings.length;
        const daysUntilThreshold = (currentBattery - REPLACEMENT_THRESHOLD) / dailyDecayRate;

        if (daysUntilThreshold > 0) {
          estimatedMonthsRemaining = Math.round(daysUntilThreshold / 30);
        } else {
          estimatedMonthsRemaining = 0; // Already below threshold
        }
      }

      setForecast({
        currentLevel,
        trend,
        estimatedMonthsRemaining,
        dataPoints: validReadings.slice(-30),
        hasEnoughData: true,
        dailyDecayRate: dailyDecayRate > 0 ? Math.round(dailyDecayRate * 100) / 100 : null,
      });
    } catch (err: any) {
      console.error("Error loading battery data:", err);
      setError(err.message || "Failed to load battery data");
    } finally {
      setLoading(false);
    }
  };

  return { forecast, loading, error };
}

/**
 * Aggregate readings by day (average battery level per day)
 */
function aggregateByDay(readings: BatteryDataPoint[]): { day: number; level: number }[] {
  const dayMap = new Map<string, number[]>();

  readings.forEach((r) => {
    const day = r.recorded_at.split("T")[0];
    if (!dayMap.has(day)) {
      dayMap.set(day, []);
    }
    dayMap.get(day)!.push(r.battery_level);
  });

  const result: { day: number; level: number }[] = [];
  let dayIndex = 0;

  // Sort by date
  const sortedDays = Array.from(dayMap.keys()).sort();

  sortedDays.forEach((day) => {
    const levels = dayMap.get(day)!;
    const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
    result.push({ day: dayIndex++, level: avgLevel });
  });

  return result;
}

/**
 * Simple linear regression: y = slope * x + intercept
 */
function linearRegression(data: { day: number; level: number }[]): {
  slope: number;
  intercept: number;
} {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  data.forEach(({ day, level }) => {
    sumX += day;
    sumY += level;
    sumXY += day * level;
    sumXX += day * day;
  });

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

export function formatBatteryEstimate(forecast: BatteryForecast): string {
  if (!forecast.hasEnoughData) {
    return "Estimating...";
  }

  if (forecast.trend === "stable") {
    return "Stable";
  }

  if (forecast.estimatedMonthsRemaining === null) {
    return "Not enough data";
  }

  if (forecast.estimatedMonthsRemaining === 0) {
    return "Replace soon";
  }

  if (forecast.estimatedMonthsRemaining === 1) {
    return "~1 month";
  }

  if (forecast.estimatedMonthsRemaining > 12) {
    return "12+ months";
  }

  return `~${forecast.estimatedMonthsRemaining} months`;
}
