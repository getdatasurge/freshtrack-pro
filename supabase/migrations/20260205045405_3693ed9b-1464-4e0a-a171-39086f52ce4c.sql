-- Add units_preference column to organizations table
-- This stores the temperature display preference: 'imperial' (°F) or 'metric' (°C)
-- Canonical storage remains Fahrenheit; conversion happens at display/input boundaries only

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS units_preference TEXT NOT NULL DEFAULT 'imperial';

-- Add check constraint to enforce valid values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'organizations' AND constraint_name = 'chk_units_preference'
  ) THEN
    ALTER TABLE public.organizations
    ADD CONSTRAINT chk_units_preference
    CHECK (units_preference IN ('imperial', 'metric'));
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.units_preference IS 'Temperature display units: imperial (°F) or metric (°C). Stored temps remain in Fahrenheit.';