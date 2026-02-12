-- Add provisioning_state tracking to gateways (mirrors lora_sensors pattern)
-- Enables auto-verify and claim-existing workflows for gateway TTN registration.

-- Create the reusable provisioning state type if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ttn_provisioning_state') THEN
    CREATE TYPE public.ttn_provisioning_state AS ENUM (
      'not_configured',
      'unknown',
      'exists_in_ttn',
      'missing_in_ttn',
      'conflict',
      'error'
    );
  ELSE
    -- Ensure 'conflict' value exists (may be new)
    BEGIN
      ALTER TYPE public.ttn_provisioning_state ADD VALUE IF NOT EXISTS 'conflict';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

ALTER TABLE public.gateways
ADD COLUMN IF NOT EXISTS provisioning_state text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_provision_check_at timestamptz,
ADD COLUMN IF NOT EXISTS last_provision_check_error text;

-- Backfill: gateways that already have ttn_gateway_id are clearly provisioned
UPDATE public.gateways
SET provisioning_state = 'exists_in_ttn'
WHERE ttn_gateway_id IS NOT NULL AND provisioning_state = 'unknown';

COMMENT ON COLUMN public.gateways.provisioning_state IS 'TTN provisioning state: unknown, exists_in_ttn, missing_in_ttn, conflict, error';
COMMENT ON COLUMN public.gateways.last_provision_check_at IS 'Last time we checked TTN for this gateway';
COMMENT ON COLUMN public.gateways.last_provision_check_error IS 'Error from last provisioning check, if any';
