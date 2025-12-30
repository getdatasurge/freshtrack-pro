-- Fix schema mismatch: allow ON DELETE SET NULL to work by making columns nullable

-- 1. pairing_sessions.initiated_by
ALTER TABLE public.pairing_sessions ALTER COLUMN initiated_by DROP NOT NULL;

-- 2. manual_temperature_logs.logged_by
ALTER TABLE public.manual_temperature_logs ALTER COLUMN logged_by DROP NOT NULL;

-- 3. corrective_actions.created_by
ALTER TABLE public.corrective_actions ALTER COLUMN created_by DROP NOT NULL;

-- 4. calibration_records.performed_by
ALTER TABLE public.calibration_records ALTER COLUMN performed_by DROP NOT NULL;