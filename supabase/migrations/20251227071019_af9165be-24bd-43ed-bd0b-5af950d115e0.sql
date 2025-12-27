-- Add acknowledgment_notes column to alerts table
ALTER TABLE public.alerts
ADD COLUMN acknowledgment_notes text;

-- Add a comment describing the column
COMMENT ON COLUMN public.alerts.acknowledgment_notes IS 'Notes provided when acknowledging the alert';