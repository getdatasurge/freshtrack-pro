-- Add super admin SELECT policy to areas table for impersonation support
CREATE POLICY "Super admins can view all areas"
  ON public.areas
  FOR SELECT
  TO authenticated
  USING (is_current_user_super_admin());

-- Add super admin SELECT policy to entity_dashboard_layouts table for impersonation support
CREATE POLICY "Super admins can view all layouts"
  ON public.entity_dashboard_layouts
  FOR SELECT
  TO authenticated
  USING (is_current_user_super_admin());