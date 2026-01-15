-- SUPER ADMIN BOOTSTRAP SCRIPT
-- ================================
-- This script grants the SUPER_ADMIN platform role to a user by email.
--
-- SECURITY NOTES:
-- - This script must be run with service_role (admin) privileges
-- - It cannot be executed through the normal application API
-- - No passwords are created or stored - the user must use standard auth flows
-- - The target user account must already exist in auth.users
--
-- USAGE:
-- Run via Supabase SQL Editor with service_role, or via psql with admin credentials:
--   psql -h <host> -U postgres -d <db> -f grant-super-admin.sql
--
-- To use with a different email, set the SUPER_ADMIN_EMAIL variable before running:
--   \set super_admin_email 'another@example.com'
--   \i grant-super-admin.sql

-- Default bootstrap email
DO $$
DECLARE
  v_target_email text := 'info@sustainablefinishes.com';
  v_user_id uuid;
  v_existing_role_id uuid;
BEGIN
  -- Lookup the user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_target_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'USER NOT FOUND: %', v_target_email;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'The user must first create an account using the standard auth flow:';
    RAISE NOTICE '  1. Sign up at the application login page, OR';
    RAISE NOTICE '  2. Be invited via the admin user invite flow, OR';
    RAISE NOTICE '  3. Create via Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '';
    RAISE NOTICE 'After the account exists, run this script again.';
    RAISE NOTICE '========================================';
    RETURN;
  END IF;

  -- Check if already has SUPER_ADMIN role
  SELECT id INTO v_existing_role_id
  FROM platform_roles
  WHERE user_id = v_user_id AND role = 'SUPER_ADMIN';

  IF v_existing_role_id IS NOT NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User % already has SUPER_ADMIN role', v_target_email;
    RAISE NOTICE 'Role ID: %', v_existing_role_id;
    RAISE NOTICE '========================================';
    RETURN;
  END IF;

  -- Grant SUPER_ADMIN role
  INSERT INTO platform_roles (user_id, role, granted_by)
  VALUES (v_user_id, 'SUPER_ADMIN', NULL) -- granted_by is NULL for bootstrap
  RETURNING id INTO v_existing_role_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUCCESS: SUPER_ADMIN granted';
  RAISE NOTICE 'Email: %', v_target_email;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Role Entry ID: %', v_existing_role_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Ensure the user can log in (send password reset if needed)';
  RAISE NOTICE '  2. The user will see the Platform Admin menu after login';
  RAISE NOTICE '========================================';
END;
$$;
