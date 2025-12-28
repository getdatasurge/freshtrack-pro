-- Add signal_strength column to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS signal_strength INTEGER DEFAULT NULL;

-- Add sensor reliability tracking columns to units table
ALTER TABLE units ADD COLUMN IF NOT EXISTS consecutive_checkins INTEGER DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS sensor_reliable BOOLEAN DEFAULT false;
ALTER TABLE units ADD COLUMN IF NOT EXISTS manual_logging_enabled BOOLEAN DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_signal_strength ON devices(signal_strength) WHERE signal_strength IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_sensor_reliable ON units(sensor_reliable);
CREATE INDEX IF NOT EXISTS idx_units_last_checkin ON units(last_checkin_at);