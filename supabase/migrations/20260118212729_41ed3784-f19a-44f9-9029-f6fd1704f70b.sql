-- Switch TTN default region from eu1 to nam1 for new organizations
-- Existing organizations remain on their current region (no data migration)

-- 1. Change default ttn_region from eu1 to nam1
ALTER TABLE ttn_connections ALTER COLUMN ttn_region SET DEFAULT 'nam1';

-- 2. Update cluster_lock default to nam1
ALTER TABLE ttn_connections ALTER COLUMN cluster_lock SET DEFAULT 'nam1';

-- 3. Add comment explaining multi-cluster support
COMMENT ON COLUMN ttn_connections.ttn_region IS 
  'TTN cluster region: nam1 (North America, US915), eu1 (Europe, EU868), au1 (Australia, AU915). Default: nam1 for new orgs.';