import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeUnitStatus, statusToVariant, statusLabel } from '../statusLogic';

// Fix Date.now() for deterministic tests
const NOW = new Date('2024-06-15T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper: compute elapsed from minutes ago
function minutesAgo(m: number): string {
  return new Date(NOW - m * 60 * 1000).toISOString();
}

describe('computeUnitStatus', () => {
  const INTERVAL_S = 300; // 5 minutes

  it('returns "unknown" when lastReadingAt is null', () => {
    const result = computeUnitStatus(null, INTERVAL_S);
    expect(result.status).toBe('unknown');
    expect(result.reason).toBe('No readings received');
    expect(result.missedCheckins).toBe(0);
    expect(result.elapsedSeconds).toBe(0);
  });

  it('returns "online" when elapsed < 1.5x interval', () => {
    const result = computeUnitStatus(minutesAgo(3), INTERVAL_S); // 3 min < 7.5 min
    expect(result.status).toBe('online');
    expect(result.reason).toBe('Reporting normally');
  });

  it('returns "online" at exactly 1 interval', () => {
    const result = computeUnitStatus(minutesAgo(5), INTERVAL_S); // 5 min < 7.5 min
    expect(result.status).toBe('online');
  });

  it('returns "warning" when elapsed is between 1.5x and 3x interval', () => {
    const result = computeUnitStatus(minutesAgo(10), INTERVAL_S); // 10 min: 1.5x < 2x < 3x
    expect(result.status).toBe('warning');
    expect(result.reason).toContain('missed check-in');
  });

  it('returns "offline" when elapsed > 3x interval', () => {
    const result = computeUnitStatus(minutesAgo(20), INTERVAL_S); // 20 min > 15 min
    expect(result.status).toBe('offline');
    expect(result.reason).toContain('No uplink for');
  });

  it('calculates missedCheckins correctly', () => {
    // 20 min elapsed / 5 min interval = 4; subtract 1 = 3 missed
    const result = computeUnitStatus(minutesAgo(20), INTERVAL_S);
    expect(result.missedCheckins).toBe(3);
  });

  it('missedCheckins is 0 minimum (not negative)', () => {
    const result = computeUnitStatus(minutesAgo(2), INTERVAL_S);
    expect(result.missedCheckins).toBe(0);
  });

  it('calculates elapsedSeconds correctly', () => {
    const result = computeUnitStatus(minutesAgo(10), INTERVAL_S);
    expect(result.elapsedSeconds).toBe(600);
  });

  // ─── Alert severity overrides ───────────────────────────────────────────

  it('overrides online to critical when critical alert is active', () => {
    const result = computeUnitStatus(minutesAgo(3), INTERVAL_S, [
      { severity: 'critical' },
    ]);
    expect(result.status).toBe('critical');
    expect(result.reason).toBe('Critical alert active');
  });

  it('overrides online to warning when warning alert is active', () => {
    const result = computeUnitStatus(minutesAgo(3), INTERVAL_S, [
      { severity: 'warning' },
    ]);
    expect(result.status).toBe('warning');
    expect(result.reason).toBe('Warning alert active');
  });

  it('overrides warning to critical when critical alert is active', () => {
    const result = computeUnitStatus(minutesAgo(10), INTERVAL_S, [
      { severity: 'critical' },
    ]);
    expect(result.status).toBe('critical');
    expect(result.reason).toBe('Critical alert active');
  });

  it('does NOT override offline with critical alert (offline takes precedence)', () => {
    const result = computeUnitStatus(minutesAgo(20), INTERVAL_S, [
      { severity: 'critical' },
    ]);
    expect(result.status).toBe('offline');
  });

  it('does NOT override warning to warning (no change)', () => {
    const result = computeUnitStatus(minutesAgo(10), INTERVAL_S, [
      { severity: 'warning' },
    ]);
    // warning stays warning, but reason doesn't change since it's already warning
    expect(result.status).toBe('warning');
  });

  it('handles empty activeAlerts array', () => {
    const result = computeUnitStatus(minutesAgo(3), INTERVAL_S, []);
    expect(result.status).toBe('online');
  });

  it('handles undefined activeAlerts', () => {
    const result = computeUnitStatus(minutesAgo(3), INTERVAL_S, undefined);
    expect(result.status).toBe('online');
  });
});

describe('statusToVariant', () => {
  it('maps online to success', () => {
    expect(statusToVariant('online')).toBe('success');
  });

  it('maps warning to warning', () => {
    expect(statusToVariant('warning')).toBe('warning');
  });

  it('maps critical to danger', () => {
    expect(statusToVariant('critical')).toBe('danger');
  });

  it('maps offline to neutral', () => {
    expect(statusToVariant('offline')).toBe('neutral');
  });

  it('maps unknown to neutral', () => {
    expect(statusToVariant('unknown')).toBe('neutral');
  });
});

describe('statusLabel', () => {
  it('maps online to "Online"', () => {
    expect(statusLabel('online')).toBe('Online');
  });

  it('maps warning to "Warning"', () => {
    expect(statusLabel('warning')).toBe('Warning');
  });

  it('maps critical to "Critical"', () => {
    expect(statusLabel('critical')).toBe('Critical');
  });

  it('maps offline to "Offline"', () => {
    expect(statusLabel('offline')).toBe('Offline');
  });

  it('maps unknown to "Unknown"', () => {
    expect(statusLabel('unknown')).toBe('Unknown');
  });
});
