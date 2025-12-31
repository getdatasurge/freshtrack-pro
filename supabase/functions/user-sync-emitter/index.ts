import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Build the outbound payload for Project 2 with site membership data
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
