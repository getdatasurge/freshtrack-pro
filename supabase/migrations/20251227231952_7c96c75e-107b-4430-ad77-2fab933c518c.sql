-- Add site-level compliance settings
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS compliance_mode text DEFAULT 'fda_food_code' CHECK (compliance_mode IN ('fda_food_code', 'custom')),
ADD COLUMN IF NOT EXISTS manual_log_cadence_seconds integer DEFAULT 14400,
ADD COLUMN IF NOT EXISTS corrective_action_required boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.sites.compliance_mode IS 'FDA Food Code (default) or Custom compliance mode';
COMMENT ON COLUMN public.sites.manual_log_cadence_seconds IS 'Required manual logging interval in seconds (default 4 hours)';
COMMENT ON COLUMN public.sites.corrective_action_required IS 'Whether corrective actions are required for out-of-range readings';