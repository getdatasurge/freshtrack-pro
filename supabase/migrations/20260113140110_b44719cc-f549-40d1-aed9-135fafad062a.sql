-- Create unified entity_dashboard_layouts table for both units and sites
CREATE TABLE public.entity_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('unit', 'site')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  is_user_default BOOLEAN DEFAULT false,
  layout_json JSONB NOT NULL DEFAULT '{}',
  widget_prefs_json JSONB DEFAULT '{}',
  timeline_state_json JSONB DEFAULT '{}',
  layout_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_entity_layout_slot UNIQUE (entity_type, entity_id, user_id, slot_number)
);

-- Indexes for efficient queries
CREATE INDEX idx_entity_layouts_user_entity ON entity_dashboard_layouts(user_id, entity_type, entity_id);
CREATE INDEX idx_entity_layouts_org ON entity_dashboard_layouts(organization_id);
CREATE INDEX idx_entity_layouts_entity ON entity_dashboard_layouts(entity_type, entity_id);

-- Enable RLS
ALTER TABLE entity_dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own entity layouts"
  ON entity_dashboard_layouts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own entity layouts"
  ON entity_dashboard_layouts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entity layouts"
  ON entity_dashboard_layouts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entity layouts"
  ON entity_dashboard_layouts FOR DELETE 
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_entity_layouts_updated_at
  BEFORE UPDATE ON entity_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one default layout per entity per user
CREATE OR REPLACE FUNCTION ensure_single_entity_default_layout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_user_default = true THEN
    UPDATE entity_dashboard_layouts
    SET is_user_default = false
    WHERE user_id = NEW.user_id 
      AND entity_type = NEW.entity_type
      AND entity_id = NEW.entity_id 
      AND id != NEW.id 
      AND is_user_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_entity_default
  BEFORE INSERT OR UPDATE ON entity_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION ensure_single_entity_default_layout();

-- Limit to 3 layouts per entity per user
CREATE OR REPLACE FUNCTION check_entity_layout_limit()
RETURNS TRIGGER AS $$
DECLARE
  layout_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO layout_count
  FROM entity_dashboard_layouts
  WHERE user_id = NEW.user_id
    AND entity_type = NEW.entity_type
    AND entity_id = NEW.entity_id;
  
  IF layout_count >= 3 THEN
    RAISE EXCEPTION 'Maximum of 3 custom layouts per entity per user allowed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_entity_layout_limit_trigger
  BEFORE INSERT ON entity_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION check_entity_layout_limit();

-- Migrate existing sensor layouts to unit layouts (most recent per unit wins)
-- Using a CTE to get the most recent layout per unit per user per slot
WITH ranked_layouts AS (
  SELECT 
    sdl.organization_id,
    s.unit_id as entity_id,
    sdl.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY s.unit_id, sdl.user_id 
      ORDER BY sdl.updated_at DESC
    ) as slot_rank,
    sdl.name,
    sdl.is_user_default,
    sdl.layout_json,
    sdl.widget_prefs_json,
    sdl.timeline_state_json
  FROM sensor_dashboard_layouts sdl
  JOIN lora_sensors s ON s.id = sdl.sensor_id
  WHERE s.unit_id IS NOT NULL
)
INSERT INTO entity_dashboard_layouts 
  (organization_id, entity_type, entity_id, user_id, slot_number, name, is_user_default, layout_json, widget_prefs_json, timeline_state_json)
SELECT 
  organization_id,
  'unit',
  entity_id,
  user_id,
  slot_rank::INTEGER as slot_number,
  name,
  CASE WHEN slot_rank = 1 THEN is_user_default ELSE false END,
  layout_json,
  widget_prefs_json,
  timeline_state_json
FROM ranked_layouts
WHERE slot_rank <= 3;

-- Archive the old table
ALTER TABLE sensor_dashboard_layouts RENAME TO sensor_dashboard_layouts_archived;