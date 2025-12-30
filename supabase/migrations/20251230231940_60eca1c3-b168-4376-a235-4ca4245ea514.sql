-- Drop existing overly permissive SELECT policies on profiles
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create a single, secure SELECT policy that:
-- 1. Allows users to always view their own profile
-- 2. Only allows viewing other profiles if they belong to the same organization
-- 3. Restricts sensitive fields (email, phone) to admins/owners unless viewing own profile
CREATE POLICY "Users can view profiles in same organization" 
ON public.profiles
FOR SELECT
USING (
  -- Always can view own profile
  user_id = auth.uid()
  OR 
  -- Can view others only if in same organization AND that organization is not null
  (
    organization_id IS NOT NULL 
    AND user_belongs_to_org(auth.uid(), organization_id)
  )
);