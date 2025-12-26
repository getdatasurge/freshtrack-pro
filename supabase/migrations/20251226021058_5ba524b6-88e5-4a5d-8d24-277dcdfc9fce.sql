-- Create helper function for audit log access control
CREATE OR REPLACE FUNCTION public.can_view_all_audit_logs(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, _org_id, 'owner'::app_role) 
      OR public.has_role(_user_id, _org_id, 'admin'::app_role)
$$;

-- Create a secure view that masks sensitive contact data for non-privileged users
CREATE OR REPLACE VIEW public.profiles_safe AS
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
FROM public.profiles
WHERE user_id = auth.uid() 
   OR public.user_belongs_to_org(auth.uid(), organization_id);

-- Drop old permissive event_logs policy
DROP POLICY IF EXISTS "Users can view event logs" ON public.event_logs;

-- Create new restrictive policy for event_logs with role-based access
CREATE POLICY "Role-based event log access"
ON public.event_logs FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  AND (
    -- Admins/owners can see all logs in their org
    public.can_view_all_audit_logs(auth.uid(), organization_id)
    -- Regular users can only see their own actions
    OR actor_id = auth.uid()
  )
);