-- Add source tracking columns to ttn_connections table
ALTER TABLE public.ttn_connections 
ADD COLUMN IF NOT EXISTS ttn_last_updated_source text DEFAULT 'frostguard',
ADD COLUMN IF NOT EXISTS ttn_last_test_source text;

-- Add comment for documentation
COMMENT ON COLUMN public.ttn_connections.ttn_last_updated_source IS 'Source of last TTN settings update: frostguard or emulator';
COMMENT ON COLUMN public.ttn_connections.ttn_last_test_source IS 'Source of last TTN connection test: frostguard or emulator';