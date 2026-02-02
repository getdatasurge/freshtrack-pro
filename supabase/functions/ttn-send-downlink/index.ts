/**
 * TTN Send Downlink Edge Function
 *
 * Sends a single downlink command to a sensor via TTN.
 *
 * Non-negotiable rules:
 *  - confirmed: ALWAYS false
 *  - operation: ALWAYS REPLACE (wipe queue, insert one downlink)
 *  - one change = one downlink
 *
 * Flow:
 *  1. Validate request (sensor_id, command_type, command_params)
 *  2. Load sensor + org TTN credentials from DB
 *  3. Build hex payload using command builders
 *  4. Send REPLACE downlink to TTN
 *  5. Write pending_change record
 *  6. Return pending_change_id
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hexToBase64,
  buildCommand,
  type BuiltCommand,
} from "../_shared/downlinkCommands.ts";

const FUNCTION_VERSION = "ttn-send-downlink-v1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// TTN API call: REPLACE downlink queue (always unconfirmed)
// ---------------------------------------------------------------------------

/**
 * Send downlink to TTN with retry logic for transient network errors.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 * Only retries on network errors or 5xx responses, not 4xx client errors.
 */
async function sendTtnDownlink(
  baseUrl: string,
  appId: string,
  deviceId: string,
  apiKey: string,
  fport: number,
  hexPayload: string
): Promise<{ ok: boolean; status: number; body: any; attempts: number }> {
  const url = `${baseUrl}/api/v3/as/applications/${appId}/devices/${deviceId}/down/replace`;
  const frmPayload = hexToBase64(hexPayload);

  const reqBody = {
    downlinks: [
      {
        f_port: fport,
        frm_payload: frmPayload,
        confirmed: false, // ALWAYS false - non-negotiable
        priority: "NORMAL",
      },
    ],
  };

  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[TTN] POST ${url} fport=${fport} hex=${hexPayload} (attempt ${attempt}/${maxAttempts})`
      );

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": `FrostGuard/${FUNCTION_VERSION}`,
        },
        body: JSON.stringify(reqBody),
      });

      let respBody: any = null;
      try {
        respBody = await resp.json();
      } catch {
        try {
          respBody = await resp.text();
        } catch {
          /* empty */
        }
      }

      // Don't retry 4xx client errors (bad request, unauthorized, etc.)
      if (resp.status >= 400 && resp.status < 500) {
        return { ok: false, status: resp.status, body: respBody, attempts: attempt };
      }

      // Success or non-retryable response
      if (resp.ok) {
        return { ok: true, status: resp.status, body: respBody, attempts: attempt };
      }

      // 5xx: retry if we have attempts left
      console.warn(
        `[TTN] Attempt ${attempt} failed with status ${resp.status}, ${
          attempt < maxAttempts ? "retrying..." : "giving up"
        }`
      );
      lastError = { status: resp.status, body: respBody };
    } catch (fetchErr) {
      // Network error (DNS, timeout, connection refused)
      console.warn(
        `[TTN] Attempt ${attempt} network error: ${fetchErr}, ${
          attempt < maxAttempts ? "retrying..." : "giving up"
        }`
      );
      lastError = fetchErr;
    }

    // Exponential backoff before retry: 1s, 2s, 4s
    if (attempt < maxAttempts) {
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // All retries exhausted
  const errBody =
    lastError && typeof lastError === "object" && "body" in lastError
      ? (lastError as any).body
      : String(lastError);
  const errStatus =
    lastError && typeof lastError === "object" && "status" in lastError
      ? (lastError as any).status
      : 0;
  return { ok: false, status: errStatus, body: errBody, attempts: maxAttempts };
}

// ---------------------------------------------------------------------------
// TTN error translation: map HTTP statuses to user-friendly messages
// ---------------------------------------------------------------------------

function translateTtnError(status: number, body: any): string {
  // Try to extract TTN's own error message
  const ttnMsg =
    body?.message || body?.error?.message || body?.error || "";

  switch (status) {
    case 401:
    case 403:
      return "TTN credentials are invalid or expired. Ask your admin to update the API key in Settings → Integrations.";
    case 404:
      return "Sensor not found in the TTN application. Verify the device ID matches TTN.";
    case 409:
      return "Conflict: another downlink is already queued for this device. Wait for it to be sent, then retry.";
    case 429:
      return "Too many requests to TTN. Wait a moment and try again.";
    default:
      if (status >= 500) {
        return `TTN server error (HTTP ${status}). The Things Network may be experiencing issues — try again later.`;
      }
      if (status === 0) {
        return "Could not reach TTN servers. Check network connectivity.";
      }
      return ttnMsg
        ? `TTN error (HTTP ${status}): ${ttnMsg}`
        : `TTN downlink failed with HTTP ${status}`;
  }
}

// ---------------------------------------------------------------------------
// Decrypt TTN API key from ttn_connections
// ---------------------------------------------------------------------------

function deobfuscateKey(encrypted: string, salt: string): string {
  const decoded = atob(encrypted);
  const result: string[] = [];
  for (let i = 0; i < decoded.length; i++) {
    result.push(
      String.fromCharCode(
        decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
      )
    );
  }
  return result.join("");
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "ttn-send-downlink",
        version: FUNCTION_VERSION,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSalt =
      Deno.env.get("TTN_ENCRYPTION_SALT") || serviceRoleKey.slice(0, 32);

    // Get the calling user's JWT from the Authorization header
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Service-role client for DB operations
    const db = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const body = await req.json();
    const { sensor_id, command_type, command_params } = body;

    if (!sensor_id || !command_type || !command_params) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing sensor_id, command_type, or command_params",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -----------------------------------------------------------------------
    // 1. Load sensor
    // -----------------------------------------------------------------------
    const { data: sensor, error: sensorErr } = await db
      .from("lora_sensors")
      .select("*")
      .eq("id", sensor_id)
      .is("deleted_at", null)
      .single();

    if (sensorErr || !sensor) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sensor not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user belongs to this org
    const { data: membership } = await db
      .from("organization_members")
      .select("id")
      .eq("organization_id", sensor.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not authorized for this sensor" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Load TTN credentials
    // -----------------------------------------------------------------------
    const { data: ttnConn, error: ttnErr } = await db
      .from("ttn_connections")
      .select("*")
      .eq("organization_id", sensor.organization_id)
      .maybeSingle();

    if (ttnErr || !ttnConn || !ttnConn.ttn_api_key_encrypted) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "TTN not configured for this organization",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const ttnApiKey = deobfuscateKey(
      ttnConn.ttn_api_key_encrypted,
      encryptionSalt
    );
    const ttnAppId =
      sensor.ttn_application_id || ttnConn.ttn_application_id;
    const ttnDeviceId = sensor.ttn_device_id || sensor.name;
    const ttnRegion = ttnConn.ttn_region || "nam1";
    const ttnBaseUrl = `https://${ttnRegion}.cloud.thethings.network`;

    if (!ttnAppId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "TTN application ID not found for sensor",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -----------------------------------------------------------------------
    // 3. Load sensor config for fport
    // -----------------------------------------------------------------------
    const { data: sensorConfig } = await db
      .from("sensor_configurations")
      .select("default_fport")
      .eq("sensor_id", sensor_id)
      .maybeSingle();

    const defaultFport = sensorConfig?.default_fport ?? 2;

    // -----------------------------------------------------------------------
    // 4. Build command
    // -----------------------------------------------------------------------
    let built: BuiltCommand;
    try {
      built = buildCommand(command_params, defaultFport);
    } catch (buildErr: any) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Invalid command: ${buildErr.message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -----------------------------------------------------------------------
    // 5. Send downlink to TTN (REPLACE, unconfirmed)
    // -----------------------------------------------------------------------
    const ttnResult = await sendTtnDownlink(
      ttnBaseUrl,
      ttnAppId,
      ttnDeviceId,
      ttnApiKey,
      built.fport,
      built.hex
    );

    const changeStatus = ttnResult.ok ? "sent" : "failed";

    // -----------------------------------------------------------------------
    // 6. Write pending_change record
    // -----------------------------------------------------------------------
    const userEmail = user.email ?? null;

    const { data: pendingChange, error: insertErr } = await db
      .from("sensor_pending_changes")
      .insert({
        sensor_id,
        organization_id: sensor.organization_id,
        change_type: built.changeType,
        requested_payload_hex: built.hex,
        requested_fport: built.fport,
        status: changeStatus,
        sent_at: ttnResult.ok ? new Date().toISOString() : null,
        failed_at: !ttnResult.ok ? new Date().toISOString() : null,
        command_params,
        expected_result: built.expectedResult,
        debug_response: {
          ttn_status: ttnResult.status,
          ttn_body: ttnResult.body,
          ttn_url: `${ttnBaseUrl}/api/v3/as/applications/${ttnAppId}/devices/${ttnDeviceId}/down/replace`,
          hex: built.hex,
          b64: hexToBase64(built.hex),
          attempts: ttnResult.attempts,
        },
        requested_by: user.id,
        requested_by_email: userEmail,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[DB] Failed to insert pending_change:", insertErr);
    }

    // -----------------------------------------------------------------------
    // 7. Update sensor config last_applied_at & pending_change_id
    // -----------------------------------------------------------------------
    if (ttnResult.ok && pendingChange) {
      await db
        .from("sensor_configurations")
        .upsert(
          {
            sensor_id,
            organization_id: sensor.organization_id,
            pending_change_id: pendingChange.id,
            last_applied_at: new Date().toISOString(),
          },
          { onConflict: "sensor_id" }
        );
    }

    // -----------------------------------------------------------------------
    // 8. Return result
    // -----------------------------------------------------------------------
    if (!ttnResult.ok) {
      const friendlyError = translateTtnError(ttnResult.status, ttnResult.body);
      return new Response(
        JSON.stringify({
          ok: false,
          error: friendlyError,
          pending_change_id: pendingChange?.id,
          debug: {
            ttn_status: ttnResult.status,
            ttn_body: ttnResult.body,
            attempts: ttnResult.attempts,
          },
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        pending_change_id: pendingChange?.id,
        hex_payload: built.hex,
        expected_result: built.expectedResult,
        message:
          "Downlink queued. Device will receive it after next uplink (Class A).",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[Handler] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Internal error",
        version: FUNCTION_VERSION,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
