-- Add TTN tracking fields to gateways table
ALTER TABLE gateways
ADD COLUMN IF NOT EXISTS ttn_gateway_id text,
ADD COLUMN IF NOT EXISTS ttn_registered_at timestamptz,
ADD COLUMN IF NOT EXISTS ttn_last_error text;

-- Add index for TTN gateway lookup
CREATE INDEX IF NOT EXISTS idx_gateways_ttn_gateway_id ON gateways(ttn_gateway_id) WHERE ttn_gateway_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN gateways.ttn_gateway_id IS 'TTN gateway ID (format: eui-<gateway_eui>)';
COMMENT ON COLUMN gateways.ttn_registered_at IS 'Timestamp when gateway was registered in TTN';
COMMENT ON COLUMN gateways.ttn_last_error IS 'Last error message from TTN provisioning attempt';