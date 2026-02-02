-- Create enums for sensor configuration
CREATE TYPE sensor_change_status AS ENUM ('queued', 'sent', 'applied', 'failed', 'timeout');
CREATE TYPE sensor_change_type AS ENUM ('uplink_interval', 'ext_mode', 'time_sync', 'set_time', 'alarm', 'clear_datalog', 'pnackmd', 'raw');

-- sensor_configurations table
CREATE TABLE sensor_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES lora_sensors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uplink_interval_s INTEGER,
  ext_mode TEXT CHECK (ext_mode IN ('e3_ext1', 'e3_ext9')),
  time_sync_enabled BOOLEAN DEFAULT false,
  time_sync_days INTEGER CHECK (time_sync_days >= 0 AND time_sync_days <= 255),
  override_unit_alarm BOOLEAN DEFAULT false,
  alarm_enabled BOOLEAN DEFAULT false,
  alarm_low NUMERIC(6,2),
  alarm_high NUMERIC(6,2),
  alarm_check_minutes INTEGER CHECK (alarm_check_minutes >= 1 AND alarm_check_minutes <= 65535),
  default_fport INTEGER DEFAULT 2 CHECK (default_fport >= 1 AND default_fport <= 223),
  last_applied_at TIMESTAMPTZ,
  pending_change_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (sensor_id)
);

-- sensor_pending_changes table
CREATE TABLE sensor_pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES lora_sensors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  change_type sensor_change_type NOT NULL,
  requested_payload_hex TEXT NOT NULL,
  requested_fport INTEGER DEFAULT 2 CHECK (requested_fport >= 1 AND requested_fport <= 223),
  status sensor_change_status DEFAULT 'queued' NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  command_params JSONB,
  expected_result TEXT,
  debug_response JSONB,
  requested_by UUID REFERENCES auth.users(id),
  requested_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add FK from sensor_configurations.pending_change_id to sensor_pending_changes.id
ALTER TABLE sensor_configurations 
  ADD CONSTRAINT fk_pending_change 
  FOREIGN KEY (pending_change_id) REFERENCES sensor_pending_changes(id) ON DELETE SET NULL;

-- Create indexes for efficient querying
CREATE INDEX idx_sensor_configurations_sensor_id ON sensor_configurations(sensor_id);
CREATE INDEX idx_sensor_configurations_organization_id ON sensor_configurations(organization_id);
CREATE INDEX idx_sensor_pending_changes_sensor_id ON sensor_pending_changes(sensor_id);
CREATE INDEX idx_sensor_pending_changes_organization_id ON sensor_pending_changes(organization_id);
CREATE INDEX idx_sensor_pending_changes_status ON sensor_pending_changes(status);

-- Enable RLS
ALTER TABLE sensor_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_pending_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies for sensor_configurations (using user_roles table)
CREATE POLICY "Users can view sensor configs in their org"
  ON sensor_configurations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert sensor configs in their org"
  ON sensor_configurations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update sensor configs in their org"
  ON sensor_configurations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete sensor configs in their org"
  ON sensor_configurations FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

-- RLS policies for sensor_pending_changes (using user_roles table)
CREATE POLICY "Users can view pending changes in their org"
  ON sensor_pending_changes FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert pending changes in their org"
  ON sensor_pending_changes FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update pending changes in their org"
  ON sensor_pending_changes FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete pending changes in their org"
  ON sensor_pending_changes FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  ));

-- Trigger to update updated_at
CREATE TRIGGER update_sensor_configurations_updated_at
  BEFORE UPDATE ON sensor_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sensor_pending_changes_updated_at
  BEFORE UPDATE ON sensor_pending_changes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();