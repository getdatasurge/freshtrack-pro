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

const FUNCTION_VERSION = "ttn-send-downlink-v1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Hex helpers (same as client-side lib/downlinkCommands.ts)
// ---------------------------------------------------------------------------

function hexToBase64(hex: string): string {
  const clean = hex.replace(/\s+/g, "").replace(/0x/gi, "");
  const bytes = new Uint8Array(
    clean.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  return btoa(String.fromCharCode(...bytes));
}

function toHex(value: number, byteCount: number): string {
  return value.toString(16).toUpperCase().padStart(byteCount * 2, "0");
}

function toInt16Hex(value: number): string {
  if (value < 0) value = 0x10000 + value;
  return toHex(value & 0xffff, 2);
}

// ---------------------------------------------------------------------------
// Command builders (server-side duplicate - authoritative source of truth)
// ---------------------------------------------------------------------------

function cmdSetIntervalSeconds(seconds: number): string {
  if (seconds < 1 || seconds > 0xffffff)
    throw new Error(`Interval must be 1..16777215, got ${seconds}`);
  return "01" + toHex(seconds, 3);
}

function cmdSetExtMode(mode: string): string {
  const map: Record<string, string> = { e3_ext1: "A201", e3_ext9: "A209" };
  const hex = map[mode];
  if (!hex) throw new Error(`Unsupported ext mode: ${mode}`);
  return hex;
}

function cmdSetTime(unixTs: number): string {
  if (unixTs < 0 || unixTs > 0xffffffff)
    throw new Error(`Unix timestamp out of range`);
  return "30" + toHex(unixTs, 4) + "00";
}

function cmdSyncMod(enable: boolean): string {
  return enable ? "2801" : "2800";
}

function cmdSyncTdcDays(days: number): string {
  if (days < 0 || days > 255) throw new Error(`Days must be 0..255`);
  return "29" + toHex(days, 1);
}

function cmdClearDatalog(): string {
  return "A301";
}

function cmdPnackmd(enable: boolean): string {
  return enable ? "3401" : "3400";
}

function cmdAlarm(
  enable: boolean,
  checkMinutes: number,
  lowC: number,
  highC: number
): string {
  if (checkMinutes < 1 || checkMinutes > 0xffff)
    throw new Error(`check_minutes must be 1..65535`);
  const lowX100 = Math.round(lowC * 100);
  const highX100 = Math.round(highC * 100);
  if (highX100 <= lowX100) throw new Error(`high must be > low`);
  if (
    lowX100 < -32768 ||
    lowX100 > 32767 ||
    highX100 < -32768 ||
    highX100 > 32767
  )
    throw new Error("Temperature out of int16 range");
  const wmod = enable ? "01" : "00";
  return (
    "AA" +
    wmod +
    toHex(checkMinutes, 2) +
    toInt16Hex(lowX100) +
    toInt16Hex(highX100)
  );
}

// ---------------------------------------------------------------------------
// Build command from params
// ---------------------------------------------------------------------------

interface BuiltCommand {
  hex: string;
  fport: number;
  changeType: string;
  expectedResult: string;
}

function buildCommand(params: any, defaultFport: number = 2): BuiltCommand {
  switch (params.type) {
    case "uplink_interval":
      return {
        hex: cmdSetIntervalSeconds(params.seconds),
        fport: defaultFport,
        changeType: "uplink_interval",
        expectedResult: `Uplink interval → ${params.seconds}s`,
      };
    case "ext_mode":
      return {
        hex: cmdSetExtMode(params.mode),
        fport: defaultFport,
        changeType: "ext_mode",
        expectedResult: `External mode → ${params.mode}`,
      };
    case "time_sync":
      return {
        hex: cmdSyncMod(params.enable),
        fport: defaultFport,
        changeType: "time_sync",
        expectedResult: `Time sync → ${params.enable ? "on" : "off"}`,
      };
    case "time_sync_days":
      return {
        hex: cmdSyncTdcDays(params.days),
        fport: defaultFport,
        changeType: "time_sync",
        expectedResult: `Sync interval → ${params.days} days`,
      };
    case "set_time":
      return {
        hex: cmdSetTime(params.unix_ts),
        fport: defaultFport,
        changeType: "set_time",
        expectedResult: `Device time set`,
      };
    case "alarm":
      return {
        hex: cmdAlarm(
          params.enable,
          params.check_minutes,
          params.low_c,
          params.high_c
        ),
        fport: defaultFport,
        changeType: "alarm",
        expectedResult: params.enable
          ? `Alarm: ${params.low_c}°C–${params.high_c}°C every ${params.check_minutes}min`
          : "Alarm disabled",
      };
    case "clear_datalog":
      return {
        hex: cmdClearDatalog(),
        fport: defaultFport,
        changeType: "clear_datalog",
        expectedResult: "Datalog cleared",
      };
    case "pnackmd":
      return {
        hex: cmdPnackmd(params.enable),
        fport: defaultFport,
        changeType: "pnackmd",
        expectedResult: `PNACKMD → ${params.enable ? "on" : "off"}`,
      };
    case "raw":
      return {
        hex: params.hex.replace(/\s+/g, "").toUpperCase(),
        fport: params.fport ?? defaultFport,
        changeType: "raw",
        expectedResult: `Raw: ${params.hex}`,
      };
    default:
      throw new Error(`Unknown command type: ${params.type}`);
  }
}

// ---------------------------------------------------------------------------
// TTN API call: REPLACE downlink queue (always unconfirmed)
// ---------------------------------------------------------------------------

async function sendTtnDownlink(
  baseUrl: string,
  appId: string,
  deviceId: string,
  apiKey: string,
  fport: number,
  hexPayload: string
): Promise<{ ok: boolean; status: number; body: any }> {
  const url = `${baseUrl}/api/v3/as/applications/${appId}/devices/${deviceId}/down/replace`;
  const frmPayload = hexToBase64(hexPayload);

  const body = {
    downlinks: [
      {
        f_port: fport,
        frm_payload: frmPayload,
        confirmed: false, // ALWAYS false - non-negotiable
        priority: "NORMAL",
      },
    ],
  };

  console.log(`[TTN] POST ${url} fport=${fport} hex=${hexPayload}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `FrostGuard/${FUNCTION_VERSION}`,
    },
    body: JSON.stringify(body),
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

  return { ok: resp.ok, status: resp.status, body: respBody };
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
        },
        requested_by: user.id,
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
      return new Response(
        JSON.stringify({
          ok: false,
          error: `TTN downlink failed: HTTP ${ttnResult.status}`,
          pending_change_id: pendingChange?.id,
          debug: {
            ttn_status: ttnResult.status,
            ttn_body: ttnResult.body,
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
