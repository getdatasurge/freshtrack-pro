-- ============================================
-- RESTRICTIVE POLICIES TO BLOCK ANONYMOUS ACCESS
-- These policies require authentication before any other policy is evaluated
-- ============================================

-- 1. Block anonymous access to profiles table
CREATE POLICY "Require authentication for profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- 2. Block anonymous access to invoices table  
CREATE POLICY "Require authentication for invoices"
ON public.invoices
AS RESTRICTIVE
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- 3. Block anonymous access to sensor_readings table
CREATE POLICY "Require authentication for sensor_readings"
ON public.sensor_readings
AS RESTRICTIVE
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);