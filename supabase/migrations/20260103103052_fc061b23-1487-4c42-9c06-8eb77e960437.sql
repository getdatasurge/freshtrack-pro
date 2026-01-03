-- Add organization-level API key columns to ttn_connections
ALTER TABLE ttn_connections 
ADD COLUMN IF NOT EXISTS ttn_org_api_key_encrypted text,
ADD COLUMN IF NOT EXISTS ttn_org_api_key_last4 text,
ADD COLUMN IF NOT EXISTS ttn_org_api_key_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS credentials_last_rotated_at timestamptz,
ADD COLUMN IF NOT EXISTS credentials_rotation_count integer DEFAULT 0;