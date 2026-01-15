-- Add TTN provisioning detection columns to lora_sensors

-- Add ttn_cluster column (may already exist as ttn_application_id stores app, we need cluster)
ALTER TABLE public.lora_sensors 
ADD COLUMN IF NOT EXISTS ttn_cluster text NULL;

-- provisioning_state to track TTN device existence
ALTER TABLE public.lora_sensors 
ADD COLUMN IF NOT EXISTS provisioning_state text NOT NULL DEFAULT 'unknown';

-- When we last checked TTN
ALTER TABLE public.lora_sensors 
ADD COLUMN IF NOT EXISTS last_provision_check_at timestamptz NULL;

-- Error message from last check
ALTER TABLE public.lora_sensors 
ADD COLUMN IF NOT EXISTS last_provision_check_error text NULL;

-- Where the device was provisioned from
ALTER TABLE public.lora_sensors 
ADD COLUMN IF NOT EXISTS provisioned_source text NULL;

-- Add validation trigger for provisioning_state
CREATE OR REPLACE FUNCTION public.validate_provisioning_state()
RETURNS trigger AS $$
BEGIN
  IF NEW.provisioning_state NOT IN ('not_configured', 'unknown', 'exists_in_ttn', 'missing_in_ttn', 'error') THEN
    RAISE EXCEPTION 'Invalid provisioning_state: %. Must be one of: not_configured, unknown, exists_in_ttn, missing_in_ttn, error', NEW.provisioning_state;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_provisioning_state ON public.lora_sensors;
CREATE TRIGGER trg_validate_provisioning_state
  BEFORE INSERT OR UPDATE ON public.lora_sensors
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_provisioning_state();

-- Add index for filtering by provisioning state
CREATE INDEX IF NOT EXISTS idx_lora_sensors_provisioning_state 
ON public.lora_sensors(provisioning_state) 
WHERE deleted_at IS NULL;

-- Update existing sensors: if they have ttn_device_id, assume exists_in_ttn
UPDATE public.lora_sensors 
SET provisioning_state = 'exists_in_ttn',
    provisioned_source = CASE 
      WHEN provisioned_source IS NULL THEN 'unknown'
      ELSE provisioned_source 
    END
WHERE ttn_device_id IS NOT NULL 
  AND provisioning_state = 'unknown'
  AND deleted_at IS NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN public.lora_sensors.provisioning_state IS 'TTN device state: not_configured, unknown, exists_in_ttn, missing_in_ttn, error';
COMMENT ON COLUMN public.lora_sensors.provisioned_source IS 'Where device was provisioned: emulator, app, unknown, manual';
COMMENT ON COLUMN public.lora_sensors.ttn_cluster IS 'TTN cluster (e.g., eu1, nam1, au1)';