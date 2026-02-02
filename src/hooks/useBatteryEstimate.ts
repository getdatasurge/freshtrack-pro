/**
 * Battery Estimate Hook
 * 
 * Production-grade battery life estimation for LoRaWAN sensors.
 * Uses physics-based calculations with model-specific battery profiles.
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type BatteryProfile,
  type BatteryWidgetState,
  type BatteryEstimateResult,
  type ConfidenceLevel,
  FALLBACK_BATTERY_PROFILE,
  MIN_UPLINKS_FOR_ESTIMATE,
  MIN_HOURS_FOR_ESTIMATE,
  CRITICAL_SOC_THRESHOLD,
  DEFAULT_INTERVAL_SECONDS,
  calculateBatteryEstimate,
  inferUplinkInterval,
  determineConfidence,
  isSensorOffline,
} from "@/lib/devices/batteryProfiles";

interface SensorData {
  id: string;
  model: string | null;
  last_seen_at: string | null;
  battery_level: number | null;
}

interface UplinkReading {
  recorded_at: string;
  battery_level: number | null;
}

interface SensorConfig {
  uplink_interval_s: number | null;
}

export function useBatteryEstimate(
  sensorId: string | null,
  sensorData?: SensorData | null
): BatteryEstimateResult {
  const [batteryProfile, setBatteryProfile] = useState<BatteryProfile | null>(null);
  const [profileSource, setProfileSource] = useState<"database" | "fallback" | "none">("none");
  const [readings, setReadings] = useState<UplinkReading[]>([]);
  const [configuredInterval, setConfiguredInterval] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all required data
  useEffect(() => {
    if (!sensorId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Always fetch sensor from DB to get model (may not be in widget props)
        const { data: sensorResult } = await supabase
          .from("lora_sensors")
          .select("id, model, last_seen_at, battery_level")
          .eq("id", sensorId)
          .single();
        
        // Merge with provided data (DB takes precedence for model)
        const sensor = sensorResult ? {
          ...sensorData,
          ...sensorResult,
        } : sensorData;

        if (cancelled) return;

        // Parallel fetches for profile, readings, and config
        const [profileResult, readingsResult, configResult] = await Promise.all([
          // Fetch battery profile by model
          sensor?.model
            ? supabase
                .from("battery_profiles")
                .select("*")
                .eq("model", sensor.model)
                .single()
            : Promise.resolve({ data: null, error: null }),
          
          // Fetch recent readings (last 90 days)
          supabase
            .from("sensor_readings")
            .select("recorded_at, battery_level")
            .eq("device_id", sensorId)
            .not("battery_level", "is", null)
            .gte("recorded_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order("recorded_at", { ascending: true })
            .limit(500),
          
          // Fetch sensor configuration
          supabase
            .from("sensor_configurations")
            .select("uplink_interval_s")
            .eq("sensor_id", sensorId)
            .single(),
        ]);

        if (cancelled) return;

        // Set battery profile (database or fallback)
        if (profileResult.data) {
          setBatteryProfile(profileResult.data as BatteryProfile);
          setProfileSource("database");
        } else if (sensor?.model) {
          // Try generic fallback based on model name patterns
          const fallbackProfile = getFallbackProfile(sensor.model);
          setBatteryProfile(fallbackProfile);
          setProfileSource("fallback");
        } else {
          setBatteryProfile(null);
          setProfileSource("none");
        }

        // Set readings
        setReadings((readingsResult.data || []) as UplinkReading[]);

        // Set configured interval
        setConfiguredInterval(configResult.data?.uplink_interval_s || null);

      } catch (err: unknown) {
        if (!cancelled) {
          console.error("Error fetching battery data:", err);
          setError(err instanceof Error ? err.message : "Failed to load battery data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [sensorId, sensorData]);

  // Compute the estimate
  return useMemo((): BatteryEstimateResult => {
    // Base result for no sensor
    if (!sensorId) {
      return {
        state: "NOT_CONFIGURED",
        currentSoc: null,
        estimatedDaysRemaining: null,
        estimatedReplacementDate: null,
        confidence: "none",
        batteryProfile: null,
        profileSource: "none",
        inferredIntervalSeconds: null,
        configuredIntervalSeconds: null,
        uplinkCount: 0,
        dataSpanHours: 0,
        dailyConsumptionMah: null,
        loading,
        error,
      };
    }

    // Loading state
    if (loading) {
      return {
        state: "COLLECTING_DATA",
        currentSoc: null,
        estimatedDaysRemaining: null,
        estimatedReplacementDate: null,
        confidence: "none",
        batteryProfile: null,
        profileSource: "none",
        inferredIntervalSeconds: null,
        configuredIntervalSeconds: null,
        uplinkCount: 0,
        dataSpanHours: 0,
        dailyConsumptionMah: null,
        loading: true,
        error: null,
      };
    }

    // Current SOC from readings or sensor data
    const currentSoc = readings.length > 0
      ? readings[readings.length - 1].battery_level
      : sensorData?.battery_level ?? null;

    // Calculate data span
    const uplinkCount = readings.length;
    const dataSpanHours = readings.length >= 2
      ? (new Date(readings[readings.length - 1].recorded_at).getTime() - 
         new Date(readings[0].recorded_at).getTime()) / (1000 * 60 * 60)
      : 0;

    // Infer uplink interval
    const timestamps = readings.map(r => r.recorded_at);
    const inferredIntervalSeconds = inferUplinkInterval(timestamps);
    const effectiveInterval = configuredInterval || inferredIntervalSeconds || DEFAULT_INTERVAL_SECONDS;

    // Check if sensor is offline
    const lastSeenAt = readings.length > 0 
      ? readings[readings.length - 1].recorded_at 
      : sensorData?.last_seen_at ?? null;
    const isOffline = isSensorOffline(lastSeenAt, effectiveInterval);

    // Determine state
    let state: BatteryWidgetState;
    let confidence: ConfidenceLevel = "none";
    let estimatedDaysRemaining: number | null = null;
    let estimatedReplacementDate: Date | null = null;
    let dailyConsumptionMah: number | null = null;

    if (isOffline) {
      state = "SENSOR_OFFLINE";
    } else if (!batteryProfile && profileSource === "none") {
      state = "MISSING_PROFILE";
    } else if (uplinkCount < MIN_UPLINKS_FOR_ESTIMATE || dataSpanHours < MIN_HOURS_FOR_ESTIMATE) {
      state = "COLLECTING_DATA";
    } else if (currentSoc !== null && currentSoc <= CRITICAL_SOC_THRESHOLD) {
      state = "CRITICAL_BATTERY";
      confidence = determineConfidence(uplinkCount, dataSpanHours);
      
      // Still calculate estimate for critical state
      if (batteryProfile && currentSoc > 0) {
        const estimate = calculateBatteryEstimate({
          currentSoc,
          effectiveIntervalSeconds: effectiveInterval,
          profile: batteryProfile,
        });
        estimatedDaysRemaining = estimate.daysRemaining;
        estimatedReplacementDate = estimate.replacementDate;
        dailyConsumptionMah = estimate.dailyConsumptionMah;
      }
    } else {
      // Calculate estimate
      confidence = determineConfidence(uplinkCount, dataSpanHours);
      
      if (batteryProfile && currentSoc !== null) {
        const estimate = calculateBatteryEstimate({
          currentSoc,
          effectiveIntervalSeconds: effectiveInterval,
          profile: batteryProfile,
        });
        estimatedDaysRemaining = estimate.daysRemaining;
        estimatedReplacementDate = estimate.replacementDate;
        dailyConsumptionMah = estimate.dailyConsumptionMah;
      }
      
      state = confidence === "high" ? "ESTIMATE_HIGH_CONFIDENCE" : "ESTIMATE_LOW_CONFIDENCE";
    }

    return {
      state,
      currentSoc,
      estimatedDaysRemaining,
      estimatedReplacementDate,
      confidence,
      batteryProfile,
      profileSource,
      inferredIntervalSeconds,
      configuredIntervalSeconds: configuredInterval,
      uplinkCount,
      dataSpanHours,
      dailyConsumptionMah,
      loading: false,
      error,
    };
  }, [sensorId, sensorData, batteryProfile, profileSource, readings, configuredInterval, loading, error]);
}

/**
 * Get fallback profile based on model name patterns
 */
function getFallbackProfile(model: string): BatteryProfile {
  const modelUpper = model.toUpperCase();
  
  // Try to match common patterns
  if (modelUpper.includes("LDS") || modelUpper.includes("DOOR") || modelUpper.includes("CONTACT")) {
    return {
      id: "fallback-door",
      model: model,
      manufacturer: "Generic",
      battery_type: "2×AAA Alkaline",
      nominal_capacity_mah: 1000,
      mah_per_uplink: 0.020,
      sleep_current_ua: 3,
      usable_capacity_pct: 80,
      replacement_threshold: 10,
      notes: "Fallback profile for door sensors",
    };
  }
  
  if (modelUpper.includes("ERS") || modelUpper.includes("CR2032")) {
    return {
      id: "fallback-coin",
      model: model,
      manufacturer: "Generic",
      battery_type: "CR2032",
      nominal_capacity_mah: 230,
      mah_per_uplink: 0.015,
      sleep_current_ua: 2,
      usable_capacity_pct: 75,
      replacement_threshold: 15,
      notes: "Fallback profile for coin cell sensors",
    };
  }
  
  // Default to AA profile
  return {
    id: "fallback-generic",
    model: model,
    ...FALLBACK_BATTERY_PROFILE,
  };
}
