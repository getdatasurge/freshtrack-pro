-- Add restrictive RLS policy for user_sync_log (service role only)
-- This policy denies all access to regular users, only service role bypasses RLS
CREATE POLICY "Service role only" ON public.user_sync_log
FOR ALL
USING (false)
WITH CHECK (false);