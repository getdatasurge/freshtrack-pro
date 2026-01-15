-- Fix the archive trigger to use a valid reason value
-- The check constraint allows: 'SENSOR_DELETED', 'USER_DELETED', 'ORG_DELETED', 'SITE_DELETED', 'UNIT_DELETED', 'MANUAL_CLEANUP'

CREATE OR REPLACE FUNCTION enqueue_ttn_deprovision_on_sensor_archive()
RETURNS trigger AS $$
BEGIN
  -- Only fire when deleted_at changes from NULL to a value (soft delete)
  -- and the sensor has TTN provisioning info
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL 
     AND NEW.ttn_device_id IS NOT NULL 
     AND NEW.ttn_application_id IS NOT NULL THEN
    INSERT INTO ttn_deprovision_jobs (
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
      NEW.ttn_device_id,
      NEW.ttn_application_id, 
      'SENSOR_DELETED',
      NEW.name,
      NEW.unit_id,
      NEW.deleted_by
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't abort the archive transaction
    RAISE WARNING 'Failed to enqueue TTN deprovision job for sensor %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;