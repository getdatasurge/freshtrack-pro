-- Drop the existing partial indexes that don't work with upsert
DROP INDEX IF EXISTS notification_policies_org_alert_type_idx;
DROP INDEX IF EXISTS notification_policies_site_alert_type_idx;
DROP INDEX IF EXISTS notification_policies_unit_alert_type_idx;

-- Create proper unique constraints for upsert to work
-- Using NULLS NOT DISTINCT so that (NULL, 'temp_excursion') is treated as equal to another (NULL, 'temp_excursion')
ALTER TABLE notification_policies
ADD CONSTRAINT notification_policies_org_alert_unique 
  UNIQUE NULLS NOT DISTINCT (organization_id, alert_type);

ALTER TABLE notification_policies
ADD CONSTRAINT notification_policies_site_alert_unique 
  UNIQUE NULLS NOT DISTINCT (site_id, alert_type);

ALTER TABLE notification_policies
ADD CONSTRAINT notification_policies_unit_alert_unique 
  UNIQUE NULLS NOT DISTINCT (unit_id, alert_type);