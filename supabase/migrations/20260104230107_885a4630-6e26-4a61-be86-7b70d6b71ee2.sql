-- Add TTN diagnostics columns to ttn_connections table
ALTER TABLE public.ttn_connections 
ADD COLUMN IF NOT EXISTS ttn_application_uid text,
ADD COLUMN IF NOT EXISTS app_rights_check_status text,
ADD COLUMN IF NOT EXISTS last_ttn_http_status integer,
ADD COLUMN IF NOT EXISTS last_ttn_error_namespace text,
ADD COLUMN IF NOT EXISTS last_ttn_error_name text,
ADD COLUMN IF NOT EXISTS last_ttn_correlation_id text;

-- Add comment for documentation
COMMENT ON COLUMN public.ttn_connections.app_rights_check_status IS 'Result of TTN app rights check: ok, forbidden, not_found';
COMMENT ON COLUMN public.ttn_connections.last_ttn_correlation_id IS 'TTN correlation ID from last API call for debugging';