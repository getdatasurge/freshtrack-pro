ALTER TABLE public.gateways
ADD COLUMN IF NOT EXISTS provisioning_state text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_provision_check_at timestamptz,
ADD COLUMN IF NOT EXISTS last_provision_check_error text;