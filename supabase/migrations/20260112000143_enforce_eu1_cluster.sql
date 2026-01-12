-- Migration: Enforce EU1 cluster for TTN connections
-- Fixes split-cluster provisioning bug where devices were registered on wrong cluster

-- Step 1: Update all existing records to use eu1
UPDATE ttn_connections
SET ttn_region = 'eu1'
WHERE ttn_region IS NULL OR ttn_region != 'eu1';

-- Step 2: Add check constraint to enforce eu1 only
-- This prevents future records from using wrong cluster
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ttn_connections_eu1_only'
  ) THEN
    ALTER TABLE ttn_connections
    ADD CONSTRAINT ttn_connections_eu1_only
    CHECK (ttn_region = 'eu1');
  END IF;
END $$;

-- Step 3: Set default value for ttn_region column
ALTER TABLE ttn_connections
ALTER COLUMN ttn_region SET DEFAULT 'eu1';

-- Step 4: Add comment explaining the constraint
COMMENT ON CONSTRAINT ttn_connections_eu1_only ON ttn_connections IS
'Enforces EU1 cluster for all TTN connections. TTN Identity Server is always on EU1,
and using different clusters for JS/NS/AS causes split-cluster bugs where devices
show as "Other cluster" in the console.';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: All ttn_connections forced to eu1 cluster';
END $$;
