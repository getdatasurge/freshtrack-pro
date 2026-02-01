-- =============================================================================
-- Sensor Configuration & Pending Changes
--
-- Stores per-sensor device configuration (uplink interval, ext mode, alarms,
-- time sync) and tracks pending downlink changes (queued → sent → applied).
--
-- Design: Unit settings are canonical for alarm thresholds. Sensors inherit
-- unit defaults unless override_unit_alarm is true.
-- =============================================================================

-- Pending change status enum
CREATE TYPE sensor_change_status AS ENUM (
  'queued',
  'sent',
  'applied',
  'failed',
  'timeout'
);

-- Change type enum
CREATE TYPE sensor_change_type AS ENUM (
  'uplink_interval',
  'ext_mode',
  'time_sync',
  'set_time',
  'alarm',
  'clear_datalog',
  'pnackmd',
  'raw'
);

-- =============================================================================
-- sensor_configurations: per-sensor device settings
-- =============================================================================
CREATE TABLE sensor_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES lora_sensors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Uplink interval
  uplink_interval_s INTEGER,           -- seconds between uplinks

  -- External sensor mode (LHT65N)
  ext_mode TEXT CHECK (ext_mode IN ('e3_ext1', 'e3_ext9')),

  -- Time sync
  time_sync_enabled BOOLEAN DEFAULT false,
  time_sync_days INTEGER CHECK (time_sync_days >= 0 AND time_sync_days <= 255),

  -- Alarm (sensor-level override of unit settings)
  override_unit_alarm BOOLEAN DEFAULT false,
  alarm_enabled BOOLEAN DEFAULT false,
  alarm_low NUMERIC(6,2),              -- degrees C
  alarm_high NUMERIC(6,2),             -- degrees C
  alarm_check_minutes INTEGER CHECK (alarm_check_minutes >= 1 AND alarm_check_minutes <= 65535),

  -- Default downlink fport
  default_fport INTEGER DEFAULT 2 CHECK (default_fport >= 1 AND default_fport <= 223),

  -- Tracking
  last_applied_at TIMESTAMPTZ,
  pending_change_id UUID,              -- FK added after table creation

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  UNIQUE (sensor_id)
);

-- Enable RLS
ALTER TABLE sensor_configurations ENABLE ROW LEVEL SECURITY;

-- RLS policies: org members can read/write their own sensor configs
CREATE POLICY "sensor_configurations_select"
  ON sensor_configurations FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "sensor_configurations_insert"
  ON sensor_configurations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "sensor_configurations_update"
  ON sensor_configurations FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "sensor_configurations_delete"
  ON sensor_configurations FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- =============================================================================
-- sensor_pending_changes: downlink command queue with status tracking
-- =============================================================================
CREATE TABLE sensor_pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES lora_sensors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Command details
  change_type sensor_change_type NOT NULL,
  requested_payload_hex TEXT NOT NULL,
  requested_fport INTEGER DEFAULT 2 CHECK (requested_fport >= 1 AND requested_fport <= 223),

  -- Status tracking
  status sensor_change_status DEFAULT 'queued' NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- What we sent and what we expect
  command_params JSONB,                -- original parameters for display
  expected_result TEXT,                -- human-readable expected outcome

  -- TTN API response metadata
  debug_response JSONB,

  -- Who requested it
  requested_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE sensor_pending_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "sensor_pending_changes_select"
  ON sensor_pending_changes FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "sensor_pending_changes_insert"
  ON sensor_pending_changes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "sensor_pending_changes_update"
  ON sensor_pending_changes FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "sensor_pending_changes_delete"
  ON sensor_pending_changes FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Now add the FK from sensor_configurations to sensor_pending_changes
ALTER TABLE sensor_configurations
  ADD CONSTRAINT fk_pending_change
  FOREIGN KEY (pending_change_id) REFERENCES sensor_pending_changes(id)
  ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_sensor_config_sensor_id ON sensor_configurations(sensor_id);
CREATE INDEX idx_sensor_config_org_id ON sensor_configurations(organization_id);
CREATE INDEX idx_pending_changes_sensor_id ON sensor_pending_changes(sensor_id);
CREATE INDEX idx_pending_changes_org_id ON sensor_pending_changes(organization_id);
CREATE INDEX idx_pending_changes_status ON sensor_pending_changes(status) WHERE status IN ('queued', 'sent');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sensor_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sensor_config_updated_at
  BEFORE UPDATE ON sensor_configurations
  FOR EACH ROW EXECUTE FUNCTION update_sensor_config_updated_at();

CREATE TRIGGER trg_pending_changes_updated_at
  BEFORE UPDATE ON sensor_pending_changes
  FOR EACH ROW EXECUTE FUNCTION update_sensor_config_updated_at();
