-- Unit Dashboard Layouts Table
CREATE TABLE public.unit_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_user_default BOOLEAN DEFAULT FALSE,
  visibility TEXT DEFAULT 'private',
  shared_with_roles app_role[] DEFAULT '{}',
  layout_json JSONB NOT NULL DEFAULT '{}',
  widget_prefs_json JSONB DEFAULT '{}',
  timeline_state_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unit_dashboard_layouts_name_length CHECK (char_length(name) <= 50),
  CONSTRAINT unit_dashboard_layouts_visibility_check CHECK (visibility IN ('private', 'org', 'public')),
  CONSTRAINT unit_dashboard_layouts_unique_name UNIQUE (unit_id, user_id, name)
);

CREATE INDEX idx_unit_dashboard_layouts_user_unit ON public.unit_dashboard_layouts(user_id, unit_id);

-- Enforce max 3 layouts per user per unit
CREATE OR REPLACE FUNCTION public.enforce_max_unit_layouts()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.unit_dashboard_layouts WHERE user_id = NEW.user_id AND unit_id = NEW.unit_id) >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 custom layouts per user per unit allowed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_max_unit_layouts BEFORE INSERT ON public.unit_dashboard_layouts
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_unit_layouts();

-- Auto-update updated_at
CREATE TRIGGER update_unit_dashboard_layouts_updated_at BEFORE UPDATE ON public.unit_dashboard_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default per user+unit
CREATE OR REPLACE FUNCTION public.enforce_single_default_layout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_user_default = TRUE THEN
    UPDATE public.unit_dashboard_layouts SET is_user_default = FALSE
    WHERE user_id = NEW.user_id AND unit_id = NEW.unit_id AND id != NEW.id AND is_user_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_single_default_unit_layout BEFORE INSERT OR UPDATE ON public.unit_dashboard_layouts
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_layout();

-- RLS
ALTER TABLE public.unit_dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own layouts" ON public.unit_dashboard_layouts FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own layouts" ON public.unit_dashboard_layouts FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.organization_id = unit_dashboard_layouts.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "Users can update own layouts" ON public.unit_dashboard_layouts FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own layouts" ON public.unit_dashboard_layouts FOR DELETE TO authenticated
USING (user_id = auth.uid());