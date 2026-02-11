-- Add 'degraded' to gateway_status enum and signal_quality column
-- for gateway health monitoring on the Sites view

-- Add 'degraded' value to the existing gateway_status enum
ALTER TYPE public.gateway_status ADD VALUE IF NOT EXISTS 'degraded' AFTER 'online';

-- Add signal_quality jsonb column to gateways
ALTER TABLE public.gateways
ADD COLUMN IF NOT EXISTS signal_quality jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.gateways.signal_quality IS 'Signal quality metrics from TTN (rssi, snr, etc.)';
