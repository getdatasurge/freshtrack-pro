-- Update table comment to reference Telnyx instead of Twilio
COMMENT ON TABLE public.sms_alert_log IS 'Logs all SMS alerts sent via Telnyx, including rate-limited and failed attempts';