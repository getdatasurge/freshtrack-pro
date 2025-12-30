-- Add TTN application fields to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS ttn_application_id TEXT,
ADD COLUMN IF NOT EXISTS ttn_application_created BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ttn_webhook_configured BOOLEAN DEFAULT false;

-- Create index for TTN application lookup
CREATE INDEX IF NOT EXISTS idx_organizations_ttn_app 
ON public.organizations(ttn_application_id) 
WHERE ttn_application_id IS NOT NULL;