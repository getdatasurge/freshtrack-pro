-- ==============================================
-- 1. Add organization_id to devices table
-- ==============================================

-- Add organization_id column
ALTER TABLE devices ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_devices_organization_id ON devices(organization_id);

-- Backfill existing devices from unit hierarchy
UPDATE devices d
SET organization_id = s.organization_id
FROM units u
JOIN areas a ON a.id = u.area_id
JOIN sites s ON s.id = a.site_id
WHERE d.unit_id = u.id AND d.organization_id IS NULL;

-- Add unique constraint for org-scoped serial numbers
ALTER TABLE devices ADD CONSTRAINT devices_org_serial_unique 
  UNIQUE (organization_id, serial_number);

-- ==============================================
-- 2. Fix lora_sensors unique constraints
-- ==============================================

-- Remove global dev_eui uniqueness (keep org-scoped)
ALTER TABLE lora_sensors DROP CONSTRAINT IF EXISTS lora_sensors_dev_eui_key;

-- ==============================================
-- 3. Create emulator_sync_runs table
-- ==============================================

CREATE TABLE IF NOT EXISTS emulator_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sync_id text,
  synced_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed',
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by org
CREATE INDEX IF NOT EXISTS idx_emulator_sync_runs_org ON emulator_sync_runs(organization_id);

-- Index for querying recent syncs
CREATE INDEX IF NOT EXISTS idx_emulator_sync_runs_created ON emulator_sync_runs(created_at DESC);

-- Enable RLS
ALTER TABLE emulator_sync_runs ENABLE ROW LEVEL SECURITY;

-- RLS policy: admins can view sync runs
CREATE POLICY "Admins can view sync runs"
  ON emulator_sync_runs FOR SELECT
  USING (
    has_role(auth.uid(), organization_id, 'owner'::app_role) OR 
    has_role(auth.uid(), organization_id, 'admin'::app_role)
  );

-- ==============================================
-- 4. Update RLS policies for devices table
-- ==============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage devices" ON devices;
DROP POLICY IF EXISTS "Users can view devices" ON devices;

-- New policy: Admins can manage devices (with org_id support)
CREATE POLICY "Admins can manage devices"
  ON devices FOR ALL
  USING (
    (organization_id IS NOT NULL AND (
      has_role(auth.uid(), organization_id, 'owner'::app_role) OR
      has_role(auth.uid(), organization_id, 'admin'::app_role)
    )) OR
    (unit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM units u
      JOIN areas a ON a.id = u.area_id
      JOIN sites s ON s.id = a.site_id
      WHERE u.id = devices.unit_id
      AND (has_role(auth.uid(), s.organization_id, 'owner'::app_role) OR 
           has_role(auth.uid(), s.organization_id, 'admin'::app_role))
    ))
  );

-- New policy: Users can view devices (with org_id support)
CREATE POLICY "Users can view devices"
  ON devices FOR SELECT
  USING (
    (organization_id IS NOT NULL AND 
      user_belongs_to_org(auth.uid(), organization_id)) OR
    (unit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM units u
      JOIN areas a ON a.id = u.area_id
      JOIN sites s ON s.id = a.site_id
      WHERE u.id = devices.unit_id
      AND user_belongs_to_org(auth.uid(), s.organization_id)
    ))
  );