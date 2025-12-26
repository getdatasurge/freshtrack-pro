-- Drop the security definer view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe;

-- Recreate the view with SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.profiles_safe 
WITH (security_invoker = true)
AS
SELECT 
  id, user_id, organization_id, full_name, avatar_url, 
  created_at, updated_at, notification_preferences,
  CASE 
    WHEN user_id = auth.uid() THEN email
    WHEN organization_id IS NOT NULL AND public.can_view_contact_details(auth.uid(), organization_id) THEN email
    ELSE '***@***.***'
  END as email,
  CASE 
    WHEN user_id = auth.uid() THEN phone
    WHEN organization_id IS NOT NULL AND public.can_view_contact_details(auth.uid(), organization_id) THEN phone
    ELSE NULL
  END as phone
FROM public.profiles;