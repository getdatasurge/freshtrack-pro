-- Create ttn_provisioning_logs table for debugging
CREATE TABLE public.ttn_provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  duration_ms INTEGER,
  request_id TEXT
);

-- Create index for efficient querying
CREATE INDEX idx_ttn_provisioning_logs_org_created ON public.ttn_provisioning_logs(organization_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.ttn_provisioning_logs ENABLE ROW LEVEL SECURITY;

-- RLS: only org admins/owners can read logs
CREATE POLICY "Org admins can view provisioning logs" ON public.ttn_provisioning_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() 
            AND organization_id = ttn_provisioning_logs.organization_id 
            AND role IN ('owner', 'admin'))
  );

-- Add new columns to ttn_connections for retry support
ALTER TABLE public.ttn_connections 
ADD COLUMN IF NOT EXISTS provisioning_last_step TEXT,
ADD COLUMN IF NOT EXISTS provisioning_can_retry BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS provisioning_step_details JSONB;