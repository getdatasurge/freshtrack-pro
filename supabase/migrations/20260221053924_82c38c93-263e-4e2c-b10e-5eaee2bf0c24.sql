
-- Enable RLS on all alarm library tables
ALTER TABLE alarm_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarm_org_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarm_site_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarm_unit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarm_events ENABLE ROW LEVEL SECURITY;

-- alarm_definitions: read-only for authenticated users (system/admin managed)
CREATE POLICY "Authenticated users can view alarm definitions"
  ON alarm_definitions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- alarm_events: org-scoped access
CREATE POLICY "Users can view alarm events in their org"
  ON alarm_events FOR SELECT
  USING (org_id IN (SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can insert alarm events"
  ON alarm_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update alarm events in their org"
  ON alarm_events FOR UPDATE
  USING (org_id IN (SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()));

-- alarm_org_overrides: admin access
CREATE POLICY "Users can view org overrides"
  ON alarm_org_overrides FOR SELECT
  USING (org_id IN (SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage org overrides"
  ON alarm_org_overrides FOR ALL
  USING (org_id IN (SELECT organization_id::text FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- alarm_site_overrides: admin access
CREATE POLICY "Users can view site overrides"
  ON alarm_site_overrides FOR SELECT
  USING (org_id IN (SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage site overrides"
  ON alarm_site_overrides FOR ALL
  USING (org_id IN (SELECT organization_id::text FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- alarm_unit_overrides: admin access
CREATE POLICY "Users can view unit overrides"
  ON alarm_unit_overrides FOR SELECT
  USING (org_id IN (SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage unit overrides"
  ON alarm_unit_overrides FOR ALL
  USING (org_id IN (SELECT organization_id::text FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Fix search_path on the new functions
ALTER FUNCTION get_effective_alarm_config(text, text, text, text) SET search_path = public;
ALTER FUNCTION resolve_available_tiers(text, text, text) SET search_path = public;
ALTER FUNCTION get_available_alarms_for_unit(text, text, text) SET search_path = public;
ALTER FUNCTION update_alarm_updated_at() SET search_path = public;
