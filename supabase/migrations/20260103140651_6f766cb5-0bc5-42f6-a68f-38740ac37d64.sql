-- Add diagnostic columns to ttn_provisioning_logs for better debugging
ALTER TABLE public.ttn_provisioning_logs 
ADD COLUMN IF NOT EXISTS ttn_http_status INTEGER,
ADD COLUMN IF NOT EXISTS ttn_response_body TEXT,
ADD COLUMN IF NOT EXISTS error_category TEXT,
ADD COLUMN IF NOT EXISTS ttn_endpoint TEXT;

-- Add index for faster org lookups
CREATE INDEX IF NOT EXISTS idx_ttn_provisioning_logs_org_created 
ON public.ttn_provisioning_logs(organization_id, created_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN public.ttn_provisioning_logs.error_category IS 
'Error classification: credential_missing, credential_invalid, permission_denied, network_error, timeout, ttn_error, internal';