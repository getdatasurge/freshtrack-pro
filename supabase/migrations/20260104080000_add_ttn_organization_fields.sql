-- Add TTN Organization fields to ttn_connections table
-- This migration supports the organization-based provisioning architecture:
-- 1. Create TTN Organization per customer
-- 2. Create Org-scoped API key
-- 3. Create Application under org
-- 4. Create App-scoped API key
-- 5. Create Webhook

-- Add TTN Organization ID field
ALTER TABLE ttn_connections
ADD COLUMN IF NOT EXISTS ttn_organization_id TEXT;

-- Add TTN Organization API key fields (org-scoped key for creating apps/gateways)
ALTER TABLE ttn_connections
ADD COLUMN IF NOT EXISTS ttn_org_api_key_encrypted TEXT;

ALTER TABLE ttn_connections
ADD COLUMN IF NOT EXISTS ttn_org_api_key_last4 TEXT;

ALTER TABLE ttn_connections
ADD COLUMN IF NOT EXISTS ttn_org_api_key_id TEXT;

-- Add timestamp for when the org was provisioned
ALTER TABLE ttn_connections
ADD COLUMN IF NOT EXISTS ttn_organization_provisioned_at TIMESTAMPTZ;

-- Add index for faster lookups by TTN organization ID
CREATE INDEX IF NOT EXISTS idx_ttn_connections_ttn_organization_id
ON ttn_connections(ttn_organization_id)
WHERE ttn_organization_id IS NOT NULL;

-- Add comment explaining the architecture
COMMENT ON COLUMN ttn_connections.ttn_organization_id IS
  'TTN Organization ID (fg-org-{uuid8}). Each customer gets their own TTN org for tenant isolation.';

COMMENT ON COLUMN ttn_connections.ttn_org_api_key_encrypted IS
  'Encrypted org-scoped API key. Used to create applications and gateways under the org.';

COMMENT ON COLUMN ttn_connections.ttn_org_api_key_last4 IS
  'Last 4 characters of the org API key for display purposes.';

COMMENT ON COLUMN ttn_connections.ttn_org_api_key_id IS
  'TTN API key ID for the org-scoped key, used for key management.';
