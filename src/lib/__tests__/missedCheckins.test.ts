/**
 * Tests for Missed Check-In Calculations
 *
 * Validates the core business logic for calculating missed check-ins
 * based on sensor uplink intervals.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMissedCheckins,
  formatMissedCheckinsMessage,
  formatUplinkInterval,
  getMissedCheckinDuration,
} from '../missedCheckins';

describe('calculateMissedCheckins', () => {
  const baseTime = new Date('2024-01-15T12:00:00Z');

  it('returns 999 for never-seen sensors', () => {
    const result = calculateMissedCheckins({
      lastUplinkAt: null,
      uplinkIntervalMinutes: 5,
      now: baseTime,
    });

    expect(result.missedCheckins).toBe(999);
    expect(result.nextExpectedAt).toBeNull();
  });

  it('returns 0 when within the uplink interval', () => {
    const lastUplink = new Date(baseTime.getTime() - 3 * 60 * 1000); // 3 min ago
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: baseTime,
    });

    expect(result.missedCheckins).toBe(0);
    expect(result.durationMinutes).toBe(3);
  });

  it('returns 0 when just within buffer (30s grace period)', () => {
    const lastUplink = new Date(baseTime.getTime() - 5 * 60 * 1000 + 25000); // 4:35 ago
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: baseTime,
    });

    // 4:35 elapsed - 30s buffer = 4:05 buffered, which is < 5 min
    expect(result.missedCheckins).toBe(0);
  });

  it('calculates correct missed check-ins for 5-minute interval', () => {
    // Device reports every 5 minutes, last seen 25 minutes ago
    const lastUplink = new Date(baseTime.getTime() - 25 * 60 * 1000);
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: baseTime,
    });

    // 25 min - 0.5 min buffer = 24.5 min buffered
    // floor(24.5 / 5) = 4 missed check-ins
    expect(result.missedCheckins).toBe(4);
    expect(result.durationMinutes).toBe(25);
  });

  it('handles interval change from 5min to 30min correctly', () => {
    // User changed interval from 5 to 30 minutes
    // Device last reported 20 minutes ago
    const lastUplink = new Date(baseTime.getTime() - 20 * 60 * 1000);
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 30, // NEW interval
      now: baseTime,
    });

    // 20 min - 0.5 min buffer = 19.5 min buffered
    // floor(19.5 / 30) = 0 missed check-ins
    // Device is NOT offline!
    expect(result.missedCheckins).toBe(0);
  });

  it('handles interval change from 30min to 5min correctly', () => {
    // User changed interval from 30 to 5 minutes
    // Device last reported 35 minutes ago
    const lastUplink = new Date(baseTime.getTime() - 35 * 60 * 1000);
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5, // NEW interval
      now: baseTime,
    });

    // 35 min - 0.5 min buffer = 34.5 min buffered
    // floor(34.5 / 5) = 6 missed check-ins
    expect(result.missedCheckins).toBe(6);
  });

  it('calculates correct missed check-ins for 15-minute interval', () => {
    // Device reports every 15 minutes, last seen 75 minutes ago
    const lastUplink = new Date(baseTime.getTime() - 75 * 60 * 1000);
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 15,
      now: baseTime,
    });

    // 75 min - 0.5 min buffer = 74.5 min buffered
    // floor(74.5 / 15) = 4 missed check-ins
    expect(result.missedCheckins).toBe(4);
    expect(result.durationMinutes).toBe(75);
  });

  it('calculates next expected check-in time', () => {
    const lastUplink = new Date(baseTime.getTime() - 10 * 60 * 1000);
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: baseTime,
    });

    const expectedNext = new Date(lastUplink.getTime() + 5 * 60 * 1000);
    expect(result.nextExpectedAt).toEqual(expectedNext);
  });

  it('handles custom clock skew buffer', () => {
    const lastUplink = new Date(baseTime.getTime() - 5 * 60 * 1000 + 55000); // 4:05 ago
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: baseTime,
      clockSkewBufferMs: 60000, // 1 minute buffer
    });

    // 4:05 elapsed - 1 min buffer = 3:05 buffered
    // floor(3:05 / 5) = 0
    expect(result.missedCheckins).toBe(0);
  });

  it('handles exact interval boundary', () => {
    const lastUplink = new Date(baseTime.getTime() - 5 * 60 * 1000); // exactly 5 min ago
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: baseTime,
    });

    // 5 min - 0.5 min buffer = 4.5 min buffered
    // floor(4.5 / 5) = 0
    expect(result.missedCheckins).toBe(0);
  });

  it('handles ADR interval changes gracefully', () => {
    // Device was on 10 min, ADR changed to 15 min
    // Last seen 12 minutes ago
    const lastUplink = new Date(baseTime.getTime() - 12 * 60 * 1000);
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 15, // Current ADR interval
      now: baseTime,
    });

    // Should NOT be marked offline since 12 < 15
    expect(result.missedCheckins).toBe(0);
  });
});

describe('formatMissedCheckinsMessage', () => {
  it('formats 0 missed check-ins', () => {
    expect(formatMissedCheckinsMessage(0, 5)).toBe('Online');
  });

  it('formats never-seen status', () => {
    expect(formatMissedCheckinsMessage(999, 5)).toBe('Never seen');
  });

  it('formats single missed check-in (minutes only)', () => {
    expect(formatMissedCheckinsMessage(1, 5)).toBe('1 missed check-in (5 min)');
  });

  it('formats multiple missed check-ins (minutes only)', () => {
    expect(formatMissedCheckinsMessage(5, 5)).toBe('5 missed check-ins (25 min)');
  });

  it('formats check-ins with hours only', () => {
    expect(formatMissedCheckinsMessage(12, 5)).toBe('12 missed check-ins (1h)');
  });

  it('formats check-ins with hours and minutes', () => {
    expect(formatMissedCheckinsMessage(5, 15)).toBe('5 missed check-ins (1h 15m)');
  });

  it('formats large intervals correctly', () => {
    expect(formatMissedCheckinsMessage(3, 30)).toBe('3 missed check-ins (1h 30m)');
  });
});

describe('formatUplinkInterval', () => {
  it('formats minutes-only intervals', () => {
    expect(formatUplinkInterval(5)).toBe('5 min');
    expect(formatUplinkInterval(30)).toBe('30 min');
  });

  it('formats hour-only intervals', () => {
    expect(formatUplinkInterval(60)).toBe('1h');
    expect(formatUplinkInterval(120)).toBe('2h');
  });

  it('formats mixed intervals', () => {
    expect(formatUplinkInterval(90)).toBe('1h 30m');
    expect(formatUplinkInterval(75)).toBe('1h 15m');
  });
});

describe('getMissedCheckinDuration', () => {
  it('calculates duration for 5-minute interval', () => {
    const result = getMissedCheckinDuration(5, 5);
    expect(result.minutes).toBe(25);
    expect(result.hours).toBe(0);
    expect(result.formatted).toBe('25 min');
  });

  it('calculates duration for 15-minute interval', () => {
    const result = getMissedCheckinDuration(5, 15);
    expect(result.minutes).toBe(75);
    expect(result.hours).toBe(1);
    expect(result.formatted).toBe('1h 15m');
  });

  it('calculates exact hours', () => {
    const result = getMissedCheckinDuration(4, 30);
    expect(result.minutes).toBe(120);
    expect(result.hours).toBe(2);
    expect(result.formatted).toBe('2h');
  });
});

describe('Edge Cases', () => {
  it('handles very large missed counts', () => {
    const result = calculateMissedCheckins({
      lastUplinkAt: new Date('2024-01-01T00:00:00Z'),
      uplinkIntervalMinutes: 5,
      now: new Date('2024-01-15T00:00:00Z'), // 14 days later
    });

    // 14 days = 20,160 minutes
    // floor(20,160 / 5) = 4,032 missed check-ins
    expect(result.missedCheckins).toBeGreaterThan(4000);
  });

  it('handles string date inputs', () => {
    const result = calculateMissedCheckins({
      lastUplinkAt: '2024-01-15T11:55:00Z',
      uplinkIntervalMinutes: 5,
      now: new Date('2024-01-15T12:00:00Z'),
    });

    expect(result.missedCheckins).toBe(0);
  });

  it('handles very small intervals (2 minutes)', () => {
    const lastUplink = new Date('2024-01-15T11:54:00Z');
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 2,
      now: new Date('2024-01-15T12:00:00Z'),
    });

    // 6 min - 0.5 min buffer = 5.5 min buffered
    // floor(5.5 / 2) = 2 missed
    expect(result.missedCheckins).toBe(2);
  });
});

describe('Threshold Validation', () => {
  it('validates offline warning threshold (1 missed = 5 min)', () => {
    const lastUplink = new Date('2024-01-15T11:54:00Z');
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: new Date('2024-01-15T12:00:00Z'),
    });

    // 6 min - 0.5 min = 5.5 min buffered
    // floor(5.5 / 5) = 1 missed
    expect(result.missedCheckins).toBe(1);
    // With threshold of 1, this should trigger WARNING
  });

  it('validates offline critical threshold (5 missed = 25 min)', () => {
    const lastUplink = new Date('2024-01-15T11:35:00Z');
    const result = calculateMissedCheckins({
      lastUplinkAt: lastUplink,
      uplinkIntervalMinutes: 5,
      now: new Date('2024-01-15T12:00:00Z'),
    });

    // 25 min - 0.5 min = 24.5 min buffered
    // floor(24.5 / 5) = 4 missed
    expect(result.missedCheckins).toBe(4);

    // 30 min would give us 5 missed
    const result2 = calculateMissedCheckins({
      lastUplinkAt: new Date('2024-01-15T11:30:00Z'),
      uplinkIntervalMinutes: 5,
      now: new Date('2024-01-15T12:00:00Z'),
    });
    expect(result2.missedCheckins).toBe(5);
    // With threshold of 5, this should trigger CRITICAL
  });
});
