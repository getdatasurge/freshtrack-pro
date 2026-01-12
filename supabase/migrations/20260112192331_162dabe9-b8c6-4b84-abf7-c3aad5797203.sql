-- Rename twilio_sid to provider_message_id for provider-agnostic design
ALTER TABLE sms_alert_log 
RENAME COLUMN twilio_sid TO provider_message_id;

-- Add comment documenting the column purpose
COMMENT ON COLUMN sms_alert_log.provider_message_id 
IS 'Message ID from SMS provider (Telnyx message UUID)';