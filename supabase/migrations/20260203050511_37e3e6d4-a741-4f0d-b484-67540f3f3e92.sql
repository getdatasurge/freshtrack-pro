-- Migration: Add sensor_catalog_id FK to lora_sensors
-- This links each sensor to its catalog entry containing the decoder_js

-- Add the sensor_catalog_id column with FK constraint
ALTER TABLE public.lora_sensors
  ADD COLUMN IF NOT EXISTS sensor_catalog_id uuid NULL
    REFERENCES public.sensor_catalog(id) ON DELETE SET NULL;

-- Create index for join performance
CREATE INDEX IF NOT EXISTS idx_lora_sensors_sensor_catalog_id 
  ON public.lora_sensors(sensor_catalog_id);

-- Add decode_mode_override for per-sensor decode control
ALTER TABLE public.lora_sensors
  ADD COLUMN IF NOT EXISTS decode_mode_override TEXT
    CHECK (decode_mode_override IN ('ttn', 'trust', 'app', 'off'));

-- Backfill sensor_catalog_id for existing sensors by matching manufacturer/model
UPDATE public.lora_sensors ls
SET sensor_catalog_id = sc.id
FROM public.sensor_catalog sc
WHERE LOWER(TRIM(ls.model)) = LOWER(TRIM(sc.model))
  AND ls.sensor_catalog_id IS NULL;

-- Also try matching on manufacturer + model combination
UPDATE public.lora_sensors ls
SET sensor_catalog_id = sc.id
FROM public.sensor_catalog sc
WHERE LOWER(TRIM(ls.manufacturer)) = LOWER(TRIM(sc.manufacturer))
  AND LOWER(TRIM(ls.model)) = LOWER(TRIM(sc.model))
  AND ls.sensor_catalog_id IS NULL;

-- Create trigger function to auto-sync catalog reference on model change
CREATE OR REPLACE FUNCTION public.sync_lora_sensor_catalog_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When model or manufacturer changes, try to auto-link to catalog
  IF (TG_OP = 'INSERT') OR 
     (TG_OP = 'UPDATE' AND (OLD.model IS DISTINCT FROM NEW.model OR OLD.manufacturer IS DISTINCT FROM NEW.manufacturer)) THEN
    
    -- Try to find matching catalog entry
    SELECT id INTO NEW.sensor_catalog_id
    FROM public.sensor_catalog sc
    WHERE LOWER(TRIM(sc.model)) = LOWER(TRIM(NEW.model))
      AND (NEW.manufacturer IS NULL OR LOWER(TRIM(sc.manufacturer)) = LOWER(TRIM(NEW.manufacturer)))
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_lora_sensor_catalog_id ON public.lora_sensors;
CREATE TRIGGER trg_sync_lora_sensor_catalog_id
  BEFORE INSERT OR UPDATE ON public.lora_sensors
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lora_sensor_catalog_id();