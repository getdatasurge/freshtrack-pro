import { describe, it, expect } from 'vitest';
import {
  ALERT_TYPE_LABELS,
  getAlertTypeLabel,
  SEVERITY_EMOJI,
  buildSmsTemplate,
  buildEscalationSmsTemplate,
  buildEmailSubject,
  buildEscalationEmailSubject,
  buildInAppTitle,
  buildInAppBody,
  buildAckNotificationTitle,
  buildAckNotificationBody,
  formatAlertDetail,
  type SmsTemplateContext,
  type EscalationSmsContext,
  type InAppNotificationContext,
  type AlertDetailContext,
} from '../alertTemplates';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseSmsCtx: SmsTemplateContext = {
  unitName: 'Walk-in Cooler A',
  siteName: 'Main Kitchen',
  alertType: 'alarm_active',
  severity: 'critical',
};

const baseInAppCtx: InAppNotificationContext = {
  alertType: 'alarm_active',
  severity: 'critical',
  unitName: 'Walk-in Cooler A',
  siteName: 'Main Kitchen',
  areaName: 'Back of House',
};

// ─── getAlertTypeLabel ────────────────────────────────────────────────────────

describe('getAlertTypeLabel', () => {
  it('returns human label for all known types', () => {
    expect(getAlertTypeLabel('alarm_active')).toBe('Temperature Alarm');
    expect(getAlertTypeLabel('monitoring_interrupted')).toBe('Monitoring Interrupted');
    expect(getAlertTypeLabel('missed_manual_entry')).toBe('Missed Manual Entry');
    expect(getAlertTypeLabel('low_battery')).toBe('Low Battery');
    expect(getAlertTypeLabel('sensor_fault')).toBe('Sensor Fault');
    expect(getAlertTypeLabel('door_open')).toBe('Door Left Open');
    expect(getAlertTypeLabel('calibration_due')).toBe('Calibration Due');
    expect(getAlertTypeLabel('temp_excursion')).toBe('Temperature Excursion');
    expect(getAlertTypeLabel('suspected_cooling_failure')).toBe('Suspected Cooling Failure');
  });

  it('returns raw string for unknown types', () => {
    expect(getAlertTypeLabel('some_unknown_type')).toBe('some_unknown_type');
  });
});

// ─── SEVERITY_EMOJI ───────────────────────────────────────────────────────────

describe('SEVERITY_EMOJI', () => {
  it('has emoji for critical, warning, and info', () => {
    expect(SEVERITY_EMOJI.critical).toBe('🔴');
    expect(SEVERITY_EMOJI.warning).toBe('⚠️');
    expect(SEVERITY_EMOJI.info).toBe('🔔');
  });
});

// ─── buildSmsTemplate ─────────────────────────────────────────────────────────

describe('buildSmsTemplate', () => {
  it('formats alarm_active with temp reading and range', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'alarm_active',
      tempReading: '45.2°F',
      tempRange: '32°F-40°F',
    });
    expect(msg).toContain('Walk-in Cooler A');
    expect(msg).toContain('45.2°F');
    expect(msg).toContain('outside safe range 32°F-40°F');
    expect(msg).toContain('🚨');
  });

  it('formats temp_excursion with temp and limit fallback', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'temp_excursion',
      tempReading: '42.0°F',
      tempLimit: '40°F',
    });
    expect(msg).toContain('42.0°F');
    expect(msg).toContain('past limit 40°F');
  });

  it('formats alarm_active with unknown temp when no reading', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'alarm_active',
    });
    expect(msg).toContain('unknown');
  });

  it('formats monitoring_interrupted with timestamp', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'monitoring_interrupted',
      timestamp: '2:30 PM',
    });
    expect(msg).toContain('sensor has gone offline');
    expect(msg).toContain('as of 2:30 PM');
    expect(msg).toContain('⚠️');
  });

  it('formats monitoring_interrupted without timestamp', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'monitoring_interrupted',
    });
    expect(msg).toContain('sensor has gone offline');
    expect(msg).not.toContain('as of');
  });

  it('formats low_battery with level', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'low_battery',
      batteryLevel: 8,
    });
    expect(msg).toContain('battery low (8%)');
    expect(msg).toContain('🔔');
  });

  it('formats low_battery with fallback when no level', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'low_battery',
    });
    expect(msg).toContain('battery low (low%)');
  });

  it('formats door_open with duration', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'door_open',
      doorDurationMinutes: 15,
    });
    expect(msg).toContain('door open for 15 min');
  });

  it('formats missed_manual_entry', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'missed_manual_entry',
    });
    expect(msg).toContain('due for a manual temperature log');
    expect(msg).toContain('📝');
  });

  it('formats sensor_fault', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'sensor_fault',
    });
    expect(msg).toContain('reporting a fault');
  });

  it('formats calibration_due', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'calibration_due',
    });
    expect(msg).toContain('due for calibration');
  });

  it('formats suspected_cooling_failure', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'suspected_cooling_failure',
    });
    expect(msg).toContain('cooling failure');
    expect(msg).toContain('🚨');
  });

  it('formats unknown type with fallback', () => {
    const msg = buildSmsTemplate({
      ...baseSmsCtx,
      alertType: 'future_alert_type',
    });
    expect(msg).toContain('Walk-in Cooler A');
    expect(msg).toContain('future_alert_type');
  });
});

