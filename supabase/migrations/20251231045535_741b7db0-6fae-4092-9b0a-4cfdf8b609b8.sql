-- Simplify TTN settings model
-- 1. Normalize region values to lowercase
UPDATE public.ttn_connections
SET ttn_region = LOWER(ttn_region)
WHERE ttn_region IS NOT NULL AND ttn_region != LOWER(ttn_region);

-- 2. Add constraint for valid regions (nam1, eu1, au1)
-- Note: We don't drop the old URL columns yet for safety - they just won't be used

-- 3. Add comments to document the new model
COMMENT ON COLUMN public.ttn_connections.ttn_region IS 'TTN cluster region: nam1, eu1, or au1 (lowercase)';
COMMENT ON COLUMN public.ttn_connections.ttn_stack_base_url IS 'DEPRECATED - URLs are now derived from region';
COMMENT ON COLUMN public.ttn_connections.ttn_identity_server_url IS 'DEPRECATED - Identity server is always eu1';
COMMENT ON COLUMN public.ttn_connections.ttn_webhook_id IS 'DEPRECATED - Not used anymore';
COMMENT ON COLUMN public.ttn_connections.ttn_webhook_url IS 'DEPRECATED - Not used anymore';

-- Rename ttn_webhook_api_key_encrypted to ttn_webhook_secret_encrypted for clarity
ALTER TABLE public.ttn_connections 
  RENAME COLUMN ttn_webhook_api_key_encrypted TO ttn_webhook_secret_encrypted;

ALTER TABLE public.ttn_connections 
  RENAME COLUMN ttn_webhook_api_key_last4 TO ttn_webhook_secret_last4;