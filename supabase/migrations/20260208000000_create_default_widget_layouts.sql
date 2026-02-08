-- default_widget_layouts: Admin-designed default layouts per equipment type
-- These layouts flow to the customer app's FixedWidgetLayout component.
-- When a customer views a unit, the system checks this table first,
-- falling back to hardcoded CUSTOMER_LAYOUTS if no row exists.

CREATE TABLE IF NOT EXISTS default_widget_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_type TEXT NOT NULL,
  app_target TEXT NOT NULL DEFAULT 'customer' CHECK (app_target IN ('customer', 'admin')),
  name TEXT NOT NULL,
  placements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipment_type, app_target)
);

-- Enable RLS
ALTER TABLE default_widget_layouts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read default layouts
CREATE POLICY "default_widget_layouts_select"
  ON default_widget_layouts
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins (org_role = 'admin') can insert/update/delete
-- Assumes an org_members table or similar for role checking.
-- Adjust the policy condition to match your auth setup.
CREATE POLICY "default_widget_layouts_admin_insert"
  ON default_widget_layouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
        AND org_members.org_role IN ('admin', 'owner')
    )
  );

CREATE POLICY "default_widget_layouts_admin_update"
  ON default_widget_layouts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
        AND org_members.org_role IN ('admin', 'owner')
    )
  );

CREATE POLICY "default_widget_layouts_admin_delete"
  ON default_widget_layouts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
        AND org_members.org_role IN ('admin', 'owner')
    )
  );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_default_widget_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER default_widget_layouts_updated_at
  BEFORE UPDATE ON default_widget_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_default_widget_layouts_updated_at();
