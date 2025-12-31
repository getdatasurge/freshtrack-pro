-- Add per-organization TTN application provisioning fields to ttn_connections
-- These fields track the org's own TTN application (not shared)

-- Add provisioning status tracking columns
ALTER TABLE ttn_connections 
ADD COLUMN IF NOT EXISTS provisioning_status text DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS provisioning_error text,
ADD COLUMN IF NOT EXISTS ttn_application_provisioned_at timestamptz,
ADD COLUMN IF NOT EXISTS ttn_api_key_id text;

-- Add index on webhook secret for fast lookup during webhook authentication
-- This allows the webhook to identify the org by matching the secret
CREATE INDEX IF NOT EXISTS idx_ttn_connections_webhook_secret_lookup 
ON ttn_connections (ttn_webhook_secret_encrypted) 
WHERE ttn_webhook_secret_encrypted IS NOT NULL;

-- Add unique constraint on ttn_application_id to ensure each org has a unique TTN app
-- Only apply when application_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_ttn_connections_application_id_unique
ON ttn_connections (ttn_application_id)
WHERE ttn_application_id IS NOT NULL;

-- Add comment explaining the per-org TTN architecture
COMMENT ON TABLE ttn_connections IS 'Per-organization TTN connection settings. Each org has its own TTN application, API key, and webhook secret for complete tenant isolation.';
COMMENT ON COLUMN ttn_connections.ttn_application_id IS 'Unique TTN application ID for this org (e.g., freshtracker-acme-corp)';
COMMENT ON COLUMN ttn_connections.provisioning_status IS 'Status of TTN application provisioning: not_started, provisioning, completed, failed';
COMMENT ON COLUMN ttn_connections.ttn_webhook_secret_encrypted IS 'Per-org webhook secret - used to authenticate inbound webhooks from TTN';