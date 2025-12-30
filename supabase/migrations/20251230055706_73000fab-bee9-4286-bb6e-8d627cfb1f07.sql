-- Phase 1: Hard Tenant Isolation Fixes

-- A. Fix lora_sensors DevEUI uniqueness: make it per-org instead of global
-- First check if the global constraint exists and drop it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'lora_sensors_dev_eui_key' 
    AND conrelid = 'public.lora_sensors'::regclass
  ) THEN
    ALTER TABLE public.lora_sensors DROP CONSTRAINT lora_sensors_dev_eui_key;
  END IF;
END $$;

-- Add org-scoped unique constraint (allows same DevEUI in different orgs)
ALTER TABLE public.lora_sensors 
  ADD CONSTRAINT lora_sensors_org_dev_eui_unique UNIQUE (organization_id, dev_eui);

-- B. Add RLS policy for door_events INSERT (for service role writes)
CREATE POLICY "System can insert door events" ON public.door_events
FOR INSERT
WITH CHECK (true);

-- C. Add index for faster org-scoped queries on sensor_readings
CREATE INDEX IF NOT EXISTS idx_sensor_readings_unit_recorded 
  ON public.sensor_readings (unit_id, recorded_at DESC);

-- D. Add index for faster alert queries by org
CREATE INDEX IF NOT EXISTS idx_alerts_org_status 
  ON public.alerts (organization_id, status, triggered_at DESC);