-- Fix stale provisioning_status for orgs with valid credentials
-- Only update rows that have BOTH application_id AND api_key but have stale status
UPDATE ttn_connections
SET 
  provisioning_status = 'ready',
  updated_at = now()
WHERE 
  ttn_application_id IS NOT NULL
  AND ttn_api_key_encrypted IS NOT NULL
  AND provisioning_status IN ('idle', 'not_started', 'failed');