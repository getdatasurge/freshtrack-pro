-- Create ttn_connections table for org-scoped TTN configuration
CREATE TABLE public.ttn_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  
  -- TTN Stack Configuration
  ttn_region text DEFAULT 'NAM1',
  ttn_stack_base_url text,
  ttn_identity_server_url text,
  
  -- TTN Application
  ttn_application_id text,
  ttn_application_name text,
  ttn_user_id text,
  
  -- Webhook Configuration
  ttn_webhook_id text DEFAULT 'frostguard',
  ttn_webhook_url text,
  
  -- API Keys (stored encrypted - last4 for display)
  ttn_api_key_encrypted text,
  ttn_api_key_last4 text,
  ttn_api_key_updated_at timestamptz,
  
  ttn_webhook_api_key_encrypted text,
  ttn_webhook_api_key_last4 text,
  
  -- Status & Audit
  last_connection_test_at timestamptz,
  last_connection_test_result jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.ttn_connections ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can access TTN connections
CREATE POLICY "Admins can manage TTN connections"
ON public.ttn_connections FOR ALL
USING (
  has_role(auth.uid(), organization_id, 'owner') 
  OR has_role(auth.uid(), organization_id, 'admin')
);

-- Create trigger for updated_at
CREATE TRIGGER update_ttn_connections_updated_at
  BEFORE UPDATE ON public.ttn_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for organization lookup
CREATE INDEX idx_ttn_connections_org_id ON public.ttn_connections(organization_id);

-- Add comment for documentation
COMMENT ON TABLE public.ttn_connections IS 'Organization-scoped TTN connection settings for LoRaWAN device provisioning';