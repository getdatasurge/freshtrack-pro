-- Create function to check if user can manage annotations (owner, admin, manager)
CREATE OR REPLACE FUNCTION public.can_manage_annotations(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin', 'manager')
  )
$$;

-- Add DELETE policy on event_logs for annotations
CREATE POLICY "Managers can delete annotations"
ON public.event_logs
FOR DELETE
TO authenticated
USING (
  event_type IN ('note_added', 'comment', 'shift_handoff', 'annotation')
  AND can_manage_annotations(auth.uid(), organization_id)
);