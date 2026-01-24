-- Migration: Add TTN Deprovisioning Support
-- This migration adds schema support for the new ttn-deprovision edge function
-- which properly cleans up TTN resources to prevent orphaned DevEUIs.

-- Add index on ttn_connections for faster org-based lookups during deprovisioning
CREATE INDEX IF NOT EXISTS idx_ttn_connections_org_app
ON ttn_connections(organization_id, ttn_application_id)
WHERE ttn_application_id IS NOT NULL;

-- Add index for provisioning status to quickly find provisioned orgs
CREATE INDEX IF NOT EXISTS idx_ttn_connections_provisioning_status
ON ttn_connections(provisioning_status)
WHERE provisioning_status IS NOT NULL;

-- Update comment on ttn_region to clarify dual-endpoint architecture
COMMENT ON COLUMN ttn_connections.ttn_region IS
  'TTN cluster region (nam1, eu1, au1). Used for data plane operations. Identity Server is always on EU1.';

-- Add comment documenting the deprovisioning workflow
COMMENT ON TABLE ttn_connections IS
  'Per-organization TTN connection settings. Supports full deprovisioning workflow:
   1. Delete + purge all devices from NS/AS/JS (data planes)
   2. Delete + purge devices from IS (registry)
   3. Delete + purge application
   4. Delete + purge organization
   5. Clear local DB records

   Use ttn-deprovision edge function for comprehensive cleanup.
   Use ttn-force-release-eui for manual DevEUI release across clusters.';

-- Ensure sensors table has proper index for bulk updates during deprovisioning
CREATE INDEX IF NOT EXISTS idx_sensors_org_ttn_device
ON sensors(organization_id, ttn_device_id)
WHERE ttn_device_id IS NOT NULL;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Added TTN deprovisioning support indexes and documentation';
END $$;
