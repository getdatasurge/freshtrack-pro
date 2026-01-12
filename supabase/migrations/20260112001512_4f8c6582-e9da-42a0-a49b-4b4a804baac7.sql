-- 1. Add cluster_lock column with default 'eu1'
ALTER TABLE ttn_connections 
ADD COLUMN IF NOT EXISTS cluster_lock text DEFAULT 'eu1';

-- 2. Fix existing records: change NAM1 to EU1
UPDATE ttn_connections 
SET ttn_region = 'eu1', cluster_lock = 'eu1' 
WHERE ttn_region IS NULL OR LOWER(ttn_region) != 'eu1';

-- 3. Change the default for ttn_region from NAM1 to EU1
ALTER TABLE ttn_connections 
ALTER COLUMN ttn_region SET DEFAULT 'eu1';

-- 4. Add check constraint to enforce EU1-only
ALTER TABLE ttn_connections 
ADD CONSTRAINT ttn_connections_eu1_only 
CHECK (LOWER(ttn_region) = 'eu1');