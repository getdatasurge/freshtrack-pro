-- Add missing column for Org API Key ID
ALTER TABLE public.ttn_connections 
ADD COLUMN IF NOT EXISTS ttn_org_api_key_id TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN public.ttn_connections.ttn_org_api_key_id IS 
  'TTN-assigned ID for the organization-scoped API key (e.g., "BSXXX...")';