/**
 * Sensor Configuration & Pending Changes Types
 *
 * Per-sensor device configuration and downlink change tracking.
 * Unit settings are canonical for alarms; sensors inherit unless
 * override_unit_alarm is explicitly enabled.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type SensorChangeStatus = 'queued' | 'sent' | 'applied' | 'failed' | 'timeout';

export type SensorChangeType =
  | 'uplink_interval'
  | 'ext_mode'
  | 'time_sync'
  | 'set_time'
  | 'alarm'
  | 'clear_datalog'
  | 'pnackmd'
  | 'raw'
  | 'catalog';

export type ExtMode = 'e3_ext1' | 'e3_ext9';

// ---------------------------------------------------------------------------
// Sensor Configuration (DB row)
// ---------------------------------------------------------------------------

export interface SensorConfiguration {
  id: string;
  sensor_id: string;
  organization_id: string;

  uplink_interval_s: number | null;
  /** Last interval confirmed by the sensor (only updated on confirmation) */
  confirmed_uplink_interval_s: number | null;
  ext_mode: ExtMode | null;

  time_sync_enabled: boolean;
  time_sync_days: number | null;

  override_unit_alarm: boolean;
  alarm_enabled: boolean;
  alarm_low: number | null;       // degrees C
  alarm_high: number | null;      // degrees C
  alarm_check_minutes: number | null;

  default_fport: number;

  last_applied_at: string | null;
  pending_change_id: string | null;

  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Sensor Pending Change (DB row)
// ---------------------------------------------------------------------------

export interface SensorPendingChange {
  id: string;
  sensor_id: string;
  organization_id: string;

  change_type: SensorChangeType;
  requested_payload_hex: string;
  requested_fport: number;

  status: SensorChangeStatus;
  requested_at: string;
  sent_at: string | null;
  applied_at: string | null;
  failed_at: string | null;

  command_params: Record<string, unknown> | null;
  expected_result: string | null;

  debug_response: Record<string, unknown> | null;
  requested_by: string | null;
  requested_by_email: string | null;

  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Downlink Command Params (sent from UI → edge function)
// ---------------------------------------------------------------------------

export interface DownlinkRequest {
  sensor_id: string;
  command_type: SensorChangeType;
  command_params: DownlinkCommandParams;
}

export type DownlinkCommandParams =
  | { type: 'uplink_interval'; seconds: number }
  | { type: 'ext_mode'; mode: ExtMode }
  | { type: 'time_sync'; enable: boolean }
  | { type: 'time_sync_days'; days: number }
  | { type: 'set_time'; unix_ts: number }
  | { type: 'alarm'; enable: boolean; check_minutes: number; low_c: number; high_c: number }
  | { type: 'clear_datalog' }
  | { type: 'pnackmd'; enable: boolean }
  | { type: 'raw'; hex: string; fport?: number }
  | { type: 'catalog'; hex: string; fport: number; commandKey: string; commandName: string; expectedResult: string; fieldValues?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

export interface UplinkPreset {
  label: string;
  description: string;
  interval_s: number;
}

export const UPLINK_PRESETS: UplinkPreset[] = [
  { label: 'Power Saver', description: 'Reports every 30 min', interval_s: 1800 },
  { label: 'Standard', description: 'Reports every 10 min', interval_s: 600 },
  { label: 'Frequent', description: 'Reports every 2 min', interval_s: 120 },
];

// ---------------------------------------------------------------------------
// Edge function response
// ---------------------------------------------------------------------------

export interface DownlinkResponse {
  ok: boolean;
  pending_change_id?: string;
  hex_payload?: string;
  error?: string;
  debug?: Record<string, unknown>;
}
