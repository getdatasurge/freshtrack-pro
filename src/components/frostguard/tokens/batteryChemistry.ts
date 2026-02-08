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
  /** 2x AA LiFeS2 in series — pack-level voltages (1.80–3.60V). Most Dragino/Milesight sensors. */
  LiFeS2_AA: [
    [3.60, 100],
    [3.20, 80],
    [2.80, 50],
    [2.40, 20],
    [2.00, 5],
    [1.80, 0],
  ],
  /** 3.6V Li-SOCl2 (ER14505) — used by industrial sensors */
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
  /** 3.0V Li-MnO2 (CR17450) — flat discharge curve, Dragino LHT65 */
  CR17450: [
    [3.00, 100],
    [2.95, 80],
    [2.85, 50],
    [2.75, 20],
    [2.60, 5],
    [2.50, 0],
  ],
  /** 3.0V Li coin cell (CR2032) */
  CR2032: [
    [3.00, 100],
    [2.90, 80],
    [2.70, 50],
    [2.50, 20],
    [2.30, 5],
    [2.20, 0],
  ],
  /** 2x AA Alkaline in series — pack-level (1.60–3.20V). Dragino LDS02 door sensors. */
  Alkaline_AA: [
    [3.20, 100],
    [2.80, 70],
    [2.40, 40],
    [2.00, 15],
    [1.80, 5],
    [1.60, 0],
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
  // LiFeS2 AA (most common — Dragino/Milesight default)
  lithium: 'LiFeS2_AA',
  'lithium-aa': 'LiFeS2_AA',
  lifes2: 'LiFeS2_AA',
  'lifes2-aa': 'LiFeS2_AA',
  li: 'LiFeS2_AA',
  'li-fes2': 'LiFeS2_AA',
  lifes2_aa: 'LiFeS2_AA',
  // ER14505 (Li-SOCl2)
  er14505: 'ER14505',
  'li-socl2': 'ER14505',
  // CR17450 (Li-MnO2) — Dragino LHT65
  cr17450: 'CR17450',
  'li-mno2': 'CR17450',
  // CR2032 (coin cell)
  cr2032: 'CR2032',
  // Alkaline AA
  alkaline_aa: 'Alkaline_AA',
  alkaline: 'Alkaline_AA',
  // CR123A
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
