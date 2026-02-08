export interface AlarmThresholds {
  warning_high: number | null;
  critical_high: number | null;
  warning_low: number | null;
  critical_low: number | null;
  unit: string;
  native_unit: string;
}

export type AlarmSeverity = 'ok' | 'warning' | 'critical';

/** Standard alarm thresholds per equipment type */
export const ALARM_DEFAULTS: Record<string, AlarmThresholds> = {
  walk_in_cooler: {
    warning_high: 40,
    critical_high: 41,
    warning_low: 28,
    critical_low: 25,
    unit: '\u00B0F',
    native_unit: '0.01\u00B0C',
  },
  walk_in_freezer: {
    warning_high: 5,
    critical_high: 10,
    warning_low: -25,
    critical_low: -30,
    unit: '\u00B0F',
    native_unit: '0.01\u00B0C',
  },
  prep_display: {
    warning_high: 40,
    critical_high: 41,
    warning_low: 33,
    critical_low: 30,
    unit: '\u00B0F',
    native_unit: '0.01\u00B0C',
  },
  prep_table: {
    warning_high: 40,
    critical_high: 41,
    warning_low: 33,
    critical_low: 30,
    unit: '\u00B0F',
    native_unit: '0.01\u00B0C',
  },
  display_case: {
    warning_high: 40,
    critical_high: 41,
    warning_low: 30,
    critical_low: 28,
    unit: '\u00B0F',
    native_unit: '0.01\u00B0C',
  },
  dry_storage: {
    warning_high: 80,
    critical_high: 85,
    warning_low: 50,
    critical_low: 45,
    unit: '\u00B0F',
    native_unit: '0.01\u00B0C',
  },
  door: {
    warning_high: 5,
    critical_high: 10,
    warning_low: null,
    critical_low: null,
    unit: 'min',
    native_unit: 'min',
  },
  humidity: {
    warning_high: 70,
    critical_high: 80,
    warning_low: 20,
    critical_low: 15,
    unit: '%',
    native_unit: '%',
  },
} as const;

/** Get alarm thresholds for an equipment type, with fallback to walk_in_cooler */
export function getAlarmDefaults(equipmentType: string): AlarmThresholds {
  return ALARM_DEFAULTS[equipmentType] || ALARM_DEFAULTS.walk_in_cooler;
}

/**
 * Evaluate alarm severity for a given reading against thresholds.
 * Returns the highest applicable severity ('critical' > 'warning' > 'ok').
 */
export function evaluateAlarmSeverity(
  value: number,
  thresholds: AlarmThresholds,
): { severity: AlarmSeverity; reason: string } {
  if (thresholds.critical_high != null && value >= thresholds.critical_high) {
    return { severity: 'critical', reason: `${value}${thresholds.unit} >= ${thresholds.critical_high}${thresholds.unit} (critical high)` };
  }
  if (thresholds.critical_low != null && value <= thresholds.critical_low) {
    return { severity: 'critical', reason: `${value}${thresholds.unit} <= ${thresholds.critical_low}${thresholds.unit} (critical low)` };
  }
  if (thresholds.warning_high != null && value >= thresholds.warning_high) {
    return { severity: 'warning', reason: `${value}${thresholds.unit} >= ${thresholds.warning_high}${thresholds.unit} (warning high)` };
  }
  if (thresholds.warning_low != null && value <= thresholds.warning_low) {
    return { severity: 'warning', reason: `${value}${thresholds.unit} <= ${thresholds.warning_low}${thresholds.unit} (warning low)` };
  }
  return { severity: 'ok', reason: 'Within normal range' };
}

/**
 * Check if a value is within normal range for the given equipment type.
 */
export function isInRange(value: number, equipmentType: string): boolean {
  const thresholds = getAlarmDefaults(equipmentType);
  return evaluateAlarmSeverity(value, thresholds).severity === 'ok';
}
