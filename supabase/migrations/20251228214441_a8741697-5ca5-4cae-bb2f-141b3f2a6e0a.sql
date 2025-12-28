-- Add organization_id, site_id, area_id, and source columns to alerts table
-- This enables direct filtering without joins for better RLS and query performance

-- Add new columns
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'sensor' CHECK (source IN ('sensor', 'manual', 'simulator', 'system'));
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS triggered_by_device_id UUID REFERENCES public.devices(id);

-- Backfill existing alerts with hierarchy data from units
UPDATE public.alerts
SET 
  organization_id = (
    SELECT s.organization_id 
    FROM units u 
    JOIN areas a ON a.id = u.area_id 
    JOIN sites s ON s.id = a.site_id 
    WHERE u.id = alerts.unit_id
  ),
  site_id = (
    SELECT a.site_id 
    FROM units u 
    JOIN areas a ON a.id = u.area_id 
    WHERE u.id = alerts.unit_id
  ),
  area_id = (
    SELECT u.area_id 
    FROM units u 
    WHERE u.id = alerts.unit_id
  )
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL after backfill (only for rows that have unit_id)
-- First, delete any orphaned alerts that couldn't be backfilled
DELETE FROM public.alerts WHERE organization_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.alerts ALTER COLUMN organization_id SET NOT NULL;

-- Create indexes for faster org-scoped queries
CREATE INDEX IF NOT EXISTS idx_alerts_organization_id ON public.alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org_status ON public.alerts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_org_created ON public.alerts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_source ON public.alerts(source);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Staff can update alerts" ON public.alerts;

-- Create new simplified RLS policies using direct organization_id
CREATE POLICY "Users can view alerts in their org"
ON public.alerts FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Staff can update alerts in their org"
ON public.alerts FOR UPDATE
USING (user_belongs_to_org(auth.uid(), organization_id));

-- Allow system inserts for alerts (edge functions use service role)
CREATE POLICY "System can insert alerts"
ON public.alerts FOR INSERT
WITH CHECK (true);