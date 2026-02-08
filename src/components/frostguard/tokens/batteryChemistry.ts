// ============================================================================
// Battery Chemistry Voltage-to-Percentage Curves
// NEVER use Bat_status (0-3 enum) as battery percentage.
// Always convert BatV (voltage) using the correct chemistry curve.
// ============================================================================

/** Voltage-to-percentage curve: [voltage, percent] pairs, descending by voltage */
export type VoltageCurve = [voltage: number, percent: number][];

/**
 * Battery chemistry curves.
 * Each curve is a sorted array of [voltage, percent] pairs (descending voltage).
 * Between points, linear interpolation is used.
 */
export const BATTERY_CURVES: Record<string, VoltageCurve> = {
  LiFeS2_AA: [
    [1.8, 100],
    [1.7, 90],
    [1.6, 70],
    [1.5, 50],
    [1.4, 30],
    [1.3, 15],
    [1.2, 5],
    [1.0, 0],
  ],
  ER14505: [
    [3.65, 100],
    [3.6, 90],
    [3.5, 70],
    [3.4, 50],
    [3.3, 30],
    [3.2, 15],
    [3.0, 5],
    [2.5, 0],
  ],
  CR123A: [
    [3.3, 100],
    [3.2, 90],
    [3.0, 70],
    [2.9, 50],
    [2.8, 30],
    [2.7, 15],
    [2.5, 5],
    [2.0, 0],
  ],
} as const;

/**
 * Alias mapping for chemistry names found in sensor catalogs.
 * Maps catalog names to the canonical curve key in BATTERY_CURVES.
 */
export const CHEMISTRY_ALIASES: Record<string, string> = {
  lithium: 'LiFeS2_AA',
  'lithium-aa': 'LiFeS2_AA',
  lifes2: 'LiFeS2_AA',
  'lifes2-aa': 'LiFeS2_AA',
  er14505: 'ER14505',
  'li-socl2': 'ER14505',
  cr123a: 'CR123A',
  cr123: 'CR123A',
  'lithium-cr123a': 'CR123A',
};

/** Resolve a chemistry name (including aliases) to a canonical curve key */
export function resolveChemistry(chemistry: string): string {
  const lower = chemistry.toLowerCase().trim();
  return CHEMISTRY_ALIASES[lower] || chemistry;
}

/**
 * Get the chemistry key for a given sensor model or catalog name.
 * Falls back to ER14505 if not recognized.
 */
export function getChemistryForSensor(sensorModel: string): string {
  const resolved = resolveChemistry(sensorModel);
  return BATTERY_CURVES[resolved] ? resolved : 'ER14505';
}

/**
 * Convert voltage to battery percentage using linear interpolation on the
 * appropriate chemistry curve.
 *
 * @param voltage - Battery voltage reading (BatV)
 * @param chemistry - Chemistry key or alias (e.g. 'lithium', 'ER14505')
 * @returns Battery percentage (0-100), clamped
 */
export function voltageToPercent(voltage: number, chemistry: string): number {
  const key = resolveChemistry(chemistry);
  const curve = BATTERY_CURVES[key] || BATTERY_CURVES.ER14505;

  // Above highest voltage point → 100%
  if (voltage >= curve[0][0]) return 100;

  // Below lowest voltage point → 0%
  if (voltage <= curve[curve.length - 1][0]) return 0;

  // Find the two bounding points and linearly interpolate
  for (let i = 0; i < curve.length - 1; i++) {
    const [v1, p1] = curve[i];
    const [v2, p2] = curve[i + 1];

    if (voltage >= v2 && voltage <= v1) {
      // Linear interpolation between (v2, p2) and (v1, p1)
      const ratio = (voltage - v2) / (v1 - v2);
      return Math.round(p2 + ratio * (p1 - p2));
    }
  }

  return 0;
}

/**
 * Get the battery status variant based on percentage.
 */
export function batteryVariant(percent: number): 'success' | 'warning' | 'danger' {
  if (percent > 50) return 'success';
  if (percent >= 20) return 'warning';
  return 'danger';
}

/**
 * Estimate remaining battery life based on current percentage and expected
 * uplink rate. Returns estimated days remaining.
 *
 * @param percent - Current battery percentage
 * @param dailyUplinkCount - Number of uplinks per day
 * @param baseLifeYears - Expected battery life at nominal uplink rate (default 3 years)
 * @param nominalDailyUplinks - Nominal uplink rate for base life calc (default 144 = every 10 min)
 */
export function estimateBatteryLife(
  percent: number,
  dailyUplinkCount: number,
  baseLifeYears: number = 3,
  nominalDailyUplinks: number = 144,
): number {
  if (percent <= 0 || dailyUplinkCount <= 0) return 0;
  const baseDays = baseLifeYears * 365;
  const adjustedDays = baseDays * (nominalDailyUplinks / dailyUplinkCount);
  return Math.round(adjustedDays * (percent / 100));
}
