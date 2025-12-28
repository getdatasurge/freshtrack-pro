-- Add source column to sensor_readings for vendor-agnostic ingest
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ble';

-- Add accent_color to organizations for white-label branding
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#0097a7';

-- Create index on source for filtering by vendor
CREATE INDEX IF NOT EXISTS idx_sensor_readings_source ON sensor_readings(source);