-- Add separate gateway API key columns to ttn_connections
-- Gateway provisioning requires a Personal or Organization API key with gateway rights
-- Application API keys cannot provision gateways (TTN v3 API constraint)

ALTER TABLE ttn_connections
ADD COLUMN IF NOT EXISTS ttn_gateway_api_key_encrypted text,
ADD COLUMN IF NOT EXISTS ttn_gateway_api_key_last4 text,
ADD COLUMN IF NOT EXISTS ttn_gateway_api_key_type text
  CHECK (ttn_gateway_api_key_type IN ('personal', 'organization')),
ADD COLUMN IF NOT EXISTS ttn_gateway_api_key_scope_id text,
ADD COLUMN IF NOT EXISTS ttn_gateway_api_key_updated_at timestamptz;

-- Add documentation comments
COMMENT ON COLUMN ttn_connections.ttn_gateway_api_key_encrypted IS 'Encrypted Personal or Organization API key for gateway provisioning (NOT application key)';
COMMENT ON COLUMN ttn_connections.ttn_gateway_api_key_last4 IS 'Last 4 characters of gateway API key for identification';
COMMENT ON COLUMN ttn_connections.ttn_gateway_api_key_type IS 'Type of gateway API key: personal or organization';
COMMENT ON COLUMN ttn_connections.ttn_gateway_api_key_scope_id IS 'TTN user_id or organization_id that owns this key';
