-- Add category, severity, title, area_id columns to event_logs table
ALTER TABLE public.event_logs 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system',
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id);

-- Create index for fast pagination by org and recorded_at
CREATE INDEX IF NOT EXISTS idx_event_logs_org_recorded ON public.event_logs(organization_id, recorded_at DESC);

-- Create index for filtering by category
CREATE INDEX IF NOT EXISTS idx_event_logs_category ON public.event_logs(category);

-- Create index for filtering by unit_id
CREATE INDEX IF NOT EXISTS idx_event_logs_unit ON public.event_logs(unit_id);

-- Create index for filtering by site_id
CREATE INDEX IF NOT EXISTS idx_event_logs_site ON public.event_logs(site_id);

-- Update RLS policy to allow staff to insert event logs
CREATE POLICY "Staff can insert event logs" 
ON public.event_logs 
FOR INSERT 
TO authenticated
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id) AND
  (actor_id IS NULL OR actor_id = auth.uid())
);