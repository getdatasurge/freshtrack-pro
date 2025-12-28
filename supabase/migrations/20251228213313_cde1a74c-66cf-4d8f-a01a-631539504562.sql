-- Create simulated_devices table for tracking virtual sensor configurations
CREATE TABLE public.simulated_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT false,
  -- Simulated hardware state
  sensor_paired BOOLEAN DEFAULT false,
  sensor_online BOOLEAN DEFAULT false,
  door_sensor_present BOOLEAN DEFAULT false,
  -- Configurable values
  battery_level INTEGER DEFAULT 100 CHECK (battery_level BETWEEN 0 AND 100),
  signal_strength INTEGER DEFAULT -50 CHECK (signal_strength BETWEEN -120 AND 0),
  current_temperature NUMERIC DEFAULT 38.0,
  current_humidity NUMERIC DEFAULT 50.0,
  door_state TEXT DEFAULT 'closed' CHECK (door_state IN ('open', 'closed', 'unknown')),
  door_open_since TIMESTAMPTZ,
  -- Streaming config
  streaming_enabled BOOLEAN DEFAULT false,
  streaming_interval_seconds INTEGER DEFAULT 60 CHECK (streaming_interval_seconds >= 10),
  last_heartbeat_at TIMESTAMPTZ,
  next_reading_at TIMESTAMPTZ,
  -- Door cycle simulation
  door_cycle_enabled BOOLEAN DEFAULT false,
  door_cycle_open_seconds INTEGER DEFAULT 300,
  door_cycle_closed_seconds INTEGER DEFAULT 120,
  door_cycle_next_change_at TIMESTAMPTZ,
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(unit_id)
);

-- Create index for efficient lookups
CREATE INDEX idx_simulated_devices_unit_id ON public.simulated_devices(unit_id);
CREATE INDEX idx_simulated_devices_streaming ON public.simulated_devices(streaming_enabled, sensor_online) WHERE streaming_enabled = true;
CREATE INDEX idx_simulated_devices_org ON public.simulated_devices(organization_id);

-- Enable RLS
ALTER TABLE public.simulated_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can manage simulated devices
CREATE POLICY "Admins can manage simulated devices"
ON public.simulated_devices
FOR ALL
USING (
  has_role(auth.uid(), organization_id, 'owner'::app_role) OR 
  has_role(auth.uid(), organization_id, 'admin'::app_role)
);

-- Users in org can view simulated devices
CREATE POLICY "Users can view simulated devices"
ON public.simulated_devices
FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

-- Add updated_at trigger
CREATE TRIGGER update_simulated_devices_updated_at
BEFORE UPDATE ON public.simulated_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();