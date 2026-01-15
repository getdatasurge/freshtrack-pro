-- SUPER ADMIN REVOKE SCRIPT
-- ================================
-- This script revokes the SUPER_ADMIN platform role from a user by email.
--
-- SECURITY NOTES:
-- - This script must be run with service_role (admin) privileges
-- - It cannot be executed through the normal application API
-- - Revocation is logged in super_admin_audit_log
--
-- USAGE:
-- Run via Supabase SQL Editor with service_role, or via psql with admin credentials:
--   psql -h <host> -U postgres -d <db> -f revoke-super-admin.sql

DO $$
DECLARE
  v_target_email text := 'info@sustainablefinishes.com'; -- Change this as needed
  v_user_id uuid;
  v_role_id uuid;
BEGIN
  -- Lookup the user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_target_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'USER NOT FOUND: %', v_target_email;
    RAISE NOTICE '========================================';
    RETURN;
  END IF;

  -- Check if has SUPER_ADMIN role
  SELECT id INTO v_role_id
  FROM platform_roles
  WHERE user_id = v_user_id AND role = 'SUPER_ADMIN';

  IF v_role_id IS NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User % does not have SUPER_ADMIN role', v_target_email;
    RAISE NOTICE '========================================';
    RETURN;
  END IF;

  -- Log the revocation (direct insert since we're using service role)
  INSERT INTO super_admin_audit_log (
    actor_user_id,
    action_type,
    target_type,
    target_id,
    metadata
  ) VALUES (
    v_user_id, -- Actor is the target user since this is admin action
    'SUPER_ADMIN_REVOKED',
    'user',
    v_user_id,
    jsonb_build_object(
      'revoked_via', 'admin_script',
      'email', v_target_email
    )
  );

  -- Revoke the role
  DELETE FROM platform_roles
  WHERE id = v_role_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUCCESS: SUPER_ADMIN revoked';
  RAISE NOTICE 'Email: %', v_target_email;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE '========================================';
END;
$$;
