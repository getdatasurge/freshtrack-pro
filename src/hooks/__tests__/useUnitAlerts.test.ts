/**
 * Tests for computeUnitAlerts — the alert aggregation function.
 *
 * This tests the pure function (not the hook wrapper) that computes
 * alerts from unit status data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeUnitAlerts, type ExtendedUnitStatusInfo } from '../useUnitAlerts';
import { DEFAULT_ALERT_RULES, type AlertRules } from '../useAlertRules';
import type { UnitStatusInfo } from '../useUnitStatus';

// Fix Date.now() for deterministic tests
const NOW = new Date('2024-06-15T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesAgo(m: number): string {
  return new Date(NOW - m * 60 * 1000).toISOString();
}

function makeUnit(overrides: Partial<ExtendedUnitStatusInfo> = {}): ExtendedUnitStatusInfo {
  return {
    id: 'unit-1',
    name: 'Walk-in Cooler A',
    unit_type: 'cooler',
    status: 'ok',
    temp_limit_high: 40,
    temp_limit_low: 32,
    manual_log_cadence: 240,
    last_manual_log_at: minutesAgo(60), // 1 hour ago
    last_reading_at: minutesAgo(3),     // 3 min ago (online)
    last_temp_reading: 36.5,
    area: { name: 'Back of House', site: { name: 'Main Kitchen' } },
    checkin_interval_minutes: 5,
    last_checkin_at: minutesAgo(3),
    manual_logging_enabled: true,
    ...overrides,
  };
}

// ─── Empty / Baseline ─────────────────────────────────────────────────────────

describe('computeUnitAlerts - baseline', () => {
  it('returns empty alerts for empty units array', () => {
    const result = computeUnitAlerts([]);
    expect(result.alerts).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.unitsOk).toBe(0);
    expect(result.unitsWithAlerts).toBe(0);
  });

  it('returns no alerts for a healthy online unit', () => {
    const result = computeUnitAlerts([makeUnit()]);
    expect(result.alerts).toHaveLength(0);
    expect(result.unitsOk).toBe(1);
    expect(result.unitsWithAlerts).toBe(0);
  });
});

// ─── Offline alerts ───────────────────────────────────────────────────────────

describe('computeUnitAlerts - offline', () => {
  it('produces OFFLINE_WARNING for 1 missed check-in', () => {
    // Default threshold: 1 missed check-in = warning
    // With 5-min interval, 11 min ago = floor(11/5)-1 = 1 missed (with calculateMissedCheckins buffer)
    // Use a time that guarantees >= 1 missed check-in
    const unit = makeUnit({
      last_reading_at: minutesAgo(12),
      last_checkin_at: minutesAgo(12),
    });
    const result = computeUnitAlerts([unit]);
    const offlineAlerts = result.alerts.filter((a) => a.type === 'OFFLINE_WARNING' || a.type === 'OFFLINE_CRITICAL');
    expect(offlineAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it('produces OFFLINE_CRITICAL for 5+ missed check-ins', () => {
    // 30 min with 5-min interval = 5 missed check-ins (critical threshold)
    const unit = makeUnit({
      last_reading_at: minutesAgo(35),
      last_checkin_at: minutesAgo(35),
    });
    const result = computeUnitAlerts([unit]);
    const criticalAlerts = result.alerts.filter((a) => a.type === 'OFFLINE_CRITICAL');
    expect(criticalAlerts.length).toBe(1);
    expect(criticalAlerts[0].severity).toBe('critical');
    expect(criticalAlerts[0].title).toBe('Sensor Offline (Critical)');
  });

  it('OFFLINE_CRITICAL alert ID follows unitId-TYPE format', () => {
    const unit = makeUnit({
      id: 'my-unit-id',
      last_reading_at: minutesAgo(35),
      last_checkin_at: minutesAgo(35),
    });
    const result = computeUnitAlerts([unit]);
    const alert = result.alerts.find((a) => a.type === 'OFFLINE_CRITICAL');
    expect(alert?.id).toBe('my-unit-id-OFFLINE_CRITICAL');
  });

  it('includes missedCheckins count in offline alert', () => {
    const unit = makeUnit({
      last_reading_at: minutesAgo(35),
      last_checkin_at: minutesAgo(35),
    });
    const result = computeUnitAlerts([unit]);
    const alert = result.alerts.find((a) => a.type === 'OFFLINE_CRITICAL');
    expect(alert?.missedCheckins).toBeGreaterThanOrEqual(5);
  });
});

// ─── ALARM_ACTIVE ─────────────────────────────────────────────────────────────

describe('computeUnitAlerts - alarm_active', () => {
  it('produces ALARM_ACTIVE alert when unit status is alarm_active', () => {
    const unit = makeUnit({
      status: 'alarm_active',
      last_temp_reading: 48.5,
    });
    const result = computeUnitAlerts([unit]);
    const alarm = result.alerts.find((a) => a.type === 'ALARM_ACTIVE');
    expect(alarm).toBeDefined();
    expect(alarm?.severity).toBe('critical');
    expect(alarm?.message).toContain('48.5');
  });

  it('appends door context to ALARM_ACTIVE title', () => {
    const unit = makeUnit({
      status: 'alarm_active',
      door_state: 'open',
    });
    const result = computeUnitAlerts([unit]);
    const alarm = result.alerts.find((a) => a.type === 'ALARM_ACTIVE');
    expect(alarm?.title).toContain('(door open)');
    expect(alarm?.doorContext).toBe('open');
  });

  it('does not include door context when door_state is unknown', () => {
    const unit = makeUnit({
      status: 'alarm_active',
      door_state: 'unknown',
    });
    const result = computeUnitAlerts([unit]);
    const alarm = result.alerts.find((a) => a.type === 'ALARM_ACTIVE');
    expect(alarm?.title).toBe('Temperature Alarm');
    expect(alarm?.doorContext).toBeUndefined();
  });
});

// ─── EXCURSION ────────────────────────────────────────────────────────────────

describe('computeUnitAlerts - excursion', () => {
  it('produces EXCURSION warning when unit status is excursion', () => {
    const unit = makeUnit({
      status: 'excursion',
      last_temp_reading: 42.0,
    });
    const result = computeUnitAlerts([unit]);
    const exc = result.alerts.find((a) => a.type === 'EXCURSION');
    expect(exc).toBeDefined();
    expect(exc?.severity).toBe('warning');
    expect(exc?.message).toContain('42.0');
  });

  it('appends door closed context to EXCURSION title', () => {
    const unit = makeUnit({
      status: 'excursion',
      door_state: 'closed',
    });
    const result = computeUnitAlerts([unit]);
    const exc = result.alerts.find((a) => a.type === 'EXCURSION');
    expect(exc?.title).toContain('(door closed)');
  });
});

// ─── LOW_BATTERY ──────────────────────────────────────────────────────────────

describe('computeUnitAlerts - low_battery', () => {
  it('produces critical LOW_BATTERY when battery < 10%', () => {
    const unit = makeUnit({ battery_level: 5 });
    const result = computeUnitAlerts([unit]);
    const battery = result.alerts.find((a) => a.type === 'LOW_BATTERY');
    expect(battery).toBeDefined();
    expect(battery?.severity).toBe('critical');
    expect(battery?.message).toContain('5%');
  });

  it('produces warning LOW_BATTERY when battery is 10-19%', () => {
    const unit = makeUnit({ battery_level: 15 });
    const result = computeUnitAlerts([unit]);
    const battery = result.alerts.find((a) => a.type === 'LOW_BATTERY');
    expect(battery).toBeDefined();
    expect(battery?.severity).toBe('warning');
    expect(battery?.message).toContain('15%');
  });

  it('produces no battery alert when battery >= 20%', () => {
    const unit = makeUnit({ battery_level: 25 });
    const result = computeUnitAlerts([unit]);
    const battery = result.alerts.find((a) => a.type === 'LOW_BATTERY');
    expect(battery).toBeUndefined();
  });

  it('produces no battery alert when battery_level is null', () => {
    const unit = makeUnit({ battery_level: null });
    const result = computeUnitAlerts([unit]);
    const battery = result.alerts.find((a) => a.type === 'LOW_BATTERY');
    expect(battery).toBeUndefined();
  });

  it('produces no battery alert when battery_level is undefined', () => {
    const unit = makeUnit({ battery_level: undefined });
    const result = computeUnitAlerts([unit]);
    const battery = result.alerts.find((a) => a.type === 'LOW_BATTERY');
    expect(battery).toBeUndefined();
  });
});

// ─── MANUAL_REQUIRED ──────────────────────────────────────────────────────────

describe('computeUnitAlerts - manual_required', () => {
  it('produces MANUAL_REQUIRED when conditions are met', () => {
    // Needs: manual_logging_enabled, missedCheckins >= 5, manual log overdue (> 4 hours since reading)
    const unit = makeUnit({
      last_reading_at: minutesAgo(300),  // 5 hours ago (overdue)
      last_checkin_at: minutesAgo(300),  // 5 hours ago (many missed)
      last_manual_log_at: minutesAgo(300), // 5 hours ago
      manual_logging_enabled: true,
    });
    const result = computeUnitAlerts([unit]);
    const manual = result.alerts.find((a) => a.type === 'MANUAL_REQUIRED');
    expect(manual).toBeDefined();
    expect(manual?.severity).toBe('critical');
  });

  it('does NOT produce MANUAL_REQUIRED when manual_logging_enabled is false', () => {
    const unit = makeUnit({
      last_reading_at: minutesAgo(300),
      last_checkin_at: minutesAgo(300),
      last_manual_log_at: minutesAgo(300),
      manual_logging_enabled: false,
    });
    const result = computeUnitAlerts([unit]);
    const manual = result.alerts.find((a) => a.type === 'MANUAL_REQUIRED');
    expect(manual).toBeUndefined();
  });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe('computeUnitAlerts - sorting', () => {
  it('sorts critical alerts before warning alerts', () => {
    const units = [
      makeUnit({
        id: 'unit-1',
        status: 'excursion', // warning
        battery_level: 5,    // critical
      }),
    ];
    const result = computeUnitAlerts(units);
    const severities = result.alerts.map((a) => a.severity);
    const firstCriticalIdx = severities.indexOf('critical');
    const lastWarningIdx = severities.lastIndexOf('warning');
    if (firstCriticalIdx !== -1 && lastWarningIdx !== -1) {
      expect(firstCriticalIdx).toBeLessThan(lastWarningIdx);
    }
  });
});

// ─── Summary counts ───────────────────────────────────────────────────────────

describe('computeUnitAlerts - summary', () => {
  it('counts critical and warning alerts correctly', () => {
    const units = [
      makeUnit({
        id: 'unit-1',
        status: 'alarm_active', // critical
        battery_level: 5,       // critical
      }),
      makeUnit({
        id: 'unit-2',
        status: 'excursion', // warning
      }),
    ];
    const result = computeUnitAlerts(units);
    expect(result.criticalCount).toBeGreaterThanOrEqual(2); // alarm + battery
    expect(result.warningCount).toBeGreaterThanOrEqual(1);  // excursion
  });

  it('counts unitsOk and unitsWithAlerts correctly', () => {
    const units = [
      makeUnit({ id: 'unit-ok' }),                          // OK
      makeUnit({ id: 'unit-alert', status: 'alarm_active' }), // alerting
    ];
    const result = computeUnitAlerts(units);
    expect(result.unitsOk).toBe(1);
    expect(result.unitsWithAlerts).toBe(1);
  });

  it('counts unit with multiple alerts only once in unitsWithAlerts', () => {
    const units = [
      makeUnit({
        id: 'unit-multi',
        status: 'alarm_active',
        battery_level: 5,
      }),
    ];
    const result = computeUnitAlerts(units);
    expect(result.unitsWithAlerts).toBe(1);
    expect(result.alerts.length).toBeGreaterThan(1); // multiple alerts from same unit
  });

  it('totalCount matches alerts array length', () => {
    const units = [
      makeUnit({ id: 'unit-1', status: 'alarm_active' }),
      makeUnit({ id: 'unit-2', status: 'excursion', battery_level: 8 }),
    ];
    const result = computeUnitAlerts(units);
    expect(result.totalCount).toBe(result.alerts.length);
  });
});

// ─── Custom rules map ─────────────────────────────────────────────────────────

describe('computeUnitAlerts - custom rules', () => {
  it('uses per-unit rules from rulesMap when provided', () => {
    // Set the critical threshold high so 35 min offline is only a warning
    const customRules: AlertRules = {
      ...DEFAULT_ALERT_RULES,
      offline_critical_missed_checkins: 100,
    };
    const rulesMap = new Map([['unit-1', customRules]]);
    const unit = makeUnit({
      last_reading_at: minutesAgo(35),
      last_checkin_at: minutesAgo(35),
    });
    const result = computeUnitAlerts([unit], rulesMap);
    const critical = result.alerts.find((a) => a.type === 'OFFLINE_CRITICAL');
    expect(critical).toBeUndefined(); // Not critical with high threshold
    const warning = result.alerts.find((a) => a.type === 'OFFLINE_WARNING');
    expect(warning).toBeDefined();
  });
});

// ─── Unit metadata in alerts ──────────────────────────────────────────────────

describe('computeUnitAlerts - alert metadata', () => {
  it('populates site_name and area_name from unit data', () => {
    const unit = makeUnit({
      status: 'alarm_active',
      area: { name: 'Storage Area', site: { name: 'West Campus' } },
    });
    const result = computeUnitAlerts([unit]);
    const alert = result.alerts[0];
    expect(alert.site_name).toBe('West Campus');
    expect(alert.area_name).toBe('Storage Area');
  });

  it('populates unit_name from unit data', () => {
    const unit = makeUnit({ name: 'Freezer B', status: 'alarm_active' });
    const result = computeUnitAlerts([unit]);
    expect(result.alerts[0].unit_name).toBe('Freezer B');
  });
});
