-- Add door sensor columns to units table
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS door_state TEXT DEFAULT 'unknown' CHECK (door_state IN ('open', 'closed', 'unknown')),
ADD COLUMN IF NOT EXISTS door_last_changed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS door_sensor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS door_open_grace_minutes INTEGER DEFAULT 20;

-- Add battery columns to devices table
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS battery_voltage NUMERIC,
ADD COLUMN IF NOT EXISTS battery_last_reported_at TIMESTAMP WITH TIME ZONE;

-- Create door_events table for door state history
CREATE TABLE IF NOT EXISTS public.door_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'sensor',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_door_events_unit_id ON public.door_events(unit_id);
CREATE INDEX IF NOT EXISTS idx_door_events_occurred_at ON public.door_events(occurred_at DESC);

-- Enable RLS on door_events
ALTER TABLE public.door_events ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view door events for units in their org
CREATE POLICY "Users can view door events" ON public.door_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM units u
    JOIN areas a ON a.id = u.area_id
    JOIN sites s ON s.id = a.site_id
    WHERE u.id = door_events.unit_id
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  )
);

-- Add suspected_cooling_failure to alert_type enum
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'suspected_cooling_failure';