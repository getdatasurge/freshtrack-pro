/**
 * Missed Check-In Calculation Utilities
 *
 * These functions calculate missed check-ins based ONLY on:
 * - last_uplink_at (actual last communication time)
 * - uplink_interval_minutes (the sensor's configured reporting interval)
 * - current time
 *
 * CRITICAL: This module does NOT use:
 * - System polling frequency
 * - Cron intervals
 * - Platform heartbeat schedules
 * - Assumed defaults (unless explicitly configured)
 *
 * The formula is simple:
 *   missed = floor((now - lastUplinkAt) / uplinkIntervalMs)
 *
 * A small clock-skew buffer (default 30s) is applied to prevent flapping
 * during normal operation.
 */

export interface MissedCheckInParams {
  /** Timestamp of last successful uplink/check-in */
  lastUplinkAt: string | Date | null;

  /** Configured uplink interval in MINUTES */
  uplinkIntervalMinutes: number;

  /** Current time (defaults to now) */
  now?: Date;

  /** Clock skew buffer in milliseconds (default 30000 = 30s) */
  clockSkewBufferMs?: number;
}

export interface MissedCheckInResult {
  /** Number of missed check-ins */
  missedCheckins: number;

  /** Time elapsed since last uplink in milliseconds */
  elapsedMs: number;

  /** Expected interval in milliseconds */
  intervalMs: number;

  /** Time of next expected check-in */
  nextExpectedAt: Date | null;

  /** Human-readable duration since last uplink */
  durationMinutes: number;
}

/**
 * Calculate missed check-ins based on uplink interval
 *
 * Returns 999 for null lastUplinkAt to indicate "never seen" (critical offline).
 * Returns 0 if within the expected interval (accounting for buffer).
 *
 * @example
 * // Sensor reports every 15 minutes, last seen 45 minutes ago
 * calculateMissedCheckins({
 *   lastUplinkAt: new Date(Date.now() - 45 * 60 * 1000),
 *   uplinkIntervalMinutes: 15
 * })
 * // Returns: { missedCheckins: 3, ... }
 *
 * @example
 * // User changed interval from 5min to 30min
 * // Device last reported 20 minutes ago
 * calculateMissedCheckins({
 *   lastUplinkAt: new Date(Date.now() - 20 * 60 * 1000),
 *   uplinkIntervalMinutes: 30  // Use current interval
 * })
 * // Returns: { missedCheckins: 0, ... } - NOT offline!
 */
export function calculateMissedCheckins({
  lastUplinkAt,
  uplinkIntervalMinutes,
  now = new Date(),
  clockSkewBufferMs = 30000, // 30 second buffer
}: MissedCheckInParams): MissedCheckInResult {
  // If never checked in, treat as "always offline"
  if (!lastUplinkAt) {
    return {
      missedCheckins: 999,
      elapsedMs: Infinity,
      intervalMs: uplinkIntervalMinutes * 60 * 1000,
      nextExpectedAt: null,
      durationMinutes: Infinity,
    };
  }

  const lastUplinkDate = typeof lastUplinkAt === 'string'
    ? new Date(lastUplinkAt)
    : lastUplinkAt;

  const elapsedMs = now.getTime() - lastUplinkDate.getTime();
  const intervalMs = uplinkIntervalMinutes * 60 * 1000;

  // Apply clock skew buffer to prevent flapping
  const bufferedElapsedMs = Math.max(0, elapsedMs - clockSkewBufferMs);

  // Calculate missed check-ins: floor(elapsed / interval)
  // No arbitrary -1 offset - we count actual missed intervals
  const missedCheckins = Math.max(0, Math.floor(bufferedElapsedMs / intervalMs));

  // Calculate next expected check-in time
  const nextExpectedAt = new Date(
    lastUplinkDate.getTime() + intervalMs
  );

  const durationMinutes = Math.floor(elapsedMs / 60000);

  return {
    missedCheckins,
    elapsedMs,
    intervalMs,
    nextExpectedAt,
    durationMinutes,
  };
}

/**
 * Format missed check-ins for display with context
 *
 * @example
 * formatMissedCheckinsMessage({ missedCheckins: 5, uplinkIntervalMinutes: 15 })
 * // Returns: "5 missed check-ins (75 minutes without uplink)"
 */
export function formatMissedCheckinsMessage(
  missedCheckins: number,
  uplinkIntervalMinutes: number
): string {
  if (missedCheckins === 0) {
    return "Online";
  }

  if (missedCheckins === 999) {
    return "Never seen";
  }

  const totalMinutes = missedCheckins * uplinkIntervalMinutes;

  if (totalMinutes < 60) {
    return `${missedCheckins} missed check-in${missedCheckins > 1 ? 's' : ''} (${totalMinutes} min)`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const timeStr = minutes > 0
    ? `${hours}h ${minutes}m`
    : `${hours}h`;

  return `${missedCheckins} missed check-in${missedCheckins > 1 ? 's' : ''} (${timeStr})`;
}

/**
 * Format uplink interval for display
 *
 * @example
 * formatUplinkInterval(5)   // "5 min"
 * formatUplinkInterval(60)  // "1h"
 * formatUplinkInterval(90)  // "1h 30m"
 */
export function formatUplinkInterval(intervalMinutes: number): string {
  if (intervalMinutes < 60) {
    return `${intervalMinutes} min`;
  }

  const hours = Math.floor(intervalMinutes / 60);
  const minutes = intervalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Calculate the equivalent time duration for N missed check-ins
 *
 * @example
 * getMissedCheckinDuration(5, 15) // "75 minutes"
 */
export function getMissedCheckinDuration(
  missedCheckins: number,
  uplinkIntervalMinutes: number
): { minutes: number; hours: number; formatted: string } {
  const totalMinutes = missedCheckins * uplinkIntervalMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let formatted: string;
  if (totalMinutes < 60) {
    formatted = `${totalMinutes} min`;
  } else if (minutes === 0) {
    formatted = `${hours}h`;
  } else {
    formatted = `${hours}h ${minutes}m`;
  }

  return {
    minutes: totalMinutes,
    hours,
    formatted,
  };
}
