import { describe, it, expect } from 'vitest';
import { ALERT_DESCRIPTIONS, getAlertDescription, type AlertDescription } from '../alertDescriptions';

const ALL_ALERT_TYPES = [
  'alarm_active',
  'temp_excursion',
  'monitoring_interrupted',
  'missed_manual_entry',
  'low_battery',
  'sensor_fault',
  'door_open',
  'calibration_due',
  'suspected_cooling_failure',
];

describe('ALERT_DESCRIPTIONS', () => {
  it('has descriptions for all 9 alert types', () => {
    for (const type of ALL_ALERT_TYPES) {
      expect(ALERT_DESCRIPTIONS[type]).toBeDefined();
    }
  });

  it.each(ALL_ALERT_TYPES)('%s has all required fields', (type) => {
    const desc = ALERT_DESCRIPTIONS[type];
    expect(desc.whatItMeans).toBeTruthy();
    expect(desc.triggeredWhen).toBeTruthy();
    expect(desc.howToFix).toBeInstanceOf(Array);
    expect(desc.howToFix.length).toBeGreaterThan(0);
    expect(desc.autoResolvesWhen).toBeTruthy();
    expect(desc.severity).toBeTruthy();
    expect(desc.relatedSettings).toBeTruthy();
  });

  it.each(ALL_ALERT_TYPES)('%s has valid severity value', (type) => {
    const desc = ALERT_DESCRIPTIONS[type];
    expect(['Critical', 'Warning', 'Info']).toContain(desc.severity);
  });

  it('has no extra keys beyond the 9 known types', () => {
    const keys = Object.keys(ALERT_DESCRIPTIONS);
    expect(keys.length).toBe(9);
    expect(keys.sort()).toEqual([...ALL_ALERT_TYPES].sort());
  });
});

describe('severity assignments', () => {
  it('alarm_active is Critical', () => {
    expect(ALERT_DESCRIPTIONS.alarm_active.severity).toBe('Critical');
  });

  it('temp_excursion is Warning', () => {
    expect(ALERT_DESCRIPTIONS.temp_excursion.severity).toBe('Warning');
  });

  it('monitoring_interrupted is Warning', () => {
    expect(ALERT_DESCRIPTIONS.monitoring_interrupted.severity).toBe('Warning');
  });

  it('missed_manual_entry is Critical', () => {
    expect(ALERT_DESCRIPTIONS.missed_manual_entry.severity).toBe('Critical');
  });

  it('low_battery is Warning', () => {
    expect(ALERT_DESCRIPTIONS.low_battery.severity).toBe('Warning');
  });

  it('sensor_fault is Critical', () => {
    expect(ALERT_DESCRIPTIONS.sensor_fault.severity).toBe('Critical');
  });

  it('door_open is Warning', () => {
    expect(ALERT_DESCRIPTIONS.door_open.severity).toBe('Warning');
  });

  it('calibration_due is Info', () => {
    expect(ALERT_DESCRIPTIONS.calibration_due.severity).toBe('Info');
  });

  it('suspected_cooling_failure is Critical', () => {
    expect(ALERT_DESCRIPTIONS.suspected_cooling_failure.severity).toBe('Critical');
  });
});

describe('getAlertDescription', () => {
  it('returns description for known type', () => {
    const desc = getAlertDescription('alarm_active');
    expect(desc).not.toBeNull();
    expect(desc?.whatItMeans).toContain('temperature');
  });

  it('returns null for unknown type', () => {
    expect(getAlertDescription('unknown_type')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getAlertDescription('')).toBeNull();
  });
});
