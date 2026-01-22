import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CLUSTER_BASE_URL, assertClusterHost, logTtnApiCall } from "../_shared/ttnBase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateWebhookRequest {
  organization_id: string;
  webhook_url?: string;
  enabled_events?: string[];
  webhook_id?: string;
  confirm_id_change?: boolean;
}

interface UpdateWebhookResponse {
  ok: boolean;
  request_id: string;
  updated?: {
    webhook_url: string;
    webhook_id: string;
    enabled_events: string[];
    secret_last4: string;
  };
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
  synced_to_ttn: boolean;
  error?: {
    code: string;
    message: string;
    hint: string;
  };
}

const VALID_EVENTS = [
  "uplink_message",
  "join_accept",
  "downlink_ack",
  "downlink_nack",
  "downlink_sent",
  "downlink_failed",
  "downlink_queued",
  "location_solved",
  "service_data",
];

function log(level: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    function: "update-ttn-webhook",
    message,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

function generateRequestId(): string {
  return `utwh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only POST allowed" } }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: "UNAUTHORIZED", message: "Missing authorization header", hint: "Include Bearer token" },
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client for auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      log("warn", "Authentication failed", { error: authError?.message });
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token", hint: "Please log in again" },
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdateWebhookRequest = await req.json();
    const { organization_id, webhook_url, enabled_events, webhook_id, confirm_id_change } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: "MISSING_ORG_ID", message: "organization_id is required", hint: "" },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("info", "Processing webhook update request", { organization_id, user_id: user.id, requestId });

    // Verify user has admin/owner role
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (roleError || !roleData || !["owner", "admin"].includes(roleData.role)) {
      log("warn", "Permission denied", { user_id: user.id, organization_id });
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: "FORBIDDEN", message: "Admin or owner role required", hint: "Contact your organization owner" },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current TTN configuration
    const { data: ttnConfig, error: configError } = await adminClient
      .from("ttn_connections")
      .select("*")
      .eq("organization_id", organization_id)
      .single();

    if (configError || !ttnConfig) {
      log("error", "TTN configuration not found", { organization_id, error: configError?.message });
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: "TTN_NOT_CONFIGURED", message: "TTN connection not configured", hint: "Set up TTN connection first" },
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    const validationErrors: string[] = [];

    if (webhook_url !== undefined) {
      try {
        const url = new URL(webhook_url);
        if (url.protocol !== "https:") {
          validationErrors.push("Webhook URL must use HTTPS");
        }
      } catch {
        validationErrors.push("Invalid webhook URL format");
      }
    }

    if (enabled_events !== undefined) {
      if (!Array.isArray(enabled_events) || enabled_events.length === 0) {
        validationErrors.push("At least one event type must be selected");
      } else {
        const invalidEvents = enabled_events.filter((e) => !VALID_EVENTS.includes(e));
        if (invalidEvents.length > 0) {
          validationErrors.push(`Invalid events: ${invalidEvents.join(", ")}`);
        }
      }
    }

    // Webhook ID change requires confirmation
    if (webhook_id !== undefined && webhook_id !== ttnConfig.ttn_webhook_id && !confirm_id_change) {
      validationErrors.push("Changing webhook ID requires explicit confirmation");
    }

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: {
            code: "VALIDATION_FAILED",
            message: validationErrors.join("; "),
            hint: "Fix the validation errors and try again",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare changes
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
    const newUrl = webhook_url ?? ttnConfig.ttn_webhook_url;
    const newEvents = enabled_events ?? ttnConfig.ttn_webhook_events ?? ["uplink_message", "join_accept"];
    const newWebhookId = webhook_id ?? ttnConfig.ttn_webhook_id;

    if (webhook_url !== undefined && webhook_url !== ttnConfig.ttn_webhook_url) {
      changes.push({ field: "webhook_url", from: ttnConfig.ttn_webhook_url, to: webhook_url });
    }
    if (enabled_events !== undefined && JSON.stringify(enabled_events) !== JSON.stringify(ttnConfig.ttn_webhook_events)) {
      changes.push({ field: "enabled_events", from: ttnConfig.ttn_webhook_events, to: enabled_events });
    }
    if (webhook_id !== undefined && webhook_id !== ttnConfig.ttn_webhook_id) {
      changes.push({ field: "webhook_id", from: ttnConfig.ttn_webhook_id, to: webhook_id });
    }

    if (changes.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          request_id: requestId,
          synced_to_ttn: false,
          updated: {
            webhook_url: newUrl,
            webhook_id: newWebhookId,
            enabled_events: newEvents,
            secret_last4: ttnConfig.ttn_webhook_secret_last4 || "****",
          },
          changes: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NAM1-ONLY: Always use nam1 regardless of stored value
    const ttnCluster = "nam1";
    const applicationId = ttnConfig.ttn_application_id;

    if (!applicationId) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: "NO_APPLICATION_ID", message: "TTN application ID not configured", hint: "Complete TTN setup first" },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode API key
    const salt = organization_id.replace(/-/g, "").substring(0, 16);
    let apiKey: string;
    try {
      const decoded = atob(ttnConfig.ttn_api_key_encrypted);
      apiKey = decoded
        .split("")
        .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ salt.charCodeAt(i % salt.length)))
        .join("");
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: "KEY_DECODE_FAILED", message: "Failed to decode API key", hint: "Re-enter your TTN API key" },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build webhook payload for TTN
    const ttnWebhookPayload: Record<string, unknown> = {
      ids: {
        webhook_id: newWebhookId,
        application_ids: { application_id: applicationId },
      },
      base_url: newUrl,
      format: "json",
      uplink_message: newEvents.includes("uplink_message") ? {} : undefined,
      join_accept: newEvents.includes("join_accept") ? {} : undefined,
      downlink_ack: newEvents.includes("downlink_ack") ? {} : undefined,
      downlink_nack: newEvents.includes("downlink_nack") ? {} : undefined,
      downlink_sent: newEvents.includes("downlink_sent") ? {} : undefined,
      downlink_failed: newEvents.includes("downlink_failed") ? {} : undefined,
      downlink_queued: newEvents.includes("downlink_queued") ? {} : undefined,
      location_solved: newEvents.includes("location_solved") ? {} : undefined,
      service_data: newEvents.includes("service_data") ? {} : undefined,
    };

    // Remove undefined event fields
    Object.keys(ttnWebhookPayload).forEach((key) => {
      if (ttnWebhookPayload[key] === undefined) {
        delete ttnWebhookPayload[key];
      }
    });

    // NAM1-ONLY: All TTN API calls target NAM1 (imported from ttnBase.ts)
    const ttnEndpoint = `${CLUSTER_BASE_URL}/api/v3/as/webhooks/${applicationId}/${newWebhookId}`;
    
    // HARD GUARD: Verify cluster host
    assertClusterHost(ttnEndpoint);

    log("info", "Updating webhook in TTN", { endpoint: ttnEndpoint, changes });

    const ttnResponse = await fetch(ttnEndpoint, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ webhook: ttnWebhookPayload }),
    });

    if (!ttnResponse.ok) {
      const errorBody = await ttnResponse.text();
      log("error", "TTN webhook update failed", {
        status: ttnResponse.status,
        error: errorBody,
        requestId,
      });

      let errorCode = "TTN_UPDATE_FAILED";
      let errorMessage = "Failed to update webhook in TTN";
      let hint = "Check your API key permissions";

      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.code === 7 || parsed.message?.includes("permission")) {
          errorCode = "TTN_PERMISSION_DENIED";
          errorMessage = "Insufficient permissions to update webhook";
          hint = "Ensure your API key has webhook:write permission";
        } else if (parsed.code === 5 || parsed.message?.includes("not found")) {
          errorCode = "TTN_WEBHOOK_NOT_FOUND";
          errorMessage = "Webhook not found in TTN";
          hint = "The webhook may have been deleted in TTN Console";
        }
      } catch {
        // Keep default error
      }

      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          synced_to_ttn: false,
          error: { code: errorCode, message: errorMessage, hint },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("info", "TTN webhook updated successfully", { requestId });

    // Update FrostGuard database
    const updateData: Record<string, unknown> = {
      ttn_webhook_url: newUrl,
      ttn_webhook_id: newWebhookId,
      ttn_webhook_events: newEvents,
      ttn_webhook_last_updated_at: new Date().toISOString(),
      ttn_webhook_last_updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await adminClient
      .from("ttn_connections")
      .update(updateData)
      .eq("organization_id", organization_id);

    if (updateError) {
      log("error", "Failed to update FrostGuard database", { error: updateError.message, requestId });
      // TTN was updated but local failed - still report partial success
      return new Response(
        JSON.stringify({
          ok: true,
          request_id: requestId,
          synced_to_ttn: true,
          updated: {
            webhook_url: newUrl,
            webhook_id: newWebhookId,
            enabled_events: newEvents,
            secret_last4: ttnConfig.ttn_webhook_secret_last4 || "****",
          },
          changes,
          error: {
            code: "LOCAL_UPDATE_FAILED",
            message: "TTN updated but local database update failed",
            hint: "Refresh the page to sync",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log to event_logs for audit trail
    await adminClient.from("event_logs").insert({
      organization_id,
      event_type: "ttn.webhook.updated",
      category: "settings",
      severity: "info",
      title: "TTN Webhook Configuration Updated",
      actor_id: user.id,
      event_data: {
        changes,
        request_id: requestId,
        synced_to_ttn: true,
      },
    });

    // Mark org as dirty for emulator sync
    await adminClient
      .from("org_sync_state")
      .upsert({
        organization_id,
        is_dirty: true,
        last_change_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });

    log("info", "Webhook update complete", { organization_id, changes, requestId });

    const response: UpdateWebhookResponse = {
      ok: true,
      request_id: requestId,
      synced_to_ttn: true,
      updated: {
        webhook_url: newUrl,
        webhook_id: newWebhookId,
        enabled_events: newEvents,
        secret_last4: ttnConfig.ttn_webhook_secret_last4 || "****",
      },
      changes,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", "Unexpected error", { error: (err as Error).message, requestId });
    return new Response(
      JSON.stringify({
        ok: false,
        request_id: requestId,
        synced_to_ttn: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          hint: "Try again or contact support",
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
