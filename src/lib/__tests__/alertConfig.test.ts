import { describe, it, expect } from 'vitest';
import {
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  getAlertTypeConfig,
  getSeverityConfig,
  getAlertClearCondition,
} from '../alertConfig';

describe('ALERT_TYPE_CONFIG', () => {
  const dbTypes = [
    'alarm_active',
    'monitoring_interrupted',
    'missed_manual_entry',
    'low_battery',
    'sensor_fault',
    'door_open',
    'calibration_due',
    'temp_excursion',
    'suspected_cooling_failure',
  ];

  const computedTypes = [
    'MANUAL_REQUIRED',
    'OFFLINE',
    'EXCURSION',
    'ALARM_ACTIVE',
    'TEMP_EXCURSION',
  ];

  it('contains all 9 database alert types', () => {
    for (const type of dbTypes) {
      expect(ALERT_TYPE_CONFIG[type]).toBeDefined();
    }
  });

  it('contains all 5 computed alert types', () => {
    for (const type of computedTypes) {
      expect(ALERT_TYPE_CONFIG[type]).toBeDefined();
    }
  });

  it('each entry has icon, label, and clearText', () => {
    for (const [key, config] of Object.entries(ALERT_TYPE_CONFIG)) {
      expect(config.icon).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.clearText).toBeTruthy();
    }
  });
});

describe('SEVERITY_CONFIG', () => {
  it('contains info, warning, and critical', () => {
    expect(SEVERITY_CONFIG.info).toBeDefined();
    expect(SEVERITY_CONFIG.warning).toBeDefined();
    expect(SEVERITY_CONFIG.critical).toBeDefined();
  });

  it('each severity has color and bgColor', () => {
    for (const [, config] of Object.entries(SEVERITY_CONFIG)) {
      expect(config.color).toBeTruthy();
      expect(config.bgColor).toBeTruthy();
    }
  });
});

describe('getAlertTypeConfig', () => {
  it('returns correct config for known DB types', () => {
    const config = getAlertTypeConfig('alarm_active');
    expect(config.label).toBe('Temperature Alarm');
  });

  it('returns correct config for known computed types', () => {
    const config = getAlertTypeConfig('MANUAL_REQUIRED');
    expect(config.label).toBe('Manual Logging Required');
  });

  it('returns sensor_fault fallback for unknown types', () => {
    const config = getAlertTypeConfig('totally_unknown_type');
    expect(config).toBe(ALERT_TYPE_CONFIG.sensor_fault);
    expect(config.label).toBe('Sensor Fault');
  });

  it('returns correct labels for all DB types', () => {
    expect(getAlertTypeConfig('monitoring_interrupted').label).toBe('Monitoring Interrupted');
    expect(getAlertTypeConfig('missed_manual_entry').label).toBe('Missed Manual Entry');
    expect(getAlertTypeConfig('low_battery').label).toBe('Low Battery');
    expect(getAlertTypeConfig('door_open').label).toBe('Door Open');
    expect(getAlertTypeConfig('calibration_due').label).toBe('Calibration Due');
    expect(getAlertTypeConfig('temp_excursion').label).toBe('Temperature Excursion');
    expect(getAlertTypeConfig('suspected_cooling_failure').label).toBe('Suspected Cooling Failure');
  });

  it('returns correct labels for computed types', () => {
    expect(getAlertTypeConfig('OFFLINE').label).toBe('Sensor Offline');
    expect(getAlertTypeConfig('EXCURSION').label).toBe('Temperature Excursion');
    expect(getAlertTypeConfig('ALARM_ACTIVE').label).toBe('Temperature Alarm');
  });
});

describe('getSeverityConfig', () => {
  it('returns correct config for info', () => {
    expect(getSeverityConfig('info').color).toBe('text-accent');
  });

  it('returns correct config for warning', () => {
    expect(getSeverityConfig('warning').color).toBe('text-warning');
  });

  it('returns correct config for critical', () => {
    expect(getSeverityConfig('critical').color).toBe('text-alarm');
  });

  it('returns warning fallback for unknown severity', () => {
    const config = getSeverityConfig('unknown_severity');
    expect(config).toBe(SEVERITY_CONFIG.warning);
  });
});

describe('getAlertClearCondition', () => {
  it('returns correct clear text for alarm_active', () => {
    expect(getAlertClearCondition('alarm_active')).toBe('Temperature returns to range');
  });

  it('returns correct clear text for door_open', () => {
    expect(getAlertClearCondition('door_open')).toBe('Close the door');
  });

  it('returns correct clear text for calibration_due', () => {
    expect(getAlertClearCondition('calibration_due')).toBe('Calibrate the sensor');
  });

  it('returns "Condition resolved" for unknown types', () => {
    expect(getAlertClearCondition('unknown_type')).toBe('Condition resolved');
  });
});
