-- Create unit settings history table for audit trail
CREATE TABLE public.unit_settings_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changes JSONB NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unit_settings_history ENABLE ROW LEVEL SECURITY;

-- Users can view history for units in their org
CREATE POLICY "Users can view unit settings history"
ON public.unit_settings_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM units u
    JOIN areas a ON a.id = u.area_id
    JOIN sites s ON s.id = a.site_id
    WHERE u.id = unit_settings_history.unit_id
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  )
);

-- Staff can insert history (when updating units)
CREATE POLICY "Staff can insert unit settings history"
ON public.unit_settings_history
FOR INSERT
WITH CHECK (
  changed_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM units u
    JOIN areas a ON a.id = u.area_id
    JOIN sites s ON s.id = a.site_id
    WHERE u.id = unit_settings_history.unit_id
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  )
);

-- Create index for faster lookups
CREATE INDEX idx_unit_settings_history_unit_id ON public.unit_settings_history(unit_id);
CREATE INDEX idx_unit_settings_history_changed_at ON public.unit_settings_history(changed_at DESC);