-- Drop the existing constraint that blocks all duplicates
ALTER TABLE lora_sensors DROP CONSTRAINT IF EXISTS lora_sensors_dev_eui_unique;

-- Drop any existing index with same name
DROP INDEX IF EXISTS lora_sensors_dev_eui_unique;

-- Create partial unique index that only enforces uniqueness for non-deleted sensors
CREATE UNIQUE INDEX lora_sensors_dev_eui_unique 
ON lora_sensors (dev_eui) 
WHERE deleted_at IS NULL;