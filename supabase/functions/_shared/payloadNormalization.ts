/**
 * Payload Normalization Utilities
 * 
 * Converts vendor-specific payload formats to canonical fields
 * that Frost Guard widgets and processing expect.
 */

/**
 * Canonical door status alias list.
 * Mirrors DOOR_STATUS_ALIASES from the sensor library (src/lib/devices/lds02Normalizer.ts),
 * which is the sole source of truth. Kept in sync manually because the edge function
 * runtime (Deno) cannot import from the Vite frontend bundle.
 *
 * Ordered by priority — first match wins.
 */
const DOOR_STATUS_ALIASES: string[] = [
  "door_open",
  "DOOR_OPEN_STATUS",
  "door_status",
  "open_state_abs",
  "doorStatus",
  "door",
  "open_close",
  "contactStatus",
];

/**
 * Convert an arbitrary door-status value to a boolean.
 */
function doorValueToBool(value: unknown): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'open' || lower === 'true' || lower === '1') return true;
    if (lower === 'closed' || lower === 'false' || lower === '0') return false;
  }
  return undefined;
}

/**
 * Normalize door data from various payload formats to canonical door_open boolean.
 *
 * Handles all known LDS02 and compatible door-sensor field variants.
 * Alias list is kept in sync with the sensor library's LDS02 normalizer.
 *
 * @param decoded - The decoded payload from TTN or other sources
 * @returns boolean | undefined - true = open, false = closed, undefined = no door data
 */
