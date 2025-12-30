-- Set the existing TTN application for Restaurant4 organization
UPDATE public.organizations
SET 
  ttn_application_id = 'frostguard',
  ttn_application_created = true,
  ttn_webhook_configured = true
WHERE slug = 'restaurant4';