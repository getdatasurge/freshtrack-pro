export interface AlarmThresholds {
  warning_high: number | null;
  critical_high: number | null;
  warning_low: number | null;
  critical_low: number | null;
  unit: string;
  native_unit: string;
}

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
