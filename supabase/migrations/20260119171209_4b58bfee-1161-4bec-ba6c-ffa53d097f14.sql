-- Drop the outdated eu1_only check constraint and update to NAM1
-- The application is now NAM1-only, so this constraint is incorrect

-- First drop the old constraint
ALTER TABLE ttn_connections DROP CONSTRAINT IF EXISTS ttn_connections_eu1_only;

-- Update all records to use NAM1 cluster (the only supported cluster)
UPDATE ttn_connections
SET 
  ttn_region = 'nam1',
  cluster_lock = 'nam1',
  updated_at = now()
WHERE ttn_region != 'nam1' OR cluster_lock != 'nam1' OR ttn_region IS NULL OR cluster_lock IS NULL;

-- Add a new check constraint ensuring NAM1 only
ALTER TABLE ttn_connections ADD CONSTRAINT ttn_connections_nam1_only 
  CHECK (ttn_region = 'nam1' AND cluster_lock = 'nam1');

-- Update default values for new records
ALTER TABLE ttn_connections ALTER COLUMN ttn_region SET DEFAULT 'nam1';
ALTER TABLE ttn_connections ALTER COLUMN cluster_lock SET DEFAULT 'nam1';