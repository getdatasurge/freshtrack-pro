-- Add gateway provisioning context columns to ttn_connections
ALTER TABLE ttn_connections 
ADD COLUMN IF NOT EXISTS ttn_owner_scope text DEFAULT 'user' 
  CHECK (ttn_owner_scope IN ('user', 'organization')),
ADD COLUMN IF NOT EXISTS ttn_credential_type text 
  CHECK (ttn_credential_type IN ('personal_api_key', 'organization_api_key', 'application_api_key')),
ADD COLUMN IF NOT EXISTS ttn_gateway_rights_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ttn_gateway_rights_checked_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN ttn_connections.ttn_owner_scope IS 'Owner scope for gateway registration: user or organization';
COMMENT ON COLUMN ttn_connections.ttn_credential_type IS 'Type of TTN API key: personal, organization, or application';
COMMENT ON COLUMN ttn_connections.ttn_gateway_rights_verified IS 'Whether gateway:write permission has been verified';
COMMENT ON COLUMN ttn_connections.ttn_gateway_rights_checked_at IS 'Timestamp of last gateway rights check';