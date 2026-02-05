-- Add units_preference column to organizations table
-- Allows organizations to choose between imperial (°F) and metric (°C) display

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS units_preference TEXT NOT NULL DEFAULT 'imperial';

-- Add check constraint to enforce valid values
ALTER TABLE public.organizations
ADD CONSTRAINT chk_units_preference
CHECK (units_preference IN ('imperial', 'metric'));

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.units_preference IS
'Temperature display preference: imperial (°F) or metric (°C). Data is stored in Fahrenheit (canonical), this setting affects display only.';
