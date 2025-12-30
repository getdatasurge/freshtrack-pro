-- Phase 1: TTN Provisioning Data Model & Ownership Foundations

-- Create gateway status enum
CREATE TYPE public.gateway_status AS ENUM (
  'pending',
  'online',
  'offline',
  'maintenance'
);

-- Create gateways table
CREATE TABLE public.gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  gateway_eui TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status gateway_status NOT NULL DEFAULT 'pending',
  last_seen_at TIMESTAMPTZ,
  ttn_application_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gateways_org_eui_unique UNIQUE (organization_id, gateway_eui)
);

-- Enable RLS on gateways
ALTER TABLE public.gateways ENABLE ROW LEVEL SECURITY;

-- Indexes for gateways
CREATE INDEX idx_gateways_org_id ON public.gateways(organization_id);
CREATE INDEX idx_gateways_site_id ON public.gateways(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX idx_gateways_eui ON public.gateways(gateway_eui);
CREATE INDEX idx_gateways_status ON public.gateways(status);

-- RLS Policies for gateways
CREATE POLICY "Users can view gateways in their org"
  ON public.gateways FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can manage gateways"
  ON public.gateways FOR ALL
  USING (
    has_role(auth.uid(), organization_id, 'owner'::app_role) OR
    has_role(auth.uid(), organization_id, 'admin'::app_role)
  );

-- Updated_at trigger for gateways
CREATE TRIGGER update_gateways_updated_at
  BEFORE UPDATE ON public.gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create sensor type enum
CREATE TYPE public.lora_sensor_type AS ENUM (
  'temperature',
  'temperature_humidity',
  'door',
  'combo'
);

-- Create sensor status enum
CREATE TYPE public.lora_sensor_status AS ENUM (
  'pending',
  'joining',
  'active',
  'offline',
  'fault'
);

-- Create lora_sensors table
CREATE TABLE public.lora_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  dev_eui TEXT NOT NULL,
  app_eui TEXT,
  app_key TEXT,
  ttn_device_id TEXT,
  ttn_application_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  sensor_type lora_sensor_type NOT NULL DEFAULT 'temperature',
  manufacturer TEXT,
  model TEXT,
  firmware_version TEXT,
  status lora_sensor_status NOT NULL DEFAULT 'pending',
  battery_level INTEGER,
  signal_strength INTEGER,
  last_seen_at TIMESTAMPTZ,
  last_join_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lora_sensors_dev_eui_unique UNIQUE (dev_eui)
);

-- Enable RLS on lora_sensors
ALTER TABLE public.lora_sensors ENABLE ROW LEVEL SECURITY;

-- Indexes for lora_sensors
CREATE INDEX idx_lora_sensors_org_id ON public.lora_sensors(organization_id);
CREATE INDEX idx_lora_sensors_site_id ON public.lora_sensors(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX idx_lora_sensors_unit_id ON public.lora_sensors(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_lora_sensors_dev_eui ON public.lora_sensors(dev_eui);
CREATE INDEX idx_lora_sensors_status ON public.lora_sensors(status);

-- RLS Policies for lora_sensors
CREATE POLICY "Users can view lora_sensors in their org"
  ON public.lora_sensors FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can manage lora_sensors"
  ON public.lora_sensors FOR ALL
  USING (
    has_role(auth.uid(), organization_id, 'owner'::app_role) OR
    has_role(auth.uid(), organization_id, 'admin'::app_role)
  );

-- Updated_at trigger for lora_sensors
CREATE TRIGGER update_lora_sensors_updated_at
  BEFORE UPDATE ON public.lora_sensors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cross-org validation function for site_id
CREATE OR REPLACE FUNCTION public.validate_same_org_site()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.site_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sites
      WHERE id = NEW.site_id AND organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Site does not belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Cross-org validation function for unit_id
CREATE OR REPLACE FUNCTION public.validate_same_org_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.areas a ON a.id = u.area_id
      JOIN public.sites s ON s.id = a.site_id
      WHERE u.id = NEW.unit_id AND s.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Unit does not belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply validation triggers
CREATE TRIGGER validate_gateway_org_site
  BEFORE INSERT OR UPDATE ON public.gateways
  FOR EACH ROW EXECUTE FUNCTION validate_same_org_site();

CREATE TRIGGER validate_lora_sensor_org_site
  BEFORE INSERT OR UPDATE ON public.lora_sensors
  FOR EACH ROW EXECUTE FUNCTION validate_same_org_site();

CREATE TRIGGER validate_lora_sensor_org_unit
  BEFORE INSERT OR UPDATE ON public.lora_sensors
  FOR EACH ROW EXECUTE FUNCTION validate_same_org_unit();