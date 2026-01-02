-- Create account deletion jobs table for tracking and resumability
CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  status text NOT NULL DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'PREPARING', 'DELETING_SENSORS', 'DELETING_GATEWAYS', 
                      'REMOVING_MEMBERSHIP', 'DELETING_ORG', 'ANONYMIZING', 'COMPLETED', 'FAILED')),
  current_step text,
  steps_completed jsonb DEFAULT '[]'::jsonb,
  error_message text,
  request_id uuid DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  deleted_user_email text,
  org_had_other_users boolean DEFAULT false,
  org_deleted boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own deletion jobs
CREATE POLICY "Users can view own deletion jobs"
ON public.account_deletion_jobs
FOR SELECT
USING (user_id = auth.uid());

-- Create the delete_user_account RPC function
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_count int;
  v_is_owner boolean;
  v_job_id uuid;
  v_result jsonb;
  v_sensors_queued int := 0;
  v_gateways_deleted int := 0;
  v_user_email text;
BEGIN
  -- Verify the caller is deleting their own account
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Can only delete your own account';
  END IF;

  -- Get user's organization and email
  SELECT organization_id, email INTO v_org_id, v_user_email
  FROM profiles WHERE user_id = p_user_id;
  
  IF v_org_id IS NULL THEN
    -- User has no org, just anonymize profile
    UPDATE profiles SET 
      email = 'deleted_' || gen_random_uuid() || '@deleted.local',
      full_name = '[Deleted User]',
      phone = NULL,
      avatar_url = NULL,
      notification_preferences = NULL
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Account anonymized (no organization)',
      'org_deleted', false
    );
  END IF;
  
  -- Count other users in org
  SELECT COUNT(*) INTO v_user_count 
  FROM user_roles 
  WHERE organization_id = v_org_id AND user_id != p_user_id;
  
  -- Check if user is owner
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND organization_id = v_org_id AND role = 'owner'
  ) INTO v_is_owner;
  
  -- Create deletion job for tracking
  INSERT INTO account_deletion_jobs (user_id, organization_id, deleted_user_email, org_had_other_users)
  VALUES (p_user_id, v_org_id, v_user_email, (v_user_count > 0))
  RETURNING id INTO v_job_id;
  
  -- Update status: PREPARING
  UPDATE account_deletion_jobs SET status = 'PREPARING', current_step = 'Checking ownership' WHERE id = v_job_id;
  
  -- CASE 1: User is only member → delete entire org
  IF v_user_count = 0 THEN
    -- Queue TTN deprovision for all sensors
    UPDATE account_deletion_jobs SET status = 'DELETING_SENSORS', current_step = 'Queuing sensor cleanup' WHERE id = v_job_id;
    
    INSERT INTO ttn_deprovision_jobs (
      organization_id, sensor_id, dev_eui, ttn_device_id, 
      ttn_application_id, reason, sensor_name, site_id, unit_id
    )
    SELECT ls.organization_id, ls.id, ls.dev_eui, ls.ttn_device_id,
           ls.ttn_application_id, 'USER_DELETED', ls.name, ls.site_id, ls.unit_id
    FROM lora_sensors ls
    WHERE ls.organization_id = v_org_id 
      AND ls.ttn_device_id IS NOT NULL
      AND ls.ttn_application_id IS NOT NULL;
    GET DIAGNOSTICS v_sensors_queued = ROW_COUNT;
    
    -- Delete sensors (this will trigger deprovision queue via existing trigger)
    DELETE FROM lora_sensors WHERE organization_id = v_org_id;
    
    -- Delete gateways
    UPDATE account_deletion_jobs SET status = 'DELETING_GATEWAYS', current_step = 'Removing gateways' WHERE id = v_job_id;
    DELETE FROM gateways WHERE organization_id = v_org_id;
    GET DIAGNOSTICS v_gateways_deleted = ROW_COUNT;
    
    -- Soft delete the org and all children
    UPDATE account_deletion_jobs SET status = 'DELETING_ORG', current_step = 'Deleting organization' WHERE id = v_job_id;
    PERFORM soft_delete_organization(v_org_id, p_user_id);
    
    UPDATE account_deletion_jobs SET org_deleted = true WHERE id = v_job_id;
    
  -- CASE 2: Org has other users → just remove this user
  ELSE
    -- If owner trying to delete without transferring ownership
    IF v_is_owner THEN
      UPDATE account_deletion_jobs SET status = 'FAILED', error_message = 'Cannot delete owner account while other users exist' WHERE id = v_job_id;
      RETURN jsonb_build_object(
        'success', false,
        'job_id', v_job_id,
        'error', 'Cannot delete owner account while other users exist. Transfer ownership first.',
        'error_code', 'OWNER_TRANSFER_REQUIRED'
      );
    END IF;
    
    -- Nullify created_by on sensors created by this user (don't delete shared sensors)
    UPDATE account_deletion_jobs SET status = 'DELETING_SENSORS', current_step = 'Cleaning user references' WHERE id = v_job_id;
    UPDATE lora_sensors SET created_by = NULL WHERE created_by = p_user_id;
    
    -- Nullify created_by on gateways
    UPDATE gateways SET created_by = NULL WHERE created_by = p_user_id;
  END IF;
  
  -- Remove user from org
  UPDATE account_deletion_jobs SET status = 'REMOVING_MEMBERSHIP', current_step = 'Removing membership' WHERE id = v_job_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;
  
  -- Anonymize profile (since we can't delete auth.users without service role)
  UPDATE account_deletion_jobs SET status = 'ANONYMIZING', current_step = 'Anonymizing profile' WHERE id = v_job_id;
  UPDATE profiles SET 
    email = 'deleted_' || gen_random_uuid() || '@deleted.local',
    full_name = '[Deleted User]',
    phone = NULL,
    avatar_url = NULL,
    notification_preferences = NULL,
    organization_id = NULL,
    site_id = NULL,
    unit_id = NULL
  WHERE user_id = p_user_id;
  
  -- Mark org as dirty for emulator sync (if org still exists)
  IF v_user_count > 0 AND v_org_id IS NOT NULL THEN
    INSERT INTO org_sync_state (organization_id, is_dirty, last_change_at, sync_version)
    VALUES (v_org_id, true, now(), 1)
    ON CONFLICT (organization_id) DO UPDATE SET
      is_dirty = true,
      last_change_at = now(),
      sync_version = org_sync_state.sync_version + 1;
  END IF;
  
  -- Complete the job
  UPDATE account_deletion_jobs SET 
    status = 'COMPLETED', 
    current_step = 'Done',
    completed_at = now(),
    steps_completed = jsonb_build_array('prepare', 'sensors', 'gateways', 'membership', 'anonymize')
  WHERE id = v_job_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'request_id', (SELECT request_id FROM account_deletion_jobs WHERE id = v_job_id),
    'sensors_queued', v_sensors_queued,
    'gateways_deleted', v_gateways_deleted,
    'org_deleted', (v_user_count = 0),
    'org_had_other_users', (v_user_count > 0)
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Log failure
  IF v_job_id IS NOT NULL THEN
    UPDATE account_deletion_jobs SET 
      status = 'FAILED', 
      error_message = SQLERRM
    WHERE id = v_job_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', false,
    'job_id', v_job_id,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;