export function normalizeDoorData(decoded: Record<string, unknown>): boolean | undefined {
  for (const key of DOOR_STATUS_ALIASES) {
    if (key in decoded && decoded[key] !== undefined) {
      const result = doorValueToBool(decoded[key]);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

/**
 * Normalize LDS02 open-count from vendor aliases to a canonical number.
 * Source of truth: OPEN_COUNT_ALIASES in src/lib/devices/lds02Normalizer.ts
 */
const OPEN_COUNT_ALIASES: string[] = [
  "open_count",
  "DOOR_OPEN_TIMES",
  "open_times",
  "door_open_times",
];

export function normalizeDoorOpenCount(decoded: Record<string, unknown>): number | undefined {
  for (const key of OPEN_COUNT_ALIASES) {
    if (key in decoded && typeof decoded[key] === 'number') {
      return decoded[key] as number;
    }
  }
  return undefined;
}

/**
 * Normalize LDS02 last-open-duration from vendor aliases to seconds.
 * Vendor decoders report in **minutes**; canonical unit is **seconds**.
 * Source of truth: OPEN_DURATION_ALIASES in src/lib/devices/lds02Normalizer.ts
 */
const OPEN_DURATION_ALIASES: string[] = [
  "open_duration_s",
  "LAST_DOOR_OPEN_DURATION",
  "open_duration",
  "last_open_duration",
  "last_door_open_duration",
];

export function normalizeDoorOpenDuration(decoded: Record<string, unknown>): number | undefined {
  for (const key of OPEN_DURATION_ALIASES) {
    if (key in decoded && typeof decoded[key] === 'number') {
      const raw = decoded[key] as number;
      // Keys ending in _s are already in seconds; everything else is minutes
      return key.endsWith('_s') ? raw : raw * 60;
    }
  }
  return undefined;
}

/**
 * Vendor-specific key aliases for telemetry fields.
 * Each entry maps a canonical field to an ordered list of fallback keys.
 * The first alias found in the payload wins. The canonical key itself
 * is always checked first (implicitly — if it already exists, we skip).
 */
const TELEMETRY_ALIASES: Record<string, string[]> = {
  // Temperature: Dragino HT65N/LHT65/LHT52 use TempC_SHT (internal SHT sensor)
  // and TempC_DS (external DS18B20 probe). Catalog decoders often output
  // temperature_c or temp_c. Prefer SHT as it's always present on Dragino.
  temperature: ['TempC_SHT', 'TempC_DS', 'temperature_c', 'temp_c', 'temp'],
  // Humidity: Dragino HT65N/LHT65/LHT52 use Hum_SHT.
  // Catalog decoders may output humidity_pct or relative_humidity.
  humidity: ['Hum_SHT', 'humidity_pct', 'relative_humidity'],
  // Battery: Dragino uses BatV (voltage, e.g. 3.05).
  // Catalog decoders may output battery_v. Both are voltages
  // converted to integer percentage for battery_level column (INTEGER type).
  battery: ['BatV', 'battery_v'],
  // Battery voltage: Store raw voltage for voltage-based estimation
  // Alias list kept in sync with BATTERY_V_ALIASES in src/lib/devices/lds02Normalizer.ts
  battery_voltage: ['BatV', 'BAT_V', 'bat_v', 'battery_v', 'battery_volt_abs', 'batteryVoltage', 'vbat'],
};

// ============================================================================
// Chemistry-specific voltage curves (pack-level)
//
// Sensors report total battery pack voltage. Multi-cell packs (2×AA, 2×AAA)
// report the sum of individual cell voltages. Curves below are at pack level.
// ============================================================================

interface VoltageCurvePoint {
  voltage: number;
  percent: number;
}

interface PackVoltageCurve {
  minVoltage: number;
  maxVoltage: number;
  curve: VoltageCurvePoint[];
}

/** CR17450 (single 3.0V Li-MnO₂ cell) — flat discharge curve */
const CR17450_PACK_CURVE: PackVoltageCurve = {
  minVoltage: 2.50,
  maxVoltage: 3.00,
  curve: [
    { voltage: 3.00, percent: 100 },
    { voltage: 2.95, percent: 80 },
    { voltage: 2.85, percent: 50 },
    { voltage: 2.75, percent: 20 },
    { voltage: 2.60, percent: 5 },
    { voltage: 2.50, percent: 0 },
  ],
};

/** LiFeS2 AA — 2× cells in series (pack voltage 1.80–3.60V) */
const LIFES2_AA_PACK_CURVE: PackVoltageCurve = {
  minVoltage: 1.80,
  maxVoltage: 3.60,
  curve: [
    { voltage: 3.60, percent: 100 },
    { voltage: 3.20, percent: 80 },
    { voltage: 2.80, percent: 50 },
    { voltage: 2.40, percent: 20 },
    { voltage: 2.00, percent: 5 },
    { voltage: 1.80, percent: 0 },
  ],
};

/** Alkaline AA/AAA — 2× cells in series (pack voltage 1.60–3.20V) */
const ALKALINE_AA_PACK_CURVE: PackVoltageCurve = {
  minVoltage: 1.60,
  maxVoltage: 3.20,
  curve: [
    { voltage: 3.20, percent: 100 },
    { voltage: 2.80, percent: 70 },
    { voltage: 2.40, percent: 40 },
    { voltage: 2.00, percent: 15 },
    { voltage: 1.80, percent: 5 },
    { voltage: 1.60, percent: 0 },
  ],
};

/** CR2032 (single 3.0V coin cell) */
const CR2032_PACK_CURVE: PackVoltageCurve = {
  minVoltage: 2.20,
  maxVoltage: 3.00,
  curve: [
    { voltage: 3.00, percent: 100 },
    { voltage: 2.90, percent: 80 },
    { voltage: 2.70, percent: 50 },
    { voltage: 2.50, percent: 20 },
    { voltage: 2.30, percent: 5 },
    { voltage: 2.20, percent: 0 },
  ],
};

/**
 * Map chemistry identifiers to pack-level voltage curves.
 * Accepts both battery_profiles chemistry (e.g. "LiFeS2_AA") and
 * sensor_catalog battery_info.chemistry (e.g. "lithium", "Lithium").
 * Comparison is case-insensitive to handle database inconsistencies.
 */
function getPackCurve(chemistry: string | null | undefined): PackVoltageCurve {
  const key = chemistry?.toLowerCase()?.trim();
  switch (key) {
    case "cr17450":
    case "li-mno2":
      return CR17450_PACK_CURVE;
    case "lifes2_aa":
    case "lifes2":
    case "lithium":
    case "li":
    case "li-fes2":
      return LIFES2_AA_PACK_CURVE;
    case "alkaline_aa":
    case "alkaline":
      return ALKALINE_AA_PACK_CURVE;
    case "cr2032":
      return CR2032_PACK_CURVE;
    default:
      // Default to LiFeS2 AA pack — most common chemistry in this system
      return LIFES2_AA_PACK_CURVE;
  }
}

/**
 * Convert battery voltage to integer percentage (0–100) using
 * chemistry-specific discharge curves with linear interpolation.
 *
 * @param voltage - Pack-level battery voltage in volts
 * @param chemistry - Battery chemistry identifier (from battery_profiles or sensor_catalog)
 */
export function convertVoltageToPercent(voltage: number, chemistry?: string | null): number {
  const curve = getPackCurve(chemistry);

  if (voltage >= curve.maxVoltage) return 100;
  if (voltage <= curve.minVoltage) return 0;

  const points = curve.curve;
  for (let i = 0; i < points.length - 1; i++) {
    const high = points[i];
    const low = points[i + 1];
    if (voltage <= high.voltage && voltage >= low.voltage) {
      const range = high.voltage - low.voltage;
      const percentRange = high.percent - low.percent;
      const ratio = (voltage - low.voltage) / range;
      return Math.round(low.percent + percentRange * ratio);
    }
  }
  return 0;
}

// Legacy Dragino range kept for backward-compatible no-chemistry calls
const DRAGINO_BATV_MIN = 3.0;
const DRAGINO_BATV_MAX = 3.6;

/**
 * @deprecated Use convertVoltageToPercent with chemistry instead.
 * Legacy Dragino BatV conversion (3.0V–3.6V linear).
 */
function convertBatVToPercent(voltage: number): number {
  const clamped = Math.max(DRAGINO_BATV_MIN, Math.min(DRAGINO_BATV_MAX, voltage));
  const percent = ((clamped - DRAGINO_BATV_MIN) / (DRAGINO_BATV_MAX - DRAGINO_BATV_MIN)) * 100;
  return Math.round(percent);
}

/**
 * Options for normalizeTelemetry.
 *
 * @param chemistry - Battery chemistry identifier (e.g. "LiFeS2_AA", "lithium").
 *   When provided, voltage-to-percent conversion uses chemistry-specific
 *   discharge curves instead of the legacy Dragino linear formula.
 */
export interface NormalizeTelemetryOptions {
  chemistry?: string | null;
}

/**
 * Normalize telemetry fields from vendor-specific keys to canonical keys.
 *
 * Returns a shallow copy of `decoded` with canonical keys added where they
 * were missing but a known alias was present. Original keys are preserved.
 *
 * Battery handling: When a voltage alias (BatV, battery_v) is found, the
 * `battery` field is ALWAYS derived from voltage (using chemistry curves or
 * the legacy Dragino formula). This overrides any existing `battery` value
 * in the payload, because some TTN decoders set `battery` to the Dragino
 * `Bat_status` enum (0-3) which is NOT a percentage.
 *
 * @param decoded - Raw decoded payload from TTN or catalog decoder
 * @param options - Optional context for chemistry-aware conversion
 *
 * @example
 *   normalizeTelemetry({ BatV: 3.05 }, { chemistry: "LiFeS2_AA" })
 *   // → { BatV: 3.05, battery: 69, battery_voltage: 3.05 }
 */
export function normalizeTelemetry(
  decoded: Record<string, unknown>,
  options?: NormalizeTelemetryOptions,
): Record<string, unknown> {
  const result = { ...decoded };
  const chemistry = options?.chemistry;

  // First pass: extract raw battery voltage from aliases (needed for override logic)
  let rawBatteryVoltage: number | undefined;
  for (const alias of TELEMETRY_ALIASES.battery_voltage) {
    if (alias in decoded && typeof decoded[alias] === 'number') {
      rawBatteryVoltage = decoded[alias] as number;
      break;
    }
  }

  for (const [canonical, aliases] of Object.entries(TELEMETRY_ALIASES)) {
    // For battery: ALWAYS override when we have a voltage value.
    // Some TTN decoders set decoded.battery = Bat_status (0-3 enum),
    // which is NOT a percentage. The voltage-derived value is authoritative.
    if (canonical === 'battery' && rawBatteryVoltage !== undefined) {
      result[canonical] = chemistry
        ? convertVoltageToPercent(rawBatteryVoltage, chemistry)
        : convertBatVToPercent(rawBatteryVoltage);
      continue;
    }

    // Skip if canonical key already present
    if (canonical in result && result[canonical] !== undefined) continue;

    for (const alias of aliases) {
      if (alias in decoded && decoded[alias] !== undefined) {
        const value = decoded[alias];
        // Only map numeric values (guard against unexpected types)
        if (typeof value === 'number') {
          // Store raw voltage for battery_voltage field
          if (canonical === 'battery_voltage') {
            result[canonical] = value;
          }
          else {
            result[canonical] = value;
          }
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Check if payload contains any door-related fields
 */
export function hasDoorFields(decoded: Record<string, unknown>): boolean {
  return normalizeDoorData(decoded) !== undefined;
}

/**
 * Get debug info about what door field was found (for logging).
 * Uses the same alias list as normalizeDoorData for consistency.
 */
export function getDoorFieldSource(decoded: Record<string, unknown>): string | null {
  for (const field of DOOR_STATUS_ALIASES) {
    if (field in decoded && decoded[field] !== undefined) {
      return `${field}=${JSON.stringify(decoded[field])}`;
    }
  }
  return null;
}