// ─── buildEscalationSmsTemplate ───────────────────────────────────────────────

describe('buildEscalationSmsTemplate', () => {
  const baseEscCtx: EscalationSmsContext = {
    unitName: 'Walk-in Cooler A',
    siteName: 'Main Kitchen',
    alertType: 'alarm_active',
    stepNumber: 2,
    elapsedMinutes: 30,
  };

  it('includes escalation prefix with step and elapsed time', () => {
    const msg = buildEscalationSmsTemplate(baseEscCtx);
    expect(msg).toContain('[ESCALATION Step 2');
    expect(msg).toContain('30m]');
  });

  it('includes temp reading when provided', () => {
    const msg = buildEscalationSmsTemplate({
      ...baseEscCtx,
      tempReading: '48.5°F',
    });
    expect(msg).toContain('Current: 48.5°F');
  });

  it('includes site name when no temp reading', () => {
    const msg = buildEscalationSmsTemplate(baseEscCtx);
    expect(msg).toContain('at Main Kitchen');
  });

  it('includes "Immediate action required"', () => {
    const msg = buildEscalationSmsTemplate(baseEscCtx);
    expect(msg).toContain('Immediate action required');
  });

  it('truncates to 160 chars with ellipsis for long messages', () => {
    const msg = buildEscalationSmsTemplate({
      ...baseEscCtx,
      unitName: 'A Very Long Unit Name That Will Make The Message Exceed The Maximum SMS Character Limit',
      siteName: 'A Very Long Site Name For Extra Length',
      stepNumber: 99,
      elapsedMinutes: 9999,
    });
    expect(msg.length).toBeLessThanOrEqual(160);
    expect(msg).toMatch(/\.\.\.$/);
  });

  it('does not truncate messages under 160 chars', () => {
    const msg = buildEscalationSmsTemplate(baseEscCtx);
    expect(msg.length).toBeLessThanOrEqual(160);
    expect(msg).not.toMatch(/\.\.\.$/);
  });
});

// ─── buildEmailSubject ────────────────────────────────────────────────────────

describe('buildEmailSubject', () => {
  it('formats with uppercased severity and alert label', () => {
    const subject = buildEmailSubject('alarm_active', 'critical', 'Unit A');
    expect(subject).toBe('[CRITICAL] Temperature Alarm: Unit A');
  });

  it('uses raw alert type for unknown types', () => {
    const subject = buildEmailSubject('unknown_type', 'warning', 'Unit B');
    expect(subject).toBe('[WARNING] unknown_type: Unit B');
  });
});

describe('buildEscalationEmailSubject', () => {
  it('formats with step number', () => {
    const subject = buildEscalationEmailSubject('alarm_active', 3, 'Unit A');
    expect(subject).toBe('[ESCALATION Step 3] Temperature Alarm: Unit A');
  });
});

// ─── buildInAppTitle ──────────────────────────────────────────────────────────

describe('buildInAppTitle', () => {
  it('includes severity emoji and alert label', () => {
    const title = buildInAppTitle(baseInAppCtx);
    expect(title).toBe('🔴 Temperature Alarm: Walk-in Cooler A');
  });

  it('uses fallback emoji for unknown severity', () => {
    const title = buildInAppTitle({ ...baseInAppCtx, severity: 'unknown' as any });
    expect(title).toContain('🔔');
  });
});

// ─── buildInAppBody ───────────────────────────────────────────────────────────

