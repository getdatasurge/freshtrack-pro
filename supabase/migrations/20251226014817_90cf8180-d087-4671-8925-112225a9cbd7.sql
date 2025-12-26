-- =============================================================
-- SECURITY FIX 1: Create helper function for profile access control
-- =============================================================
CREATE OR REPLACE FUNCTION public.can_view_contact_details(_viewer_id uuid, _target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_viewer_id, _target_org_id, 'owner'::app_role) 
      OR public.has_role(_viewer_id, _target_org_id, 'admin'::app_role)
$$;

-- =============================================================
-- SECURITY FIX 2: Update invoices RLS policy - restrict to admins/owners only
-- =============================================================
DROP POLICY IF EXISTS "Users can view invoices" ON public.invoices;

CREATE POLICY "Admins can view invoices"
  ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions sub
    WHERE sub.id = invoices.subscription_id
    AND (
      public.has_role(auth.uid(), sub.organization_id, 'owner'::app_role)
      OR public.has_role(auth.uid(), sub.organization_id, 'admin'::app_role)
    )
  ));

-- =============================================================
-- SECURITY FIX 3: Add INSERT policy for sensor_readings
-- Block direct user inserts - only service role can insert (for IoT devices)
-- =============================================================
CREATE POLICY "Block user inserts on sensor readings"
  ON public.sensor_readings FOR INSERT
  WITH CHECK (false);

-- Note: Service role bypasses RLS, so device ingestion still works