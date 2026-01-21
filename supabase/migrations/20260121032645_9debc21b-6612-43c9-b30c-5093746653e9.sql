-- Fix: Convert org-level unique constraint to partial index (soft-delete aware)

-- 1. Drop the existing constraint that blocks soft-deleted re-adds
ALTER TABLE lora_sensors DROP CONSTRAINT IF EXISTS lora_sensors_org_dev_eui_unique;

-- 2. Drop any existing index with the same name
DROP INDEX IF EXISTS lora_sensors_org_dev_eui_unique;

-- 3. Create partial unique index for (organization_id, dev_eui) - only for active sensors
CREATE UNIQUE INDEX lora_sensors_org_dev_eui_unique 
ON lora_sensors (organization_id, dev_eui) 
WHERE deleted_at IS NULL;

-- 4. Drop the global dev_eui index we added previously (uniqueness should be per-org)
DROP INDEX IF EXISTS lora_sensors_dev_eui_unique;