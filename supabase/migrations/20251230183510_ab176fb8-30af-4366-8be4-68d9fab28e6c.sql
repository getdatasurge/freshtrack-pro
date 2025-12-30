-- Drop and recreate foreign keys with ON DELETE SET NULL

-- 1. gateways.created_by
ALTER TABLE public.gateways
DROP CONSTRAINT gateways_created_by_fkey;

ALTER TABLE public.gateways
ADD CONSTRAINT gateways_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. lora_sensors.created_by
ALTER TABLE public.lora_sensors
DROP CONSTRAINT lora_sensors_created_by_fkey;

ALTER TABLE public.lora_sensors
ADD CONSTRAINT lora_sensors_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. pairing_sessions.initiated_by
ALTER TABLE public.pairing_sessions
DROP CONSTRAINT pairing_sessions_initiated_by_fkey;

ALTER TABLE public.pairing_sessions
ADD CONSTRAINT pairing_sessions_initiated_by_fkey
FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. manual_temperature_logs.logged_by
ALTER TABLE public.manual_temperature_logs
DROP CONSTRAINT manual_temperature_logs_logged_by_fkey;

ALTER TABLE public.manual_temperature_logs
ADD CONSTRAINT manual_temperature_logs_logged_by_fkey
FOREIGN KEY (logged_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. event_logs.actor_id
ALTER TABLE public.event_logs
DROP CONSTRAINT event_logs_actor_id_fkey;

ALTER TABLE public.event_logs
ADD CONSTRAINT event_logs_actor_id_fkey
FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 6. alerts.acknowledged_by
ALTER TABLE public.alerts
DROP CONSTRAINT alerts_acknowledged_by_fkey;

ALTER TABLE public.alerts
ADD CONSTRAINT alerts_acknowledged_by_fkey
FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 7. alerts.resolved_by
ALTER TABLE public.alerts
DROP CONSTRAINT alerts_resolved_by_fkey;

ALTER TABLE public.alerts
ADD CONSTRAINT alerts_resolved_by_fkey
FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 8. corrective_actions.created_by
ALTER TABLE public.corrective_actions
DROP CONSTRAINT corrective_actions_created_by_fkey;

ALTER TABLE public.corrective_actions
ADD CONSTRAINT corrective_actions_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 9. calibration_records.performed_by
ALTER TABLE public.calibration_records
DROP CONSTRAINT calibration_records_performed_by_fkey;

ALTER TABLE public.calibration_records
ADD CONSTRAINT calibration_records_performed_by_fkey
FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;