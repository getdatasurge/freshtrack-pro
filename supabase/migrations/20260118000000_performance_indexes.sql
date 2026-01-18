-- Performance Indexes Migration
-- Date: 2026-01-18
-- Purpose: Add composite indexes identified in performance audit

-- Door events: composite for unit detail page queries
-- Improves: UnitDetail door events fetch
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_door_events_unit_occurred_desc
ON door_events(unit_id, occurred_at DESC);

-- Lora sensors: for unit dashboard primary sensor queries
-- Improves: Primary sensor selection, unit header
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lora_sensors_unit_primary
ON lora_sensors(unit_id, is_primary) WHERE deleted_at IS NULL;

-- Sensor readings: for time-range queries with source filtering
-- Improves: Distinguishing emulator vs real readings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_readings_unit_source_time
ON sensor_readings(unit_id, source, recorded_at DESC);

-- Notification policies: for effective policy lookup
-- Improves: get_effective_notification_policy RPC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_policies_scope
ON notification_policies(COALESCE(unit_id, site_id, organization_id));

-- SMS alert log: for history queries with org scope
-- Improves: Settings page SMS history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_alert_log_org_created
ON sms_alert_log(organization_id, created_at DESC);

-- TTN deprovision jobs: for status dashboard with org scope
-- Improves: TTN cleanup job monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ttn_deprovision_jobs_org_status_created
ON ttn_deprovision_jobs(organization_id, status, created_at DESC);

-- Comment: These indexes use CONCURRENTLY to avoid blocking writes during creation
