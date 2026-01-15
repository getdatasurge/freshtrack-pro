-- Ensure the trigger function exists with proper error handling
CREATE OR REPLACE FUNCTION public.enqueue_ttn_deprovision_on_sensor_archive()
RETURNS trigger AS $$
BEGIN
  -- Only fire when deleted_at changes from NULL to a value (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Only enqueue if we have enough info to deprovision
    IF NEW.ttn_device_id IS NOT NULL OR NEW.dev_eui IS NOT NULL THEN
      INSERT INTO public.ttn_deprovision_jobs (
        organization_id, 
        sensor_id, 
        dev_eui, 
        ttn_device_id,
        ttn_application_id, 
        reason, 
        sensor_name,
        unit_id,
        created_by
      ) VALUES (
        NEW.organization_id, 
        NEW.id, 
        NEW.dev_eui, 
        COALESCE(NEW.ttn_device_id, 'sensor-' || LOWER(NEW.dev_eui)),
        NEW.ttn_application_id, 
        'SENSOR_DELETED',
        NEW.name,
        NEW.unit_id,
        NEW.deleted_by
      );
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't abort the archive transaction
    RAISE WARNING 'Failed to enqueue TTN deprovision job for sensor %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate trigger to ensure it exists
DROP TRIGGER IF EXISTS trg_enqueue_deprovision_on_archive ON public.lora_sensors;

CREATE TRIGGER trg_enqueue_deprovision_on_archive
  AFTER UPDATE ON public.lora_sensors
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_ttn_deprovision_on_sensor_archive();