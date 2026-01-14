/**
 * Gap Detection Utility
 * 
 * Detects offline intervals based on gaps in readings.
 */

export interface DowntimeInterval {
  start: Date;
  end: Date;
  durationMs: number;
  durationFormatted: string;
}

export interface DowntimeSummary {
  intervals: DowntimeInterval[];
  totalDowntimeMs: number;
  totalDowntimeFormatted: string;
  intervalCount: number;
  longestInterval: DowntimeInterval | null;
}

/**
 * Default offline threshold: 2 hours without a reading
 */
export const DEFAULT_OFFLINE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return "0m";
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}

/**
 * Find downtime intervals from a list of readings
 * 
 * @param readings - Array of readings with recorded_at timestamps
 * @param thresholdMs - Gap threshold to consider as downtime (default: 2 hours)
 * @param timeRange - Optional time range to analyze (defaults to reading range)
 */
export function findDowntimeIntervals(
  readings: Array<{ recorded_at: string }>,
  thresholdMs: number = DEFAULT_OFFLINE_THRESHOLD_MS,
  timeRange?: { start: Date; end: Date }
): DowntimeSummary {
  if (readings.length === 0) {
    return {
      intervals: [],
      totalDowntimeMs: 0,
      totalDowntimeFormatted: "0m",
      intervalCount: 0,
      longestInterval: null,
    };
  }

  // Sort readings by time
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const intervals: DowntimeInterval[] = [];

  // Determine analysis range
  const rangeStart = timeRange?.start ?? new Date(sortedReadings[0].recorded_at);
  const rangeEnd = timeRange?.end ?? new Date(sortedReadings[sortedReadings.length - 1].recorded_at);

  // Check for gap at the beginning
  const firstReadingTime = new Date(sortedReadings[0].recorded_at);
  if (firstReadingTime.getTime() - rangeStart.getTime() > thresholdMs) {
    const durationMs = firstReadingTime.getTime() - rangeStart.getTime();
    intervals.push({
      start: rangeStart,
      end: firstReadingTime,
      durationMs,
      durationFormatted: formatDuration(durationMs),
    });
  }

  // Find gaps between readings
  for (let i = 1; i < sortedReadings.length; i++) {
    const prevTime = new Date(sortedReadings[i - 1].recorded_at);
    const currTime = new Date(sortedReadings[i].recorded_at);
    const gapMs = currTime.getTime() - prevTime.getTime();

    if (gapMs > thresholdMs) {
      intervals.push({
        start: prevTime,
        end: currTime,
        durationMs: gapMs,
        durationFormatted: formatDuration(gapMs),
      });
    }
  }

  // Check for gap at the end (up to range end or current time)
  const lastReadingTime = new Date(sortedReadings[sortedReadings.length - 1].recorded_at);
  const effectiveEnd = rangeEnd.getTime() < Date.now() ? rangeEnd : new Date();
  if (effectiveEnd.getTime() - lastReadingTime.getTime() > thresholdMs) {
    const durationMs = effectiveEnd.getTime() - lastReadingTime.getTime();
    intervals.push({
      start: lastReadingTime,
      end: effectiveEnd,
      durationMs,
      durationFormatted: formatDuration(durationMs),
    });
  }

  // Calculate totals
  const totalDowntimeMs = intervals.reduce((sum, i) => sum + i.durationMs, 0);
  const longestInterval = intervals.length > 0
    ? intervals.reduce((longest, i) => i.durationMs > longest.durationMs ? i : longest)
    : null;

  return {
    intervals,
    totalDowntimeMs,
    totalDowntimeFormatted: formatDuration(totalDowntimeMs),
    intervalCount: intervals.length,
    longestInterval,
  };
}

/**
 * Calculate uptime percentage
 */
export function calculateUptimePercentage(
  totalTimeMs: number,
  downtimeMs: number
): number {
  if (totalTimeMs <= 0) return 100;
  const uptime = ((totalTimeMs - downtimeMs) / totalTimeMs) * 100;
  return Math.max(0, Math.min(100, uptime));
}
