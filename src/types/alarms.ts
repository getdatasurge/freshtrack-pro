/**
 * Alarm Definition Library Types
 *
 * Type definitions for the FrostGuard Alarm Definition Library.
 * Maps to the alarm_definitions, alarm_*_overrides, and alarm_events tables.
 */

export type DetectionTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export type AlarmCategory =
  | 'temperature' | 'door' | 'environmental'
  | 'sensor_health' | 'compliance' | 'security' | 'normal';

export type AlarmSeverity = 'info' | 'normal' | 'warning' | 'critical' | 'emergency';

export type AIHint =
  | 'rate_of_change' | 'trend_analysis' | 'oscillation_detect'
  | 'frequency_analysis' | 'recovery_detection' | 'correlate_with_door'
  | 'check_site_wide' | 'cross_sensor_correlate' | 'rule_out_door'
  | 'site_wide_correlation' | 'power_outage_detect' | 'isolation_detect'
  | 'sensor_comparison' | 'overnight_pattern' | 'business_hours'
  | 'sustained_threshold' | 'spike_plateau_detect' | 'defrost_pattern'
  | 'threshold_crossing_count' | 'stale_data_detect' | 'gap_detection'
  | 'battery_drain_rate' | 'range_validation' | 'recurrence_detect'
  | 'tvoc_source_inference' | 'tvoc_temp_correlation' | 'tvoc_decay_pattern'
  | 'spike_detect' | 'gradual_rise_detect' | 'humidity_temp_correlation';

export type SensorKey = 'LHT65' | 'LDS02' | 'R311A' | 'ERS_CO2' | 'LWL02' | 'R720E';

export interface AlarmDefinition {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  short_description?: string;
  category: AlarmCategory;
  subcategory: string;
  severity: AlarmSeverity;
  sort_order: number;
  detection_tier: DetectionTier;
  required_sensors: string;
  confidence_level: string;
  what_we_observe: string;
  what_it_might_mean?: string;
  applicable_unit_types: string[];
  applicable_sensor_types: string[];
  threshold_min?: number;
  threshold_max?: number;
  threshold_unit?: string;
  duration_minutes?: number;
  cooldown_minutes?: number;
  eval_field?: string;
  eval_logic?: string;
  eval_params?: Record<string, unknown>;
  notification_template?: string;
  notification_channels: string[];
  requires_corrective_action: boolean;
  corrective_action_text?: string;
  haccp_category?: string;
  regulatory_reference?: string;
  escalation_minutes?: number;
  ai_hints: AIHint[];
  emulator_enabled: boolean;
  enabled_by_default: boolean;
  is_system: boolean;
  icon_name?: string;
  color?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ResolvedAlarm extends AlarmDefinition {
  available: boolean;
  tierAvailable: boolean;
  sensorsAvailable: boolean;
  effectiveEnabled: boolean;
  effectiveSeverity: AlarmSeverity;
  effectiveThresholdMin?: number;
  effectiveThresholdMax?: number;
}

export type AlarmEventState = 'active' | 'acknowledged' | 'resolved' | 'auto_resolved' | 'snoozed';

export interface AlarmEvent {
  id: string;
  alarm_definition_id: string;
  alarm_definition?: AlarmDefinition;
  org_id: string;
  site_id?: string;
  unit_id?: string;
  dev_eui?: string;
  state: AlarmEventState;
  severity_at_trigger: AlarmSeverity;
  trigger_value?: number;
  trigger_field?: string;
  trigger_payload?: Record<string, unknown>;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  corrective_action_taken?: string;
  escalated: boolean;
  escalated_at?: string;
  escalation_count: number;
  snoozed_until?: string;
  triggered_at: string;
  updated_at: string;
}

export interface TierResolution {
  availableTiers: DetectionTier[];
  sensorKinds: string[];
  sensorCount: number;
  siteUnitCount: number;
}

export interface AlarmOverride {
  id: string;
  alarm_definition_id: string;
  org_id: string;
  site_id?: string;
  unit_id?: string;
  enabled?: boolean;
  severity_override?: AlarmSeverity;
  threshold_min?: number;
  threshold_max?: number;
  duration_minutes?: number;
  cooldown_minutes?: number;
  escalation_minutes?: number;
  notification_channels?: string[];
  custom_corrective_action?: string;
  created_at: string;
  updated_at: string;
}

/** Row returned by the get_available_alarms_for_unit RPC */
export interface AvailableAlarmRow {
  alarm_id: string;
  slug: string;
  display_name: string;
  category: AlarmCategory;
  severity: AlarmSeverity;
  detection_tier: DetectionTier;
  confidence_level: string;
  what_we_observe: string;
  enabled: boolean;
}
