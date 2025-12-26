-- Drop the profiles_safe view as it has no RLS and exposes PII
-- The application now queries the profiles table directly which has proper RLS
DROP VIEW IF EXISTS public.profiles_safe;