/**
 * LDS02 Payload Normalizer
 *
 * Sole source of truth for mapping Dragino LDS02 vendor-specific decoder
 * output to FrostGuard canonical schema. The TTN decoder is NOT modified;
 * all translation happens here in the application layer.
 *
 * Canonical schema:
 *   door_open        boolean | null
 *   open_count       number  | null
 *   open_duration_s  number  | null   (seconds)
 *   battery_v        number  | null   (volts)
 *   alarm            boolean | null
 *
 * Vendor field variants supported:
 *   DOOR_OPEN_STATUS / door_status / open_state_abs / doorStatus  -> door_open
 *   DOOR_OPEN_TIMES  / open_times / open_count                    -> open_count
 *   LAST_DOOR_OPEN_DURATION / open_duration / last_open_duration  -> open_duration_s (minutes -> seconds)
 *   BAT_V / BatV / battery_v / battery_volt_abs                   -> battery_v
 *   ALARM / alarm                                                 -> alarm
 */

// ---------------------------------------------------------------------------
// Canonical output type
// ---------------------------------------------------------------------------

export type CanonicalDoor = {
  door_open: boolean | null;
  open_count: number | null;
  open_duration_s: number | null;
  battery_v: number | null;
  alarm: boolean | null;
};

// ---------------------------------------------------------------------------
// Alias maps  (ordered by priority — first match wins)
// ---------------------------------------------------------------------------

/** Door open status aliases -> canonical boolean */
export const DOOR_STATUS_ALIASES: readonly string[] = [
  "door_open",
  "DOOR_OPEN_STATUS",
  "door_status",
  "open_state_abs",
  "doorStatus",
  "door",
  "open_close",
  "contactStatus",
] as const;

/** Open count aliases -> canonical number */
export const OPEN_COUNT_ALIASES: readonly string[] = [
  "open_count",
  "DOOR_OPEN_TIMES",
  "open_times",
  "door_open_times",
] as const;

/** Open duration aliases -> canonical number (minutes in, seconds out) */
export const OPEN_DURATION_ALIASES: readonly string[] = [
  "open_duration_s",
  "LAST_DOOR_OPEN_DURATION",
  "open_duration",
  "last_open_duration",
  "last_door_open_duration",
] as const;

/** Battery voltage aliases -> canonical number (volts) */
export const BATTERY_V_ALIASES: readonly string[] = [
  "battery_v",
  "BAT_V",
  "BatV",
  "bat_v",
  "battery_volt_abs",
  "batteryVoltage",
  "vbat",
] as const;

/** Alarm aliases -> canonical boolean */
export const ALARM_ALIASES: readonly string[] = [
  "alarm",
  "ALARM",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a boolean from various representations */
function toBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (lower === "open" || lower === "true" || lower === "1") return true;
    if (lower === "close" || lower === "closed" || lower === "false" || lower === "0") return false;
  }
  return null;
}

/** Resolve a number from various representations */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/** Find the first matching key in a payload from an ordered alias list */
function findAlias(
  payload: Record<string, unknown>,
  aliases: readonly string[],
): unknown | undefined {
  for (const key of aliases) {
    if (key in payload && payload[key] !== undefined) {
      return payload[key];
    }
  }
  return undefined;
}

/** Return which alias key was matched (for logging/debug) */
export function findMatchedAlias(
  payload: Record<string, unknown>,
  aliases: readonly string[],
): string | null {
  for (const key of aliases) {
    if (key in payload && payload[key] !== undefined) {
      return key;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize an LDS02 (or compatible door sensor) decoded payload to
 * FrostGuard canonical schema.
 *
 * Duration fields coming from the decoder in **minutes** are automatically
 * converted to **seconds** (the canonical unit). If the source field name
 * already ends with `_s` it is treated as seconds.
 *
 * @param decoded - Raw decoded payload object (from TTN or app-side decoder)
 * @returns CanonicalDoor with null for any fields not present
 */
export function normalizeLDS02Payload(
  decoded: Record<string, unknown>,
): CanonicalDoor {
  // --- door_open ---
  const rawDoor = findAlias(decoded, DOOR_STATUS_ALIASES);
  const door_open = toBool(rawDoor);

  // --- open_count ---
  const rawCount = findAlias(decoded, OPEN_COUNT_ALIASES);
  const open_count = toNum(rawCount);

  // --- open_duration_s ---
  const durationKey = findMatchedAlias(decoded, OPEN_DURATION_ALIASES);
  const rawDuration = durationKey != null ? decoded[durationKey] : undefined;
  let open_duration_s: number | null = null;
  if (rawDuration !== undefined) {
    const numVal = toNum(rawDuration);
    if (numVal !== null) {
      // If the matched key is already in seconds (ends with _s), keep as-is.
      // Otherwise treat as minutes and convert.
      open_duration_s = durationKey?.endsWith("_s") ? numVal : numVal * 60;
    }
  }

  // --- battery_v ---
  const rawBat = findAlias(decoded, BATTERY_V_ALIASES);
  const battery_v = toNum(rawBat);

  // --- alarm ---
  const rawAlarm = findAlias(decoded, ALARM_ALIASES);
  const alarm = toBool(rawAlarm);

  return { door_open, open_count, open_duration_s, battery_v, alarm };
}

/**
 * All alias lists, exported so payloadNormalization.ts can register
 * them as discriminator / inference keys without duplicating strings.
 */
export const LDS02_ALL_ALIASES = {
  door_status: DOOR_STATUS_ALIASES,
  open_count: OPEN_COUNT_ALIASES,
  open_duration: OPEN_DURATION_ALIASES,
  battery_v: BATTERY_V_ALIASES,
  alarm: ALARM_ALIASES,
} as const;
