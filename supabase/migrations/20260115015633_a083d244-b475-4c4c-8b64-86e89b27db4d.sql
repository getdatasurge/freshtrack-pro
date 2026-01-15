-- Add soft delete fields to lora_sensors (matching sites/areas/units/devices pattern)
ALTER TABLE public.lora_sensors 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL;

-- Add index for efficient filtering of active sensors
CREATE INDEX IF NOT EXISTS idx_lora_sensors_active 
  ON public.lora_sensors(organization_id) 
  WHERE deleted_at IS NULL;

-- Create function to enqueue TTN deprovision when sensor is soft-deleted
CREATE OR REPLACE FUNCTION enqueue_ttn_deprovision_on_sensor_archive()
RETURNS trigger AS $$
BEGIN
  -- Only fire when deleted_at changes from NULL to a value (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL 
     AND NEW.ttn_device_id IS NOT NULL THEN
    INSERT INTO ttn_deprovision_jobs (
      organization_id, sensor_id, dev_eui, ttn_device_id,
      ttn_application_id, reason, sensor_name
    ) VALUES (
      NEW.organization_id, NEW.id, NEW.dev_eui, NEW.ttn_device_id,
      NEW.ttn_application_id, 'SENSOR_ARCHIVED', NEW.name
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for archiving sensors (soft delete)
DROP TRIGGER IF EXISTS trg_enqueue_deprovision_on_archive ON public.lora_sensors;
CREATE TRIGGER trg_enqueue_deprovision_on_archive
  AFTER UPDATE ON public.lora_sensors
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_ttn_deprovision_on_sensor_archive();