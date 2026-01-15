-- Create sensor_dashboard_layouts table for sensor-scoped layouts
CREATE TABLE public.sensor_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sensor_id UUID NOT NULL REFERENCES public.lora_sensors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  is_user_default BOOLEAN DEFAULT false,
  layout_json JSONB NOT NULL DEFAULT '{}',
  widget_prefs_json JSONB DEFAULT '{}',
  timeline_state_json JSONB DEFAULT '{}',
  layout_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_sensor_layout_name UNIQUE (sensor_id, user_id, name)
);

-- Indexes for efficient queries
CREATE INDEX idx_sensor_dashboard_layouts_user_sensor 
  ON public.sensor_dashboard_layouts(user_id, sensor_id);
CREATE INDEX idx_sensor_dashboard_layouts_org 
  ON public.sensor_dashboard_layouts(organization_id);
CREATE INDEX idx_sensor_dashboard_layouts_sensor 
  ON public.sensor_dashboard_layouts(sensor_id);

-- Enable RLS
ALTER TABLE public.sensor_dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own layouts
CREATE POLICY "Users can view their own sensor layouts"
  ON public.sensor_dashboard_layouts
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own layouts
CREATE POLICY "Users can create their own sensor layouts"
  ON public.sensor_dashboard_layouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own layouts
CREATE POLICY "Users can update their own sensor layouts"
  ON public.sensor_dashboard_layouts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own layouts
CREATE POLICY "Users can delete their own sensor layouts"
  ON public.sensor_dashboard_layouts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_sensor_dashboard_layouts_updated_at
  BEFORE UPDATE ON public.sensor_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to enforce max 3 custom layouts per user per sensor
CREATE OR REPLACE FUNCTION public.check_sensor_layout_limit()
RETURNS TRIGGER AS $$
DECLARE
  layout_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO layout_count
  FROM public.sensor_dashboard_layouts
  WHERE user_id = NEW.user_id AND sensor_id = NEW.sensor_id;
  
  IF layout_count >= 3 THEN
    RAISE EXCEPTION 'Maximum of 3 custom layouts per sensor reached';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to enforce limit on insert
CREATE TRIGGER enforce_sensor_layout_limit
  BEFORE INSERT ON public.sensor_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_sensor_layout_limit();

-- Function to ensure only one default layout per user per sensor
CREATE OR REPLACE FUNCTION public.ensure_single_sensor_default_layout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_user_default = true THEN
    UPDATE public.sensor_dashboard_layouts
    SET is_user_default = false
    WHERE user_id = NEW.user_id 
      AND sensor_id = NEW.sensor_id 
      AND id != NEW.id 
      AND is_user_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for single default enforcement
CREATE TRIGGER ensure_single_sensor_default
  BEFORE INSERT OR UPDATE ON public.sensor_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_sensor_default_layout();