import { useMemo } from "react";

interface SensorReading {
  temperature: number;
  recorded_at: string;
}

interface CoolingFailureParams {
  unitId: string;
  doorState: "open" | "closed" | "unknown" | null | undefined;
  currentTemp: number | null;
  tempLimitHigh: number;
  tempLimitLow: number | null;
  readings: SensorReading[];
  // Configurable thresholds
  continuousOutOfRangeMinutes?: number; // default 45
  trendWindowMinutes?: number; // default 15
}

interface CoolingFailureResult {
  isSuspectedFailure: boolean;
  reason: string | null;
  diagnosisDetails: string | null;
}

/**
 * Detect suspected cooling failure
 * 
 * Triggers when ALL are true:
 * - Door is CLOSED (or UNKNOWN with no recent door-open events)
 * - Temp out-of-range continuously for configured window (default 45 min)
 * - Temp trend flat/rising (no recovery) over last 15-30 min
 */
export function detectCoolingFailure({
  unitId,
  doorState,
  currentTemp,
  tempLimitHigh,
  tempLimitLow,
  readings,
  continuousOutOfRangeMinutes = 45,
  trendWindowMinutes = 15,
}: CoolingFailureParams): CoolingFailureResult {
  // If no current temp or door is open, no cooling failure
  if (currentTemp === null) {
    return { isSuspectedFailure: false, reason: null, diagnosisDetails: null };
  }

  if (doorState === "open") {
    return { isSuspectedFailure: false, reason: null, diagnosisDetails: null };
  }

  // Check if current temp is out of range
  const isAboveHigh = currentTemp > tempLimitHigh;
  const isBelowLow = tempLimitLow !== null && currentTemp < tempLimitLow;
  const isOutOfRange = isAboveHigh || isBelowLow;

  if (!isOutOfRange) {
    return { isSuspectedFailure: false, reason: null, diagnosisDetails: null };
  }

  // Need at least some readings to analyze
  if (readings.length < 3) {
    return { isSuspectedFailure: false, reason: null, diagnosisDetails: null };
  }

  const now = Date.now();
  const continuousWindowMs = continuousOutOfRangeMinutes * 60 * 1000;
  const trendWindowMs = trendWindowMinutes * 60 * 1000;

  // Sort readings by time (newest first)
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );

  // Check if temp has been continuously out of range for the window
  const windowStartTime = now - continuousWindowMs;
  const readingsInWindow = sortedReadings.filter(
    (r) => new Date(r.recorded_at).getTime() >= windowStartTime
  );

  if (readingsInWindow.length < 2) {
    return { isSuspectedFailure: false, reason: null, diagnosisDetails: null };
  }

  // Check if ALL readings in window are out of range
  const allOutOfRange = readingsInWindow.every((r) => {
    const above = r.temperature > tempLimitHigh;
    const below = tempLimitLow !== null && r.temperature < tempLimitLow;
    return above || below;
  });

  if (!allOutOfRange) {
    return { isSuspectedFailure: false, reason: null, diagnosisDetails: null };
  }

  // Check trend in last X minutes - is temp flat or rising (not recovering)?
  const trendStartTime = now - trendWindowMs;
  const trendReadings = sortedReadings.filter(
    (r) => new Date(r.recorded_at).getTime() >= trendStartTime
  );

  if (trendReadings.length < 2) {
    // Not enough data for trend analysis, but still out of range for full window
    // Consider this a potential failure
    return {
      isSuspectedFailure: true,
      reason: "Door closed; temp not recovering; possible cooling system issue",
      diagnosisDetails: `Temperature has been out of range for ${continuousOutOfRangeMinutes}+ minutes with door closed.`,
    };
  }

  // Calculate trend: compare oldest to newest in trend window
  const newestTrend = trendReadings[0];
  const oldestTrend = trendReadings[trendReadings.length - 1];
  
  // For high excursion: temp should be decreasing to recover
  // For low excursion: temp should be increasing to recover
  const tempDelta = newestTrend.temperature - oldestTrend.temperature;
  
  let isNotRecovering = false;
  if (isAboveHigh) {
    // Need temp to decrease to recover
    isNotRecovering = tempDelta >= -0.5; // Not decreasing significantly
  } else if (isBelowLow) {
    // Need temp to increase to recover
    isNotRecovering = tempDelta <= 0.5; // Not increasing significantly
  }

  if (!isNotRecovering) {
    return { isSuspectedFailure: false, reason: null, diagnosisDetails: null };
  }

  // All conditions met - suspected cooling failure
  const trendDirection = tempDelta > 0.5 ? "rising" : tempDelta < -0.5 ? "falling" : "flat";
  
  return {
    isSuspectedFailure: true,
    reason: "Door closed; temp not recovering; possible cooling system issue",
    diagnosisDetails: `Temperature has been ${isAboveHigh ? "above high limit" : "below low limit"} for ${continuousOutOfRangeMinutes}+ minutes. Trend is ${trendDirection} (${tempDelta > 0 ? "+" : ""}${tempDelta.toFixed(1)}°F over ${trendWindowMinutes} min).`,
  };
}

/**
 * Hook for cooling failure detection
 */
export function useCoolingFailureDetection(params: CoolingFailureParams): CoolingFailureResult {
  return useMemo(() => detectCoolingFailure(params), [
    params.unitId,
    params.doorState,
    params.currentTemp,
    params.tempLimitHigh,
    params.tempLimitLow,
    params.readings,
    params.continuousOutOfRangeMinutes,
    params.trendWindowMinutes,
  ]);
}
