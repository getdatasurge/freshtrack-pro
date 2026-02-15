import { describe, it, expect } from 'vitest';
import {
  alertTypeLabels,
  severityConfig,
  mapAlertToNotification,
  getRelativeTime,
  type AlertWithContext,
} from '../alertNotificationMapper';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<AlertWithContext> = {}): AlertWithContext {
  return {
    id: 'alert-1',
    title: 'Default Title',
    message: null,
    alert_type: 'alarm_active',
    severity: 'critical',
    status: 'active',
    temp_reading: null,
    temp_limit: null,
    triggered_at: '2024-06-15T12:00:00Z',
    metadata: null,
    unit_id: 'unit-1',
    unit: {
      id: 'unit-1',
      name: 'Walk-in Cooler',
      area: {
        id: 'area-1',
        name: 'Back of House',
        site: {
          id: 'site-1',
          name: 'Main Kitchen',
        },
      },
    },
    ...overrides,
  };
}

// ─── alertTypeLabels ──────────────────────────────────────────────────────────

describe('alertTypeLabels', () => {
  it('contains all 9 DB alert types', () => {
    expect(Object.keys(alertTypeLabels)).toHaveLength(9);
    expect(alertTypeLabels.alarm_active).toBe('Temperature Alarm');
    expect(alertTypeLabels.low_battery).toBe('Low Battery');
  });
});

// ─── severityConfig ───────────────────────────────────────────────────────────

describe('severityConfig', () => {
  it('has config for critical, warning, and info', () => {
    expect(severityConfig.critical.bgColor).toBeTruthy();
    expect(severityConfig.warning.textColor).toBeTruthy();
    expect(severityConfig.info.borderColor).toBeTruthy();
  });
});

// ─── getRelativeTime ──────────────────────────────────────────────────────────

describe('getRelativeTime', () => {
  it('returns a relative time string for valid dates', () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const result = getRelativeTime(recent);
    expect(result).toContain('ago');
  });

  it('returns "Unknown time" for invalid date strings', () => {
    expect(getRelativeTime('not-a-date')).toBe('Unknown time');
  });

  it('returns "Unknown time" for empty string', () => {
    expect(getRelativeTime('')).toBe('Unknown time');
  });
});

// ─── mapAlertToNotification ───────────────────────────────────────────────────

describe('mapAlertToNotification', () => {
  it('maps title from alertTypeLabels for known types', () => {
    const notification = mapAlertToNotification(makeAlert({ alert_type: 'alarm_active' }));
    expect(notification.title).toBe('Temperature Alarm');
  });

  it('falls back to alert.title for unknown types', () => {
    const notification = mapAlertToNotification(
      makeAlert({ alert_type: 'unknown_type', title: 'Custom Alert' })
    );
    expect(notification.title).toBe('Custom Alert');
  });

  it('falls back to "Alert" when both label and title are missing', () => {
    const notification = mapAlertToNotification(
      makeAlert({ alert_type: 'unknown_type', title: '' })
    );
    expect(notification.title).toBe('Alert');
  });

  it('builds context from site > area > unit hierarchy', () => {
    const notification = mapAlertToNotification(makeAlert());
    expect(notification.context).toBe('Main Kitchen · Back of House · Walk-in Cooler');
  });

  it('returns "Unknown location" when unit is missing', () => {
    const notification = mapAlertToNotification(makeAlert({ unit: undefined }));
    expect(notification.context).toBe('Unknown location');
  });

  it('builds partial context when only site and unit exist', () => {
    const notification = mapAlertToNotification(
      makeAlert({
        unit: {
          id: 'unit-1',
          name: 'Freezer B',
          area: {
            id: 'area-1',
            name: 'Storage',
            site: undefined as any,
          },
        },
      })
    );
    expect(notification.context).toBe('Storage · Freezer B');
  });

  it('formats detail for temp_excursion with readings', () => {
    const notification = mapAlertToNotification(
      makeAlert({
        alert_type: 'temp_excursion',
        temp_reading: 45.3,
        temp_limit: 40.0,
      })
    );
    expect(notification.detail).toBe('Current 45.3°F > Limit 40.0°F');
  });

  it('defaults severity to "warning" when missing', () => {
    const notification = mapAlertToNotification(
      makeAlert({ severity: undefined as any })
    );
    expect(notification.severity).toBe('warning');
  });

  it('preserves id, status, unitId, alertType, timestamp', () => {
    const notification = mapAlertToNotification(makeAlert());
    expect(notification.id).toBe('alert-1');
    expect(notification.status).toBe('active');
    expect(notification.unitId).toBe('unit-1');
    expect(notification.alertType).toBe('alarm_active');
    expect(notification.timestamp).toBe('2024-06-15T12:00:00Z');
  });

  it('includes relativeTime string', () => {
    const notification = mapAlertToNotification(makeAlert());
    expect(notification.relativeTime).toBeTruthy();
  });

  it('formats detail for monitoring_interrupted', () => {
    const notification = mapAlertToNotification(
      makeAlert({
        alert_type: 'monitoring_interrupted',
        metadata: { missed_checkins: 3 },
      })
    );
    expect(notification.detail).toBe('Missed 3 check-ins');
  });

  it('formats detail for low_battery with level', () => {
    const notification = mapAlertToNotification(
      makeAlert({
        alert_type: 'low_battery',
        metadata: { battery_level: 5 },
      })
    );
    expect(notification.detail).toBe('Battery at 5%');
  });
});
