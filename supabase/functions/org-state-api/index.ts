import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-api-key',
};

interface OrgSyncPayload {
  organization_id: string;
  sync_version: number;
  updated_at: string;
  sites: Array<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    timezone: string;
    is_active: boolean;
  }>;
  sensors: Array<{
    id: string;
    name: string;
    dev_eui: string;
    app_eui: string | null;
    sensor_type: string;
    status: string;
    site_id: string | null;
    unit_id: string | null;
    ttn_device_id: string | null;
    ttn_application_id: string | null;
    manufacturer: string | null;
    model: string | null;
    is_primary: boolean;
    last_seen_at: string | null;
  }>;
  gateways: Array<{
    id: string;
    name: string;
    gateway_eui: string;
    status: string;
    site_id: string | null;
    description: string | null;
    last_seen_at: string | null;
  }>;
  ttn: {
    enabled: boolean;
    provisioning_status: string;
    cluster: string | null;
    application_id: string | null;
    webhook_id: string | null;
    webhook_url: string | null;
    api_key_last4: string | null;
    updated_at: string | null;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // API key authentication (same pattern as emulator-sync)
  const expectedApiKey = Deno.env.get('PROJECT2_SYNC_API_KEY');
  const authHeader = req.headers.get('authorization');
  const syncApiKey = req.headers.get('x-sync-api-key');
  const providedKey = authHeader?.replace('Bearer ', '') || syncApiKey;

  if (!expectedApiKey) {
    console.error('[org-state-api] PROJECT2_SYNC_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'Sync API not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!providedKey || providedKey !== expectedApiKey) {
    console.warn('[org-state-api] Unauthorized request - invalid API key');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get org_id from query params or body
  const url = new URL(req.url);
  let orgId = url.searchParams.get('org_id');

  // Also support POST with body
  if (!orgId && req.method === 'POST') {
    try {
      const body = await req.json();
      orgId = body.org_id || body.organization_id;
    } catch {
      // No body or invalid JSON
    }
  }

  if (!orgId) {
    return new Response(
      JSON.stringify({ error: 'org_id parameter required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Use anon key - the SECURITY DEFINER function handles access
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Check for dirty status first if requested
    const checkOnly = url.searchParams.get('check_only') === 'true';
    
    if (checkOnly) {
      console.log(`[org-state-api] Checking dirty status for org: ${orgId}`);
      const { data, error } = await supabase.rpc('check_org_dirty', {
        p_org_id: orgId
      });

      if (error) {
        console.error('[org-state-api] check_org_dirty error:', error);
        throw error;
      }

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get full sync payload
    console.log(`[org-state-api] Fetching full state for org: ${orgId}`);
    const { data, error } = await supabase.rpc('get_org_sync_payload', {
      p_org_id: orgId
    });

    if (error) {
      console.error('[org-state-api] get_org_sync_payload error:', error);
      throw error;
    }

    const payload = data as OrgSyncPayload;
    console.log(`[org-state-api] Returning state: ${payload.sensors?.length || 0} sensors, ${payload.gateways?.length || 0} gateways, ${payload.sites?.length || 0} sites`);

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[org-state-api] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
