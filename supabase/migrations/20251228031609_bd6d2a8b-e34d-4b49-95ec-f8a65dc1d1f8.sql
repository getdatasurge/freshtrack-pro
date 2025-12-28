-- Create alert_rules_history table for audit logging
CREATE TABLE public.alert_rules_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_rules_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id),
  site_id UUID REFERENCES public.sites(id),
  unit_id UUID REFERENCES public.units(id),
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'CLEAR_FIELD'
  changes JSONB NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_rules_history ENABLE ROW LEVEL SECURITY;

-- Users can view history for their org
CREATE POLICY "Users can view alert rules history in their org"
ON public.alert_rules_history
FOR SELECT
USING (
  (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id))
  OR (site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sites s WHERE s.id = alert_rules_history.site_id 
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  ))
  OR (unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM units u 
    JOIN areas a ON a.id = u.area_id 
    JOIN sites s ON s.id = a.site_id 
    WHERE u.id = alert_rules_history.unit_id 
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  ))
);

-- Staff can insert history records
CREATE POLICY "Staff can insert alert rules history"
ON public.alert_rules_history
FOR INSERT
WITH CHECK (
  changed_by = auth.uid() AND (
    (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id))
    OR (site_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sites s WHERE s.id = alert_rules_history.site_id 
      AND user_belongs_to_org(auth.uid(), s.organization_id)
    ))
    OR (unit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM units u 
      JOIN areas a ON a.id = u.area_id 
      JOIN sites s ON s.id = a.site_id 
      WHERE u.id = alert_rules_history.unit_id 
      AND user_belongs_to_org(auth.uid(), s.organization_id)
    ))
  )
);

-- Create index for faster lookups
CREATE INDEX idx_alert_rules_history_org ON public.alert_rules_history(organization_id);
CREATE INDEX idx_alert_rules_history_site ON public.alert_rules_history(site_id);
CREATE INDEX idx_alert_rules_history_unit ON public.alert_rules_history(unit_id);
CREATE INDEX idx_alert_rules_history_changed_at ON public.alert_rules_history(changed_at DESC);