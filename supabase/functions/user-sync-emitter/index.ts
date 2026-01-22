import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deobfuscateKey } from "../_shared/ttnConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserSite {
  site_id: string;
  site_name: string;
}

interface TriggerPayload {
  event_type: 'INSERT' | 'UPDATE';
  user_id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  site_id: string | null;
  unit_id: string | null;
  updated_at: string;
  default_site_id: string | null;
  user_sites: UserSite[];
}

interface TtnConfig {
  enabled: boolean;
  cluster: string;
  application_id: string | null;
  api_key: string | null;
  api_key_last4: string | null;
  gateway_api_key: string | null;
  gateway_api_key_last4: string | null;
  gateway_owner_type: 'organization' | null;
  gateway_owner_id: string | null;
  webhook_id: string | null;
  webhook_url: string | null;
  webhook_secret_last4: string | null;
}

interface Project2Payload {
  users: Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    organization_id: string | null;
    site_id: string | null;
    unit_id: string | null;
    updated_at: string;
    default_site_id: string | null;
    user_sites: UserSite[];
    ttn: TtnConfig;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const project2Endpoint = Deno.env.get('PROJECT2_SYNC_ENDPOINT');
  const project2ApiKey = Deno.env.get('PROJECT2_SYNC_API_KEY');

  if (!project2Endpoint || !project2ApiKey) {
    console.error('[user-sync-emitter] Missing PROJECT2_SYNC_ENDPOINT or PROJECT2_SYNC_API_KEY');
    return new Response(
      JSON.stringify({ error: 'Sync configuration missing' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const triggerPayload: TriggerPayload = await req.json();

    console.log(`[user-sync-emitter] Received ${triggerPayload.event_type} event for user ${triggerPayload.user_id}`);
    console.log(`[user-sync-emitter] Site data: default_site_id=${triggerPayload.default_site_id}, user_sites=${JSON.stringify(triggerPayload.user_sites)}`);

    // NAM1-ONLY: Default cluster is always nam1
    let ttnConfig: TtnConfig = {
      enabled: false,
      cluster: "nam1",
      application_id: null,
      api_key: null,
      api_key_last4: null,
      gateway_api_key: null,
      gateway_api_key_last4: null,
      gateway_owner_type: null,
      gateway_owner_id: null,
      webhook_id: null,
      webhook_url: null,
      webhook_secret_last4: null,
    };

    if (triggerPayload.organization_id) {
      console.log(`[user-sync-emitter] Fetching TTN config for org: ${triggerPayload.organization_id}`);

      const { data: ttnConnection } = await supabase
        .from("ttn_connections")
        .select(`
          is_enabled, 
          ttn_region, 
          ttn_application_id, 
          ttn_api_key_encrypted, 
          ttn_api_key_last4,
          ttn_org_api_key_encrypted,
          ttn_org_api_key_last4,
          tts_organization_id,
          ttn_webhook_id,
          ttn_webhook_url,
          ttn_webhook_secret_last4
        `)
        .eq("organization_id", triggerPayload.organization_id)
        .maybeSingle();

      if (ttnConnection) {
        console.log(`[user-sync-emitter] Found TTN config, enabled: ${ttnConnection.is_enabled}, app: ${ttnConnection.ttn_application_id}`);

        // Decrypt the API key
        const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") ||
          supabaseServiceKey?.slice(0, 32) || "";

        // Decrypt the Application API key
        const fullApiKey = ttnConnection.ttn_api_key_encrypted
          ? deobfuscateKey(ttnConnection.ttn_api_key_encrypted, encryptionSalt)
          : null;

        // Decrypt the Gateway/Organization API key
        const fullGatewayApiKey = ttnConnection.ttn_org_api_key_encrypted
          ? deobfuscateKey(ttnConnection.ttn_org_api_key_encrypted, encryptionSalt)
          : null;

        ttnConfig = {
          enabled: ttnConnection.is_enabled || false,
          // NAM1-ONLY: Always use nam1 regardless of stored value
          cluster: "nam1",
          application_id: ttnConnection.ttn_application_id || null,
          api_key: fullApiKey,
          api_key_last4: ttnConnection.ttn_api_key_last4 || null,
          gateway_api_key: fullGatewayApiKey,
          gateway_api_key_last4: ttnConnection.ttn_org_api_key_last4 || null,
          gateway_owner_type: ttnConnection.tts_organization_id ? 'organization' : null,
          gateway_owner_id: ttnConnection.tts_organization_id || null,
          webhook_id: ttnConnection.ttn_webhook_id || null,
          webhook_url: ttnConnection.ttn_webhook_url || null,
          webhook_secret_last4: ttnConnection.ttn_webhook_secret_last4 || null,
        };

        console.log(`[user-sync-emitter] TTN config prepared: cluster=${ttnConfig.cluster}, app=${ttnConfig.application_id}, api_key_present=${!!ttnConfig.api_key}, gateway_api_key_present=${!!ttnConfig.gateway_api_key}`);
      } else {
        console.log(`[user-sync-emitter] No TTN config found for org: ${triggerPayload.organization_id}`);
      }
    }

    // Build the outbound payload for Project 2 with site membership data and TTN config
    const outboundPayload: Project2Payload = {
      users: [
        {
          user_id: triggerPayload.user_id,
          email: triggerPayload.email,
          full_name: triggerPayload.full_name,
          organization_id: triggerPayload.organization_id,
          site_id: triggerPayload.site_id,
          unit_id: triggerPayload.unit_id,
          updated_at: triggerPayload.updated_at,
          default_site_id: triggerPayload.default_site_id,
          user_sites: triggerPayload.user_sites || [],
          ttn: ttnConfig,
        }
      ]
    };

    console.log(`[user-sync-emitter] Sending to Project 2: ${project2Endpoint}`);
    console.log(`[user-sync-emitter] Outbound payload:`, JSON.stringify(outboundPayload, null, 2));

    // POST to Project 2's user-sync endpoint
    const response = await fetch(project2Endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${project2ApiKey}`,
      },
      body: JSON.stringify(outboundPayload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[user-sync-emitter] Project 2 returned ${response.status}: ${responseText}`);

      // Update sync log to failed
      await supabase
        .from('user_sync_log')
        .update({
          status: 'failed',
          last_error: `HTTP ${response.status}: ${responseText}`,
          attempts: 1
        })
        .eq('user_id', triggerPayload.user_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({ error: 'Failed to sync to Project 2', status: response.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[user-sync-emitter] Successfully synced user ${triggerPayload.user_id} to Project 2`);

    // Update sync log to sent
    await supabase
      .from('user_sync_log')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempts: 1
      })
      .eq('user_id', triggerPayload.user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ success: true, user_id: triggerPayload.user_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[user-sync-emitter] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
