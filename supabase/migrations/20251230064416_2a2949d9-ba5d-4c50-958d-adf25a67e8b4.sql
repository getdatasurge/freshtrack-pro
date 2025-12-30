-- Add is_primary flag to lora_sensors
ALTER TABLE lora_sensors 
ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN lora_sensors.is_primary IS 
  'Primary sensor for compliance readings. Only one primary per unit per sensor function.';

-- Add lora_sensor_id to sensor_readings to track which sensor created each reading
ALTER TABLE sensor_readings 
ADD COLUMN lora_sensor_id uuid REFERENCES lora_sensors(id);

CREATE INDEX idx_sensor_readings_lora_sensor_id 
ON sensor_readings(lora_sensor_id);

-- Make temperature nullable to allow door-only sensors
ALTER TABLE sensor_readings 
ALTER COLUMN temperature DROP NOT NULL;

-- Create trigger to auto-set first temperature-capable sensor as primary when assigned to a unit
CREATE OR REPLACE FUNCTION set_default_primary_sensor()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if sensor is being assigned to a unit
  IF NEW.unit_id IS NOT NULL THEN
    -- For temperature-capable sensors
    IF NEW.sensor_type IN ('temperature', 'temperature_humidity', 'combo') THEN
      -- Check if there's already a primary temperature sensor for this unit
      IF NOT EXISTS (
        SELECT 1 FROM lora_sensors 
        WHERE unit_id = NEW.unit_id 
        AND is_primary = true 
        AND sensor_type IN ('temperature', 'temperature_humidity', 'combo')
        AND id != NEW.id
      ) THEN
        NEW.is_primary := true;
      END IF;
    END IF;
    
    -- For door-only sensors, set as primary if no other door sensor is primary
    IF NEW.sensor_type = 'door' THEN
      IF NOT EXISTS (
        SELECT 1 FROM lora_sensors 
        WHERE unit_id = NEW.unit_id 
        AND is_primary = true 
        AND sensor_type = 'door'
        AND id != NEW.id
      ) THEN
        NEW.is_primary := true;
      END IF;
    END IF;
  ELSE
    -- If being unassigned from unit, remove primary status
    NEW.is_primary := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_set_default_primary_sensor
BEFORE INSERT OR UPDATE OF unit_id ON lora_sensors
FOR EACH ROW EXECUTE FUNCTION set_default_primary_sensor();