import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ListDevicesRequest {
  organization_id: string;
}

interface TTNDevice {
  device_id: string;
  dev_eui: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-list-devices-v1-20251230";
  console.log(`[ttn-list-devices] Build: ${BUILD_VERSION}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ttnApiKey = Deno.env.get("TTN_API_KEY");
    const ttnIsBaseUrl = Deno.env.get("TTN_IS_BASE_URL") || "https://eu1.cloud.thethings.network";

    if (!ttnApiKey) {
      return new Response(
        JSON.stringify({ error: "TTN credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ListDevicesRequest = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has admin access to this org
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .in("role", ["owner", "admin"])
      .single();

    if (!role) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org's TTN application ID
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("ttn_application_id")
      .eq("id", organization_id)
      .single();

    if (orgError || !org?.ttn_application_id) {
      return new Response(
        JSON.stringify({ 
          error: "TTN application not configured",
          devices: [],
          orphans: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ttnAppId = org.ttn_application_id;
    console.log(`[ttn-list-devices] Listing devices for TTN app: ${ttnAppId}`);

    // Normalize URL
    const normalizeUrl = (url: string) => {
      let normalized = url.trim().replace(/\/+$/, "");
      if (normalized.endsWith("/api/v3")) {
        normalized = normalized.slice(0, -7);
      }
      return normalized;
    };

    const effectiveIsBaseUrl = normalizeUrl(ttnIsBaseUrl);

    // List devices from TTN
    const listUrl = `${effectiveIsBaseUrl}/api/v3/applications/${ttnAppId}/devices?field_mask=name,created_at,updated_at,ids.dev_eui`;
    console.log(`[ttn-list-devices] GET ${listUrl}`);
    
    const response = await fetch(listUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ttnApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ttn-list-devices] TTN API error: ${response.status} ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          error: `TTN API error: ${response.status}`,
          details: errorText,
          devices: [],
          orphans: []
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const ttnDevices: TTNDevice[] = (result.end_devices || []).map((d: Record<string, unknown>) => ({
      device_id: (d.ids as Record<string, string>)?.device_id,
      dev_eui: (d.ids as Record<string, string>)?.dev_eui,
      name: d.name as string,
      created_at: d.created_at as string,
      updated_at: d.updated_at as string,
    }));

    console.log(`[ttn-list-devices] Found ${ttnDevices.length} devices in TTN`);

    // Get all sensors from FrostGuard for this org
    const { data: sensors, error: sensorsError } = await supabase
      .from("lora_sensors")
      .select("id, dev_eui, name, ttn_device_id")
      .eq("organization_id", organization_id);

    if (sensorsError) {
      console.error(`[ttn-list-devices] Failed to fetch sensors:`, sensorsError);
    }

    const fgDevEuis = new Set((sensors || []).map(s => s.dev_eui.toUpperCase()));
    
    // Find orphans: devices in TTN but not in FrostGuard
    const orphans = ttnDevices.filter(d => !fgDevEuis.has(d.dev_eui?.toUpperCase()));
    
    console.log(`[ttn-list-devices] Found ${orphans.length} orphaned devices`);

    return new Response(
      JSON.stringify({
        ttn_application_id: ttnAppId,
        devices: ttnDevices,
        orphans,
        frostguard_sensors: sensors?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[ttn-list-devices] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, devices: [], orphans: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
