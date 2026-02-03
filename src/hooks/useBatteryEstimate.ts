/**
 * Battery Estimate Hook
 * 
 * Production-grade battery life estimation for LoRaWAN sensors.
 * Uses voltage as source of truth with chemistry-specific curves.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type BatteryProfile,
  type BatteryWidgetState,
  type BatteryHealthState,
  type BatteryEstimateResult,
  type ConfidenceLevel,
  FALLBACK_BATTERY_PROFILE,
  MIN_UPLINKS_FOR_ESTIMATE,
  MIN_HOURS_FOR_ESTIMATE,
  MIN_DAYS_FOR_VOLTAGE_ESTIMATE,
  CRITICAL_SOC_THRESHOLD,
  DEFAULT_INTERVAL_SECONDS,
  calculateBatteryEstimate,
  inferUplinkInterval,
  determineConfidence,
  isSensorOffline,
  voltageToPercent,
  medianFilter,
  determineBatteryHealthState,
  calculateVoltageSlope,
  estimateDaysFromVoltageSlope,
} from "@/lib/devices/batteryProfiles";

interface SensorData {
  id: string;
  model: string | null;
  last_seen_at: string | null;
  battery_level: number | null;
  battery_voltage?: number | null;
  battery_voltage_filtered?: number | null;
  battery_health_state?: string | null;
}

interface UplinkReading {
  recorded_at: string;
  battery_level: number | null;
  battery_voltage: number | null;
}

interface SensorConfig {
  uplink_interval_s: number | null;
}

export function useBatteryEstimate(
  sensorId: string | null
): BatteryEstimateResult {
  const [batteryProfile, setBatteryProfile] = useState<BatteryProfile | null>(null);
  const [profileSource, setProfileSource] = useState<"database" | "fallback" | "none">("none");
  const [readings, setReadings] = useState<UplinkReading[]>([]);
  const [configuredInterval, setConfiguredInterval] = useState<number | null>(null);
  const [sensorChemistry, setSensorChemistry] = useState<string | null>(null);
  const [sensor, setSensor] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track which sensorId we've already fetched to prevent redundant fetches on remounts
  const hasFetchedRef = useRef<string | null>(null);

  // Fetch all required data - only on sensorId change (page load)
  useEffect(() => {
    // Skip if we've already fetched for this exact sensorId
    if (hasFetchedRef.current === sensorId && sensorId !== null) {
      return;
    }
    
    if (!sensorId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch sensor with voltage fields
        const { data: sensorResult } = await supabase
          .from("lora_sensors")
          .select("id, model, last_seen_at, battery_level, battery_voltage, battery_voltage_filtered, battery_health_state")
          .eq("id", sensorId)
          .single();
        
        if (cancelled) return;
        
        // Store sensor data
        const fetchedSensor = sensorResult as SensorData | null;
        setSensor(fetchedSensor);

        // Parallel fetches for profile, readings, and config
        const [profileResult, readingsResult, configResult] = await Promise.all([
          // Fetch battery profile by model
          fetchedSensor?.model
            ? supabase
                .from("battery_profiles")
                .select("*")
                .eq("model", fetchedSensor.model)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          
          // Fetch recent readings with voltage (last 90 days)
          supabase
            .from("sensor_readings")
            .select("recorded_at, battery_level, battery_voltage")
            .eq("device_id", sensorId)
            .gte("recorded_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order("recorded_at", { ascending: true })
            .limit(500),
          
          // Fetch sensor configuration
          supabase
            .from("sensor_configurations")
            .select("uplink_interval_s")
            .eq("sensor_id", sensorId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        // Set battery profile - NO FALLBACK per user preference
        // If no profile exists in DB, show MISSING_PROFILE state
        if (profileResult.data) {
          setBatteryProfile(profileResult.data as BatteryProfile);
          setProfileSource("database");
          setSensorChemistry(profileResult.data.chemistry || null);
        } else {
          // No fallback - profile source is "none", state becomes MISSING_PROFILE
          setBatteryProfile(null);
          setProfileSource("none");
          setSensorChemistry(null);
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
          // Mark this sensorId as fetched
          hasFetchedRef.current = sensorId;
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [sensorId]); // Only refetch on sensorId change (page load), not on realtime ticks

  // Compute the estimate
  return useMemo((): BatteryEstimateResult => {
    // Base result for no sensor
    if (!sensorId) {
      return {
        state: "NOT_CONFIGURED",
        healthState: "OK",
        currentSoc: null,
        currentVoltage: null,
        filteredVoltage: null,
        estimatedDaysRemaining: null,
        estimatedReplacementDate: null,
        confidence: "none",
        voltageSlope: null,
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
        healthState: "OK",
        currentSoc: null,
        currentVoltage: null,
        filteredVoltage: null,
        estimatedDaysRemaining: null,
        estimatedReplacementDate: null,
        confidence: "none",
        voltageSlope: null,
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

    // Extract voltage readings
    const voltageReadings = readings
      .filter(r => r.battery_voltage !== null)
      .map(r => ({ voltage: r.battery_voltage!, timestamp: r.recorded_at }));
    
    // Current voltage (prefer sensor data, fall back to latest reading)
    const latestVoltage = voltageReadings.length > 0 
      ? voltageReadings[voltageReadings.length - 1].voltage 
      : null;
    const currentVoltage = sensor?.battery_voltage ?? latestVoltage;
    
    // Filtered voltage (median of recent readings)
    const recentVoltages = voltageReadings.slice(-10).map(r => r.voltage);
    const filteredVoltage = sensor?.battery_voltage_filtered ?? medianFilter(recentVoltages);
    
    // Calculate voltage slope if enough data
    const dataSpanDays = voltageReadings.length >= 2
      ? (new Date(voltageReadings[voltageReadings.length - 1].timestamp).getTime() - 
         new Date(voltageReadings[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const voltageSlope = dataSpanDays >= MIN_DAYS_FOR_VOLTAGE_ESTIMATE 
      ? calculateVoltageSlope(voltageReadings)
      : null;
    
    // Determine current SOC - prefer voltage-derived if available
    let currentSoc: number | null = null;
    if (filteredVoltage !== null && sensorChemistry) {
      currentSoc = voltageToPercent(filteredVoltage, sensorChemistry);
    } else if (readings.length > 0) {
      currentSoc = readings[readings.length - 1].battery_level;
    } else {
      currentSoc = sensor?.battery_level ?? null;
    }
    
    // Determine health state from voltage
    const previousHealthState = (sensor?.battery_health_state as BatteryHealthState) || "OK";
    const healthState = determineBatteryHealthState(
      filteredVoltage,
      previousHealthState,
      recentVoltages,
      sensorChemistry
    );

    // Calculate data span for confidence
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
      : sensor?.last_seen_at ?? null;
    const isOffline = isSensorOffline(lastSeenAt, effectiveInterval);

    // Determine state and calculate estimate
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
    } else if (healthState === "CRITICAL" || healthState === "REPLACE_ASAP" || 
               (currentSoc !== null && currentSoc <= CRITICAL_SOC_THRESHOLD)) {
      state = "CRITICAL_BATTERY";
      confidence = determineConfidence(uplinkCount, dataSpanHours);
      
      // Calculate estimate from voltage slope if available
      if (voltageSlope !== null && filteredVoltage !== null && batteryProfile?.cutoff_voltage) {
        estimatedDaysRemaining = estimateDaysFromVoltageSlope(
          filteredVoltage,
          voltageSlope,
          batteryProfile.cutoff_voltage
        );
      }
      // Fall back to mAh-based estimate
      if (estimatedDaysRemaining === null && batteryProfile && currentSoc !== null && currentSoc > 0) {
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
      confidence = determineConfidence(uplinkCount, dataSpanHours);
      
      // Prefer voltage-based estimate if enough data
      if (voltageSlope !== null && filteredVoltage !== null && batteryProfile?.cutoff_voltage) {
        estimatedDaysRemaining = estimateDaysFromVoltageSlope(
          filteredVoltage,
          voltageSlope,
          batteryProfile.cutoff_voltage
        );
        if (estimatedDaysRemaining !== null) {
          estimatedReplacementDate = new Date();
          estimatedReplacementDate.setDate(estimatedReplacementDate.getDate() + estimatedDaysRemaining);
        }
      }
      
      // Fall back to mAh-based estimate
      if (estimatedDaysRemaining === null && batteryProfile && currentSoc !== null) {
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
      healthState,
      currentSoc,
      currentVoltage,
      filteredVoltage,
      estimatedDaysRemaining,
      estimatedReplacementDate,
      confidence,
      voltageSlope,
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
  }, [sensorId, sensor, batteryProfile, profileSource, readings, configuredInterval, sensorChemistry, loading, error]);
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
      chemistry: "Alkaline_AA",
      nominal_voltage: 3.0,
      cutoff_voltage: 2.4,
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
      chemistry: "CR2032",
      nominal_voltage: 3.0,
      cutoff_voltage: 2.2,
    };
  }
  
  // Default to AA profile (CR17450-like)
  return {
    id: "fallback-generic",
    model: model,
    ...FALLBACK_BATTERY_PROFILE,
  };
}
