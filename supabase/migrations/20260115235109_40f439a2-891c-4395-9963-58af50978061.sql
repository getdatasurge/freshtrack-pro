-- PHASE 1: Grant SUPER_ADMIN role to info@sustainablefinishes.com
-- This is idempotent - will not duplicate if already exists due to unique constraint

DO $$
DECLARE
  v_user_id uuid;
  v_existing_role_id uuid;
BEGIN
  -- Find the user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'info@sustainablefinishes.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'USER NOT FOUND: info@sustainablefinishes.com';
    RAISE NOTICE 'The user must first create an account.';
    RAISE NOTICE '========================================';
    -- Don't raise exception - allow migration to complete
    RETURN;
  END IF;

  -- Check if role already exists
  SELECT id INTO v_existing_role_id
  FROM public.platform_roles
  WHERE user_id = v_user_id AND role = 'SUPER_ADMIN';

  IF v_existing_role_id IS NOT NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User already has SUPER_ADMIN role';
    RAISE NOTICE 'Role ID: %', v_existing_role_id;
    RAISE NOTICE '========================================';
    RETURN;
  END IF;

  -- Grant SUPER_ADMIN role
  INSERT INTO public.platform_roles (user_id, role, granted_by, notes)
  VALUES (v_user_id, 'SUPER_ADMIN', NULL, 'Initial bootstrap via migration - Phase 1')
  RETURNING id INTO v_existing_role_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUCCESS: SUPER_ADMIN role granted';
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Role Entry ID: %', v_existing_role_id;
  RAISE NOTICE '========================================';
END;
$$;