describe('buildInAppBody', () => {
  it('returns escalation text when step is provided', () => {
    const body = buildInAppBody({ ...baseInAppCtx, escalationStep: 2, message: 'temp is high' });
    expect(body).toContain('Escalation Step 2');
    expect(body).toContain('temp is high');
  });

  it('returns message when no escalation', () => {
    const body = buildInAppBody({ ...baseInAppCtx, message: 'temp is high' });
    expect(body).toBe('temp is high');
  });

  it('falls back to title when no message', () => {
    const body = buildInAppBody({ ...baseInAppCtx, title: 'Alert Title' });
    expect(body).toBe('Alert Title');
  });

  it('returns default when no message or title', () => {
    const body = buildInAppBody(baseInAppCtx);
    expect(body).toBe('Alert triggered — check unit status');
  });

  it('uses fallback in escalation when no message or title', () => {
    const body = buildInAppBody({ ...baseInAppCtx, escalationStep: 1 });
    expect(body).toContain('Requires attention');
  });
});

// ─── buildAckNotificationTitle / Body ─────────────────────────────────────────

describe('buildAckNotificationTitle', () => {
  it('wraps alert title', () => {
    expect(buildAckNotificationTitle('Temp Alarm: Unit A')).toBe('You acknowledged: Temp Alarm: Unit A');
  });
});

describe('buildAckNotificationBody', () => {
  it('returns notes when provided', () => {
    expect(buildAckNotificationBody('Checked and cleared')).toBe(
      'Your acknowledgement note: "Checked and cleared"'
    );
  });

  it('returns ack time when no notes', () => {
    expect(buildAckNotificationBody(null, '2:30 PM')).toBe('Alert acknowledged at 2:30 PM');
  });

  it('uses current time fallback when neither notes nor ackTime', () => {
    const body = buildAckNotificationBody();
    expect(body).toContain('Alert acknowledged at');
  });
});

// ─── formatAlertDetail ────────────────────────────────────────────────────────

describe('formatAlertDetail', () => {
  it('formats temp_excursion with reading > limit', () => {
    const detail = formatAlertDetail({
      alertType: 'temp_excursion',
      tempReading: 45.3,
      tempLimit: 40.0,
    });
    expect(detail).toBe('Current 45.3°F > Limit 40.0°F');
  });

  it('formats alarm_active with reading < limit', () => {
    const detail = formatAlertDetail({
      alertType: 'alarm_active',
      tempReading: 28.0,
      tempLimit: 32.0,
    });
    expect(detail).toBe('Current 28.0°F < Limit 32.0°F');
  });

  it('formats monitoring_interrupted with missed check-ins', () => {
    const detail = formatAlertDetail({
      alertType: 'monitoring_interrupted',
      metadata: { missed_checkins: 5 },
    });
    expect(detail).toBe('Missed 5 check-ins');
  });

  it('formats monitoring_interrupted with single missed check-in', () => {
    const detail = formatAlertDetail({
      alertType: 'monitoring_interrupted',
      metadata: { missed_checkins: 1 },
    });
    expect(detail).toBe('Missed 1 check-in');
  });

  it('formats monitoring_interrupted without metadata', () => {
    const detail = formatAlertDetail({
      alertType: 'monitoring_interrupted',
    });
    expect(detail).toBe('No sensor data received');
  });

  it('formats missed_manual_entry', () => {
    expect(formatAlertDetail({ alertType: 'missed_manual_entry' })).toBe(
      'Manual temperature log overdue'
    );
  });

  it('formats low_battery with level', () => {
    const detail = formatAlertDetail({
      alertType: 'low_battery',
      metadata: { battery_level: 8 },
    });
    expect(detail).toBe('Battery at 8%');
  });

  it('formats low_battery without level', () => {
    expect(formatAlertDetail({ alertType: 'low_battery' })).toBe('Battery level low');
  });

  it('formats door_open with duration', () => {
    const detail = formatAlertDetail({
      alertType: 'door_open',
      metadata: { open_duration_minutes: 12 },
    });
    expect(detail).toBe('Door open for 12 minutes');
  });

  it('formats door_open without duration', () => {
    expect(formatAlertDetail({ alertType: 'door_open' })).toBe('Door has been left open');
  });

  it('formats suspected_cooling_failure', () => {
    expect(formatAlertDetail({ alertType: 'suspected_cooling_failure' })).toBe(
      'Temperature rising despite door closed'
    );
  });

  it('formats sensor_fault', () => {
    expect(formatAlertDetail({ alertType: 'sensor_fault' })).toBe('Sensor reporting errors');
  });

  it('formats calibration_due', () => {
    expect(formatAlertDetail({ alertType: 'calibration_due' })).toBe('Sensor calibration overdue');
  });

  it('returns message for unknown type', () => {
    expect(formatAlertDetail({ alertType: 'unknown', message: 'Custom msg' })).toBe('Custom msg');
  });

  it('returns "Alert triggered" as final fallback', () => {
    expect(formatAlertDetail({ alertType: 'unknown' })).toBe('Alert triggered');
  });
});
