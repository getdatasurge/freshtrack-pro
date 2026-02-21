/**
 * TTN Webhook Edge Function
 * 
 * Receives uplink messages from The Things Network and inserts sensor data.
 * 
 * SECURITY (Per-Organization Model):
 * - Validates X-Webhook-Secret header against per-org secrets in ttn_connections
 * - Each org has its own unique webhook secret
 * - Org lookup via webhook secret provides tenant isolation
 * - Device lookup also verifies org ownership
 * - Returns 401 for invalid/missing secret
 * 
 * Device Matching Order:
 * 1. lora_sensors.ttn_device_id === end_device_ids.device_id
 * 2. lora_sensors.dev_eui IN (normalized variants: lower, upper, colon-upper, colon-lower)
 * 3. Legacy devices table fallback
 * 4. Return 202 for unknown devices (never 404 to prevent TTN retries)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeDevEui, formatDevEuiForDisplay, lookupOrgByWebhookSecret } from "../_shared/ttnConfig.ts";
import { inferSensorTypeFromPayload, inferModelFromPayload, extractModelFromUnitId } from "../_shared/payloadRegistry.ts";
import { normalizeDoorData, getDoorFieldSource, normalizeTelemetry, convertVoltageToPercent } from "../_shared/payloadNormalization.ts";
import { parseLHT65NUplink, matchChangeToUplink } from "../_shared/uplinkParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-downlink-apikey, x-webhook-secret',
};

interface TTNUplinkMessage {
  end_device_ids: {
    device_id: string;
    application_ids: { application_id: string };
    dev_eui: string;
    join_eui?: string;
  };
  correlation_ids?: string[];
  received_at: string;
  uplink_message?: {
    session_key_id?: string;
    f_port?: number;
    f_cnt?: number;
    frm_payload?: string;
    decoded_payload?: {
      temperature?: number;
      temperature_scale?: number;
      humidity?: number;
      battery?: number;
      battery_level?: number;
      door_open?: boolean;
      [key: string]: unknown;
    };
    rx_metadata?: Array<{
      gateway_ids?: { gateway_id: string };
      rssi?: number;
      snr?: number;
      channel_rssi?: number;
    }>;
    settings?: {
      data_rate?: { lora?: { bandwidth: number; spreading_factor: number } };
      frequency?: string;
    };
    received_at: string;
  };
}

interface LoraSensor {
  id: string;
  organization_id: string;
  site_id: string | null;
  unit_id: string | null;
  dev_eui: string;
  status: string;
  ttn_application_id: string | null;
  sensor_type: string;
  name: string;
  is_primary: boolean;
  model: string | null;
  // These fields require migrations — may be undefined if not yet applied
  sensor_catalog_id?: string | null;
  decode_mode_override?: string | null;
}

interface LegacyDevice {
  id: string;
  unit_id: string | null;
  status: string;
  organization_id: string | null;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * In-memory cache for catalog decoder lookups.
 * Persists across requests within the same Deno isolate.
 * TTL keeps entries fresh when catalog revisions change.
 */
interface CachedDecoder {
  decoder_js: string | null;
  revision: number;
  decode_mode: string;
  temperature_unit: string; // 'C' or 'F'
  battery_chemistry: string | null; // from battery_info.chemistry
  cachedAt: number;
}
const decoderCache = new Map<string, CachedDecoder>();
const DECODER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Decoder execution guardrails
const MAX_DECODER_JS_BYTES = 50_000; // 50 KB — reject oversized decoders
const MAX_OUTPUT_JSON_BYTES = 50_000; // 50 KB — truncate oversized output

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCatalogDecoder(supabase: any, catalogId: string): Promise<CachedDecoder | null> {
  const now = Date.now();
  const cached = decoderCache.get(catalogId);
  if (cached && (now - cached.cachedAt) < DECODER_CACHE_TTL_MS) {
    return cached;
  }
  const { data } = await supabase
    .from('sensor_catalog')
    .select('decoder_js, revision, decode_mode, temperature_unit, battery_info')
    .eq('id', catalogId)
    .maybeSingle();
  if (!data) return null;
  // Extract battery chemistry from battery_info JSONB
  const batteryInfo = data.battery_info as Record<string, unknown> | null;
  const entry: CachedDecoder = {
    decoder_js: data.decoder_js,
    revision: data.revision,
    decode_mode: data.decode_mode ?? 'trust',
    temperature_unit: data.temperature_unit ?? 'C',
    battery_chemistry: (batteryInfo?.chemistry as string) ?? null,
    cachedAt: now,
  };
  decoderCache.set(catalogId, entry);
  // Evict stale entries periodically (keep cache bounded)
  if (decoderCache.size > 100) {
    for (const [key, val] of decoderCache) {
      if (now - val.cachedAt > DECODER_CACHE_TTL_MS) decoderCache.delete(key);
    }
  }
  return entry;
}

/**
 * Deep-compare two decoded payloads with numeric tolerance.
 * Returns { match, diffKeys } where diffKeys lists which top-level keys differ.
 *
 * - Numbers within 0.01 absolute tolerance are considered equal
 *   (handles float drift between runtimes, e.g. 3.0500000000000003 vs 3.05)
 * - Booleans, strings compared strictly
 * - Nested objects/arrays compared via JSON.stringify
 * - Keys present in one but missing/undefined in the other count as a diff
 */
function deepComparePayloads(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): { match: boolean; diffKeys: string[] } {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffKeys: string[] = [];
  const TOLERANCE = 0.01;

  for (const key of allKeys) {
    const va = a[key];
    const vb = b[key];

    // Both undefined/missing → match
    if (va === undefined && vb === undefined) continue;

    // One missing → diff
    if (va === undefined || vb === undefined) {
      diffKeys.push(key);
      continue;
    }

    // Both numbers → tolerance comparison
    if (typeof va === 'number' && typeof vb === 'number') {
      if (Math.abs(va - vb) > TOLERANCE) {
        diffKeys.push(key);
      }
      continue;
    }

    // Same type, strict comparison for primitives
    if (typeof va === typeof vb && (typeof va === 'boolean' || typeof va === 'string')) {
      if (va !== vb) diffKeys.push(key);
      continue;
    }

    // Fallback: JSON stringify for objects/arrays/mixed types
    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diffKeys.push(key);
    }
  }

  return { match: diffKeys.length === 0, diffKeys };
}

Deno.serve(async (req) => {
  // Generate unique request ID for tracing
  const requestId = crypto.randomUUID().slice(0, 8);
  
  console.log(`[TTN-WEBHOOK] ========== REQUEST ${requestId} ==========`);
  console.log(`[TTN-WEBHOOK] ${requestId} | method: ${req.method}`);
  console.log(`[TTN-WEBHOOK] ${requestId} | X-Webhook-Secret present: ${req.headers.has('x-webhook-secret')}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET/HEAD probes (load balancers, TTN health checks)
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response(
      JSON.stringify({ ok: true, service: 'ttn-webhook', timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only process POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: true, message: 'Method accepted but not processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[TTN-WEBHOOK] ${requestId} | Missing Supabase environment variables`);
    return new Response(
      JSON.stringify({ accepted: true, processed: false, error: 'Server configuration error' }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ========================================
  // SECURITY: Authenticate via per-org webhook secret
  // ========================================
  const providedSecretFromHeader = req.headers.get('x-webhook-secret');
  const providedSecretFromApikey = req.headers.get('x-downlink-apikey');
  const providedSecret = providedSecretFromHeader || providedSecretFromApikey || '';
  
  console.log(`[TTN-WEBHOOK] ${requestId} | Secret source: ${providedSecretFromHeader ? 'X-Webhook-Secret' : providedSecretFromApikey ? 'X-Downlink-Apikey' : 'NONE'}`);
  
  if (!providedSecret) {
    console.warn(`[TTN-WEBHOOK] ${requestId} | No webhook secret provided`);
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Missing webhook secret' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Look up organization by webhook secret
  const orgLookup = await lookupOrgByWebhookSecret(supabase, providedSecret);
  
  if (!orgLookup) {
    console.warn(`[TTN-WEBHOOK] ${requestId} | Invalid webhook secret - no matching org found`);
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Invalid webhook secret' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authenticatedOrgId = orgLookup.organizationId;
  const authenticatedAppId = orgLookup.applicationId;
  console.log(`[TTN-WEBHOOK] ${requestId} | AUTH SUCCESS - Org: ${authenticatedOrgId}, App: ${authenticatedAppId}`);

  try {
    const payload = await req.json();
    
    // Handle non-uplink events
    if (!payload.uplink_message) {
      const eventType = payload.join_accept ? 'join_accept' : 
                        payload.downlink_ack ? 'downlink_ack' :
                        payload.downlink_nack ? 'downlink_nack' :
                        'unknown';
      
      console.log(`[TTN-WEBHOOK] ${requestId} | Non-uplink event: ${eventType}, org: ${authenticatedOrgId}`);
      return new Response(
        JSON.stringify({ accepted: true, processed: false, event_type: eventType }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ttnPayload = payload as TTNUplinkMessage;
    
    // Extract uplink data
    const deviceId = ttnPayload.end_device_ids?.device_id || '';
    const rawDevEui = ttnPayload.end_device_ids?.dev_eui || '';
    const applicationId = ttnPayload.end_device_ids?.application_ids?.application_id || '';
    const decoded = ttnPayload.uplink_message?.decoded_payload || {};
    const rxMeta = ttnPayload.uplink_message?.rx_metadata?.[0];
    const rssi = rxMeta?.rssi ?? rxMeta?.channel_rssi;
    const receivedAt = ttnPayload.uplink_message?.received_at || ttnPayload.received_at || new Date().toISOString();

    // Extract raw payload for storage (decoder independence)
    const frmPayloadBase64 = ttnPayload.uplink_message?.frm_payload || null;
    const fPort = ttnPayload.uplink_message?.f_port ?? null;
    let rawPayloadHex: string | null = null;
    let frmPayloadBytes: number[] | null = null;
    if (frmPayloadBase64) {
      try {
        const raw = Uint8Array.from(atob(frmPayloadBase64), c => c.charCodeAt(0));
        frmPayloadBytes = Array.from(raw);
        rawPayloadHex = frmPayloadBytes.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        console.warn(`[TTN-WEBHOOK] ${requestId} | Failed to decode frm_payload base64: ${e}`);
      }
    }

    console.log(`[TTN-WEBHOOK] ${requestId} | Uplink: device=${deviceId}, dev_eui=${rawDevEui}, app=${applicationId}`);

    // Validate that the uplink comes from the expected TTN application
    if (authenticatedAppId && applicationId !== authenticatedAppId) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Application ID mismatch! Expected: ${authenticatedAppId}, Got: ${applicationId}`);
      // Log but still process - the webhook secret was valid
    }

    // Normalize DevEUI if present (may be absent for emulated uplinks)
    let devEuiLower = '';
    let devEuiUpper = '';
    let devEuiColonUpper = '';
    let devEuiColonLower = '';
    const normalizedDevEui = rawDevEui ? normalizeDevEui(rawDevEui) : '';
    if (!rawDevEui) {
      console.log(`[TTN-WEBHOOK] ${requestId} | No dev_eui in uplink, using ttn_device_id fallback`);
    } else if (!normalizedDevEui) {
      return new Response(
        JSON.stringify({ accepted: true, processed: false, reason: 'Invalid dev_eui format' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Generate match variants
      devEuiLower = normalizedDevEui;
      devEuiUpper = normalizedDevEui.toUpperCase();
      devEuiColonUpper = formatDevEuiForDisplay(normalizedDevEui);
      devEuiColonLower = devEuiColonUpper.toLowerCase();
    }

    // ========================================
    // LOOKUP: Find sensor in authenticated org only
    // ========================================
    let loraSensor: LoraSensor | null = null;

    // Try by ttn_device_id first
    // Use select('*') so the query works whether or not catalog/decode migrations have been applied
    if (deviceId) {
      const { data: sensorByDeviceId } = await supabase
        .from('lora_sensors')
        .select('*')
        .eq('ttn_device_id', deviceId)
        .eq('organization_id', authenticatedOrgId)  // CRITICAL: Scope to authenticated org
        .maybeSingle();

      if (sensorByDeviceId) {
        console.log(`[TTN-WEBHOOK] ${requestId} | Found sensor by ttn_device_id: ${sensorByDeviceId.name}`);
        loraSensor = sensorByDeviceId;
      }
    }

    // Fallback to dev_eui (only when dev_eui is available)
    if (!loraSensor && normalizedDevEui) {
      const { data: sensorByDevEui } = await supabase
        .from('lora_sensors')
        .select('*')
        .or(`dev_eui.eq.${devEuiLower},dev_eui.eq.${devEuiUpper},dev_eui.eq.${devEuiColonUpper},dev_eui.eq.${devEuiColonLower}`)
        .eq('organization_id', authenticatedOrgId)  // CRITICAL: Scope to authenticated org
        .maybeSingle();

      if (sensorByDevEui) {
        console.log(`[TTN-WEBHOOK] ${requestId} | Found sensor by dev_eui: ${sensorByDevEui.name}`);
        loraSensor = sensorByDevEui;
      }
    }

    // Process lora sensor
    if (loraSensor) {
      return await handleLoraSensor(supabase, loraSensor, {
        devEui: devEuiLower,
        deviceId,
        applicationId,
        decoded,
        rssi,
        receivedAt,
        requestId,
        frmPayloadBase64,
        fPort,
        rawPayloadHex,
        frmPayloadBytes,
      });
    }

    // Legacy fallback - also scope to org if possible (only when dev_eui is available)
    if (normalizedDevEui) {
      const { data: device } = await supabase
        .from('devices')
        .select('id, unit_id, status, organization_id')
        .or(`serial_number.eq.${devEuiLower},serial_number.eq.${devEuiUpper},serial_number.eq.${devEuiColonUpper},serial_number.eq.${devEuiColonLower}`)
        .eq('organization_id', authenticatedOrgId)
        .maybeSingle();

      if (device) {
        return await handleLegacyDevice(supabase, device, {
          devEui: devEuiLower,
          deviceId,
          decoded,
          rssi,
          receivedAt,
          requestId,
          frmPayloadBase64,
          fPort,
          rawPayloadHex,
        });
      }
    }

    // Unknown device
    console.warn(`[TTN-WEBHOOK] ${requestId} | Unknown device for org ${authenticatedOrgId}: ${devEuiLower || deviceId}`);
    return new Response(
      JSON.stringify({
        accepted: true,
        processed: false,
        reason: 'Unknown device - not registered for this organization',
        dev_eui: devEuiLower || null,
        device_id: deviceId || null,
        organization_id: authenticatedOrgId,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error(`[TTN-WEBHOOK] ${requestId} | Error:`, error);
    return new Response(
      JSON.stringify({ accepted: true, processed: false, error: 'Processing error' }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle uplink from a LoRa sensor
 */
async function handleLoraSensor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sensor: LoraSensor,
  data: {
    devEui: string;
    deviceId: string;
    applicationId: string;
    decoded: Record<string, unknown>;
    rssi: number | undefined;
    receivedAt: string;
    requestId: string;
    frmPayloadBase64: string | null;
    fPort: number | null;
    rawPayloadHex: string | null;
    frmPayloadBytes: number[] | null;
  }
): Promise<Response> {
  const { devEui, rssi, receivedAt, requestId, frmPayloadBase64, fPort, rawPayloadHex, frmPayloadBytes } = data;

  // Normalize vendor-specific keys (e.g. Dragino TempC_SHT → temperature)
  // NOTE: initial normalize without chemistry; re-normalized after catalog lookup if chemistry is found
  let decoded = normalizeTelemetry(data.decoded);
  const networkHadData = Object.keys(data.decoded).length > 0;

  // ========================================
  // APP-SIDE DECODING: Run catalog decoder BEFORE extracting fields.
  // When TTN's formatter is off/empty, the app decoder is the primary
  // data source. When in trust mode with TTN data, we compare both.
  // ========================================
  let appDecoded: Record<string, unknown> | null = null;
  let decoderIdStr: string | null = null;
  let decoderWarnings: unknown[] | null = null;
  let decoderErrors: unknown[] | null = null;
  let decodeMatch: boolean | null = null;
  let decodeMismatchReason: string | null = null;
  let effectiveMode = 'ttn';
  let sensorTempUnit = 'C'; // default: most LoRaWAN sensors report Celsius
  let batteryChemistry: string | null = null; // from sensor catalog battery_info

  console.log(`[TTN-WEBHOOK] ${requestId} | Catalog ID: ${sensor.sensor_catalog_id ?? 'NULL'}, raw payload: ${frmPayloadBase64 ? 'present' : 'MISSING'}, fPort: ${fPort ?? 'NULL'}`);

  if (sensor.sensor_catalog_id != null) {
    try {
      const catalogEntry = await getCatalogDecoder(supabase, sensor.sensor_catalog_id);
      console.log(`[TTN-WEBHOOK] ${requestId} | Catalog entry found: ${!!catalogEntry}, decoder_js: ${catalogEntry?.decoder_js ? `${catalogEntry.decoder_js.length} chars` : 'NULL'}, mode: ${catalogEntry?.decode_mode ?? 'N/A'}, chemistry: ${catalogEntry?.battery_chemistry ?? 'NULL'}`);
      if (catalogEntry) {
        sensorTempUnit = catalogEntry.temperature_unit;
        batteryChemistry = catalogEntry.battery_chemistry;
      }
      effectiveMode = sensor.decode_mode_override ?? catalogEntry?.decode_mode ?? 'trust';

      if ((effectiveMode === 'trust' || effectiveMode === 'app') && catalogEntry?.decoder_js && frmPayloadBytes && fPort != null) {
        // Guardrail: reject oversized decoder scripts
        if (catalogEntry.decoder_js.length > MAX_DECODER_JS_BYTES) {
          console.warn(`[TTN-WEBHOOK] ${requestId} | Decoder too large (${catalogEntry.decoder_js.length} bytes > ${MAX_DECODER_JS_BYTES}), skipping`);
          decodeMatch = false;
          decodeMismatchReason = `decode_error:decoder_js exceeds ${MAX_DECODER_JS_BYTES} byte limit`;
        } else {
          const decoderCode = `${catalogEntry.decoder_js}\nreturn decodeUplink(input);`;
          const decoderFn = new Function('input', decoderCode);
          const decoderResult = decoderFn({ bytes: frmPayloadBytes, fPort });

          // TTN device repo decoders return { data, warnings, errors }
          console.log(`[TTN-WEBHOOK] ${requestId} | Decoder executed. Raw result keys: ${Object.keys(decoderResult ?? {}).join(', ')}`);
          const rawAppDecoded = (decoderResult?.data ?? decoderResult) as Record<string, unknown>;
          console.log(`[TTN-WEBHOOK] ${requestId} | App-decoded fields: ${JSON.stringify(rawAppDecoded).slice(0, 500)}`);

          // Guardrail: cap output size to prevent DB bloat
          const outputJson = JSON.stringify(rawAppDecoded);
          if (outputJson.length > MAX_OUTPUT_JSON_BYTES) {
            console.warn(`[TTN-WEBHOOK] ${requestId} | Decoder output too large (${outputJson.length} bytes), storing truncated`);
            appDecoded = { _truncated: true, _size: outputJson.length } as Record<string, unknown>;
            decodeMatch = false;
            decodeMismatchReason = `decode_error:output exceeds ${MAX_OUTPUT_JSON_BYTES} byte limit`;
          } else {
            appDecoded = rawAppDecoded;
          }
          decoderIdStr = `catalog:${sensor.sensor_catalog_id}:rev${catalogEntry.revision}`;

          // Capture decoder warnings/errors if present
          if (Array.isArray(decoderResult?.warnings) && decoderResult.warnings.length > 0) {
            decoderWarnings = decoderResult.warnings;
          }
          if (Array.isArray(decoderResult?.errors) && decoderResult.errors.length > 0) {
            decoderErrors = decoderResult.errors;
          }

          // Compare against TTN decoded payload when both are available.
          // Apply normalizeTelemetry to both sides so vendor key aliases
          // (TempC_SHT→temperature, BatV→battery, etc.) don't cause false mismatches.
          if (appDecoded && !('_truncated' in appDecoded) && networkHadData) {
            const normalizedApp = normalizeTelemetry(appDecoded);
            const normalizedNet = normalizeTelemetry(data.decoded);
            const { match, diffKeys } = deepComparePayloads(normalizedApp, normalizedNet);
            decodeMatch = match;
            if (!match) {
              decodeMismatchReason = `key_diff:${diffKeys.join(',')}`;
              console.warn(`[TTN-WEBHOOK] ${requestId} | Decode mismatch [${effectiveMode}]: keys=${diffKeys.join(',')}`);
            } else {
              console.log(`[TTN-WEBHOOK] ${requestId} | Decode match [${effectiveMode}] (catalog rev${catalogEntry.revision})`);
            }
          }

          // When app decoder is authoritative (app mode) or TTN had no data,
          // use the app-decoded payload as the primary data source for readings.
          if (appDecoded && !('_truncated' in appDecoded)) {
            if (effectiveMode === 'app' || !networkHadData) {
              const reason = !networkHadData ? 'TTN decoded_payload empty' : 'app mode authoritative';
              console.log(`[TTN-WEBHOOK] ${requestId} | Using app-decoded payload (${reason})`);
              decoded = normalizeTelemetry(appDecoded, { chemistry: batteryChemistry });
              console.log(`[TTN-WEBHOOK] ${requestId} | After normalization: temperature=${decoded.temperature}, humidity=${decoded.humidity}, battery=${decoded.battery}`);
            }
          }
        }
      } else if (effectiveMode === 'ttn' || effectiveMode === 'off') {
        console.log(`[TTN-WEBHOOK] ${requestId} | Decode mode '${effectiveMode}' — skipping app decode`);
      }
    } catch (decodeErr: unknown) {
      const errMsg = decodeErr instanceof Error ? decodeErr.message : String(decodeErr);
      console.warn(`[TTN-WEBHOOK] ${requestId} | Server-side decode failed: ${errMsg}`);
      decodeMatch = false;
      decodeMismatchReason = `decode_error:${errMsg.slice(0, 200)}`;
    }
  }

  // Battery handling (after decode so app-decoded battery is available)
  const batteryVoltage = decoded.battery_voltage as number | undefined;

  // Recalculate battery percentage using chemistry-aware curves if we have
  // both a raw voltage and a chemistry identifier from the sensor catalog.
  // The initial normalizeTelemetry call may have used the legacy Dragino
  // formula (3.0–3.6V linear), which produces wildly wrong percentages
  // for other chemistries.
  let battery: number | undefined;
  if (batteryVoltage !== undefined && batteryChemistry) {
    battery = convertVoltageToPercent(batteryVoltage, batteryChemistry);
    console.log(`[TTN-WEBHOOK] ${requestId} | Battery: ${batteryVoltage}V → ${battery}% (chemistry: ${batteryChemistry})`);
  } else if (batteryVoltage !== undefined) {
    // Have voltage but no chemistry — use voltage-derived value from normalization
    // (already set in decoded.battery by normalizeTelemetry)
    battery = decoded.battery as number | undefined;
    console.log(`[TTN-WEBHOOK] ${requestId} | Battery: ${batteryVoltage}V → ${battery}% (no chemistry, legacy formula)`);
  } else {
    // No voltage data at all — use whatever the payload provides.
    // Guard against Dragino Bat_status enum (0-3) being misread as percentage:
    // if Bat_status exists in the raw payload and the value is 0-3, ignore it.
    const rawBatStatus = data.decoded.Bat_status ?? data.decoded.bat_status;
    const reportedBattery = (decoded.battery ?? decoded.battery_level) as number | undefined;
    if (rawBatStatus !== undefined && reportedBattery !== undefined && reportedBattery >= 0 && reportedBattery <= 3) {
      // This looks like a Bat_status enum being used as battery_level — discard it
      battery = undefined;
      console.log(`[TTN-WEBHOOK] ${requestId} | Battery: discarding Bat_status enum value ${reportedBattery} (not a percentage)`);
    } else {
      battery = reportedBattery;
    }
  }

  // Temperature: convert to Fahrenheit based on catalog temperature_unit.
  // The DB and UI expect Fahrenheit; most LoRaWAN sensors report Celsius.
  let temperature = decoded.temperature as number | undefined;
  if (temperature !== undefined && sensorTempUnit === 'C') {
    temperature = (temperature * 9 / 5) + 32;
    console.log(`[TTN-WEBHOOK] ${requestId} | Converted ${decoded.temperature}°C → ${temperature.toFixed(2)}°F`);
  }

  console.log(`[TTN-WEBHOOK] ${requestId} | Processing sensor: ${sensor.name}, temp: ${temperature ?? 'N/A'}`);

  // Update sensor status
  const sensorUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    updated_at: new Date().toISOString(),
  };

  if (sensor.status === 'pending' || sensor.status === 'joining') {
    sensorUpdate.status = 'active';
    if (sensor.status === 'joining') {
      sensorUpdate.last_join_at = receivedAt;
    }
  }

  if (battery !== undefined) sensorUpdate.battery_level = battery;
  if (batteryVoltage !== undefined) sensorUpdate.battery_voltage = batteryVoltage;
  if (rssi !== undefined) sensorUpdate.signal_strength = rssi;

  // ========================================
  // SELF-HEALING: Infer sensor_type from payload
  // If sensor was misclassified (e.g., defaulted to "temperature"),
  // correct it based on actual payload fields
  // ========================================
  const payloadInferredType = inferSensorTypeFromPayload(decoded);
  const currentType = sensor.sensor_type;

  // Only update if we can infer a type AND it's different from current
  // AND the current type is a likely default (temperature)
  if (payloadInferredType && payloadInferredType !== currentType) {
    // If current is "temperature" but payload shows it's a door sensor, fix it
    if (currentType === 'temperature' || !currentType) {
      sensorUpdate.sensor_type = payloadInferredType;
      console.log(`[TTN-WEBHOOK] ${requestId} | Correcting sensor type: ${currentType} -> ${payloadInferredType} (based on payload keys: ${Object.keys(decoded).join(', ')})`);
    }
  }

  // Also try to infer and set model if missing
  const payloadInferredModel = inferModelFromPayload(decoded);
  const nameInferredModel = extractModelFromUnitId(sensor.name);
  if (!sensor.model && (payloadInferredModel || nameInferredModel)) {
    const inferredModel = payloadInferredModel || nameInferredModel;
    sensorUpdate.model = inferredModel;
    console.log(`[TTN-WEBHOOK] ${requestId} | Setting model: ${inferredModel}`);
  }

  await supabase.from('lora_sensors').update(sensorUpdate).eq('id', sensor.id);

  // ========================================
  // DOWNLINK CONFIRMATION: Check pending changes against this uplink
  // ========================================
  try {
    await confirmPendingChanges(supabase, sensor.id, decoded, requestId);
  } catch (confirmErr) {
    // Never fail the uplink processing because of confirmation errors
    console.error(`[TTN-WEBHOOK] ${requestId} | Pending change confirmation error:`, confirmErr);
  }

  // Handle unit-assigned sensors
  if (sensor.unit_id) {
    const hasTemperatureData = temperature !== undefined;
    
    // Normalize door data from various payload formats (door_status, door_open, open_close, etc.)
    const normalizedDoorOpen = normalizeDoorData(decoded);
    const hasDoorData = normalizedDoorOpen !== undefined;
    
    // Log door normalization for debugging
    if (hasDoorData) {
      const doorSource = getDoorFieldSource(decoded);
      console.log(`[TTN-WEBHOOK] ${requestId} | Door data normalized: ${normalizedDoorOpen} from ${doorSource}`);
    }

    if (!hasTemperatureData && !hasDoorData) {
      console.log(`[TTN-WEBHOOK] ${requestId} | No temp or door data in payload. Keys: ${Object.keys(decoded).join(', ')}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Sensor updated, no data to record', sensor_id: sensor.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: unit } = await supabase.from('units').select('door_state').eq('id', sensor.unit_id).single();
    const previousDoorState = unit?.door_state;
    const currentDoorOpen = normalizedDoorOpen;

    // Only include door_open if the sensor actually has door capability
    // This prevents temperature sensors from polluting door data
    // hasDoorData already confirms normalized door data exists
    const hasDoorCapability = hasDoorData || 
      sensor.sensor_type === 'door' || 
      sensor.sensor_type === 'combo';

    // Build reading data - only include door_open for door-capable sensors
    // Core columns always exist on sensor_readings
    const coreReadingData: Record<string, unknown> = {
      unit_id: sensor.unit_id,
      lora_sensor_id: sensor.id,
      device_id: null,
      temperature: temperature ?? null,
      humidity: decoded.humidity,
      battery_level: battery,
      battery_voltage: batteryVoltage ?? null,
      signal_strength: rssi,
      source: 'ttn',
      recorded_at: receivedAt,
    };

    // Only set door_open if this is actually a door sensor
    if (hasDoorCapability && currentDoorOpen !== undefined) {
      coreReadingData.door_open = currentDoorOpen;
    }

    // Extended columns (require migrations — may not exist yet)
    const extendedColumns: Record<string, unknown> = {
      frm_payload_base64: frmPayloadBase64,
      f_port: fPort,
      raw_payload_hex: rawPayloadHex,
      network_decoded_payload: Object.keys(data.decoded).length > 0 ? data.decoded : null,
    };
    if (batteryVoltage !== undefined) extendedColumns.battery_voltage = batteryVoltage;
    if (appDecoded) extendedColumns.app_decoded_payload = appDecoded;
    if (decoderIdStr) extendedColumns.decoder_id = decoderIdStr;
    if (decodeMatch !== null) extendedColumns.decode_match = decodeMatch;
    if (decodeMismatchReason) extendedColumns.decode_mismatch_reason = decodeMismatchReason;
    if (decoderWarnings) extendedColumns.decoder_warnings = decoderWarnings;
    if (decoderErrors) extendedColumns.decoder_errors = decoderErrors;

    // Try inserting with all columns first; if it fails (columns don't exist yet),
    // fall back to core-only insert so data always flows.
    let insertedReading: { id: string } | null = null;
    const fullReadingData = { ...coreReadingData, ...extendedColumns };
    const { data: fullInsert, error: fullInsertError } = await supabase
      .from('sensor_readings')
      .insert(fullReadingData)
      .select('id')
      .single();

    if (fullInsertError) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Full insert failed (${fullInsertError.message}), retrying with core columns only`);
      const { data: coreInsert, error: coreInsertError } = await supabase
        .from('sensor_readings')
        .insert(coreReadingData)
        .select('id')
        .single();

      if (coreInsertError) throw coreInsertError;
      insertedReading = coreInsert;
    } else {
      insertedReading = fullInsert;
    }

    // Update unit
    const unitUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (sensor.is_primary && hasTemperatureData) {
      unitUpdate.last_temp_reading = temperature;
      unitUpdate.last_reading_at = receivedAt;
      unitUpdate.last_checkin_at = receivedAt;
      unitUpdate.sensor_reliable = true;
    } else if (hasTemperatureData) {
      unitUpdate.last_checkin_at = receivedAt;
    }

    // Only process door state if sensor has door capability
    // Use the self-healed sensor type if available (corrected earlier in this request),
    // otherwise fall back to the original sensor_type from the database.
    const effectiveSensorType = (sensorUpdate.sensor_type as string | undefined) ?? sensor.sensor_type;
    const shouldProcessDoor = hasDoorCapability &&
      currentDoorOpen !== undefined &&
      effectiveSensorType !== 'temperature' &&
      effectiveSensorType !== 'temperature_humidity';

    if (shouldProcessDoor) {
      unitUpdate.door_state = currentDoorOpen ? 'open' : 'closed';
      unitUpdate.door_last_changed_at = receivedAt;

      // Insert door event - including initial readings to establish baseline
      const newDoorState = currentDoorOpen ? 'open' : 'closed';
      const isInitialReading = previousDoorState === 'unknown' || previousDoorState === null || previousDoorState === undefined;
      const stateChanged = previousDoorState !== newDoorState;

      if (isInitialReading || stateChanged) {
        const { error: doorEventError } = await supabase.from('door_events').insert({
          unit_id: sensor.unit_id,
          state: newDoorState,
          occurred_at: receivedAt,
          source: 'ttn',
          metadata: { 
            sensor_id: sensor.id, 
            sensor_name: sensor.name,
            is_initial: isInitialReading,
          },
        });
        if (doorEventError) {
          console.error(`[TTN-WEBHOOK] ${requestId} | Door event insert FAILED:`, doorEventError.message);
        } else {
          console.log(`[TTN-WEBHOOK] ${requestId} | Door event: ${previousDoorState} -> ${newDoorState} (initial: ${isInitialReading})`);
        }
      }
    }

    const { error: unitUpdateError } = await supabase.from('units').update(unitUpdate).eq('id', sensor.unit_id);
    if (unitUpdateError) {
      console.error(`[TTN-WEBHOOK] ${requestId} | Unit update FAILED:`, unitUpdateError.message);
    } else {
      console.log(`[TTN-WEBHOOK] ${requestId} | Unit updated: door_state=${unitUpdate.door_state || 'unchanged'}, temp=${unitUpdate.last_temp_reading || 'unchanged'}`);
    }

    // ========================================
    // FIRE-AND-FORGET: Evaluate alarms for this unit
    // Non-blocking — errors are caught and logged, never block the uplink response.
    // ========================================
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceRoleKey) {
        const evalPayload = {
          unit_id: sensor.unit_id,
          org_id: sensor.organization_id,
          site_id: sensor.site_id ?? null,
          dev_eui: devEui || null,
          temperature: temperature ?? undefined,
          humidity: decoded.humidity as number | undefined,
          battery_level: battery,
          battery_voltage: batteryVoltage ?? undefined,
          signal_strength: rssi,
          door_open: hasDoorCapability ? currentDoorOpen : undefined,
          door_state: hasDoorCapability && currentDoorOpen !== undefined
            ? (currentDoorOpen ? 'open' : 'closed')
            : undefined,
          recorded_at: receivedAt,
          reading_id: insertedReading?.id,
        };

        // Fire-and-forget — do not await
        fetch(`${supabaseUrl}/functions/v1/evaluate-alarms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(evalPayload),
        }).then((res) => {
          if (!res.ok) {
            res.text().then((t) =>
              console.error(`[TTN-WEBHOOK] ${requestId} | evaluate-alarms HTTP ${res.status}: ${t.slice(0, 200)}`)
            );
          } else {
            console.log(`[TTN-WEBHOOK] ${requestId} | evaluate-alarms dispatched OK`);
          }
        }).catch((err) => {
          console.error(`[TTN-WEBHOOK] ${requestId} | evaluate-alarms dispatch error:`, err);
        });
      }
    } catch (evalErr) {
      console.error(`[TTN-WEBHOOK] ${requestId} | evaluate-alarms setup error:`, evalErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sensor_id: sensor.id,
        reading_id: insertedReading?.id,
        temperature,
        unit_id: sensor.unit_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Sensor not assigned to unit
  return new Response(
    JSON.stringify({ success: true, message: 'Sensor updated (not assigned to unit)', sensor_id: sensor.id }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Check for pending 'sent' downlink changes for this sensor and confirm
 * them based on the uplink payload content.
 *
 * For Class A devices, the first uplink after a downlink means the device
 * received the queued command. We parse the uplink to verify values where
 * possible, or auto-confirm for commands that can't be read back.
 */
async function confirmPendingChanges(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sensorId: string,
  decoded: Record<string, unknown>,
  requestId: string,
): Promise<void> {
  // Fetch all 'sent' changes for this sensor (oldest first so we confirm in order)
  const { data: sentChanges, error: fetchErr } = await supabase
    .from('sensor_pending_changes')
    .select('id, change_type, command_params, sent_at')
    .eq('sensor_id', sensorId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: true })
    .limit(10);

  if (fetchErr || !sentChanges || sentChanges.length === 0) {
    return; // Nothing to confirm
  }

  console.log(`[TTN-WEBHOOK] ${requestId} | Found ${sentChanges.length} pending 'sent' change(s) for sensor ${sensorId}`);

  const uplinkState = parseLHT65NUplink(decoded);

  for (const change of sentChanges) {
    const result = matchChangeToUplink(
      change.change_type,
      change.command_params,
      uplinkState,
    );

    if (result === 'confirmed') {
      const { error: updateErr } = await supabase
        .from('sensor_pending_changes')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString(),
        })
        .eq('id', change.id);

      if (updateErr) {
        console.error(`[TTN-WEBHOOK] ${requestId} | Failed to mark change ${change.id} as applied:`, updateErr.message);
      } else {
        console.log(`[TTN-WEBHOOK] ${requestId} | Change ${change.id} (${change.change_type}) confirmed → applied`);
      }

      // Also update sensor_configurations.pending_change_id to null
      // and record last_applied_at
      await supabase
        .from('sensor_configurations')
        .update({
          pending_change_id: null,
          last_applied_at: new Date().toISOString(),
        })
        .eq('sensor_id', sensorId)
        .eq('pending_change_id', change.id);

      // If this was an uplink_interval change, persist the new value
      if (change.change_type === 'uplink_interval' && change.command_params?.seconds) {
        await supabase
          .from('sensor_configurations')
          .update({ uplink_interval_s: change.command_params.seconds })
          .eq('sensor_id', sensorId);
      }

      // If this was an ext_mode change, persist
      if (change.change_type === 'ext_mode' && change.command_params?.mode) {
        await supabase
          .from('sensor_configurations')
          .update({ ext_mode: change.command_params.mode })
          .eq('sensor_id', sensorId);
      }

      // If this was an alarm change, persist
      if (change.change_type === 'alarm' && change.command_params) {
        const p = change.command_params;
        await supabase
          .from('sensor_configurations')
          .update({
            alarm_enabled: p.enable ?? false,
            alarm_low: p.low_c ?? null,
            alarm_high: p.high_c ?? null,
            alarm_check_minutes: p.check_minutes ?? null,
          })
          .eq('sensor_id', sensorId);
      }

      // If this was a time_sync change, persist
      if (change.change_type === 'time_sync' && change.command_params) {
        if (change.command_params.type === 'time_sync') {
          await supabase
            .from('sensor_configurations')
            .update({ time_sync_enabled: change.command_params.enable ?? false })
            .eq('sensor_id', sensorId);
        }
        if (change.command_params.type === 'time_sync_days') {
          await supabase
            .from('sensor_configurations')
            .update({ time_sync_days: change.command_params.days ?? null })
            .eq('sensor_id', sensorId);
        }
      }

      // If this was a catalog TDC (interval) change, persist the new interval
      if (change.change_type === 'catalog' && change.command_params?.commandKey === 'set_tdc') {
        const minutes = change.command_params?.fieldValues?.minutes;
        if (typeof minutes === 'number' && minutes > 0) {
          await supabase
            .from('sensor_configurations')
            .update({ uplink_interval_s: minutes * 60 })
            .eq('sensor_id', sensorId);
          console.log(`[TTN-WEBHOOK] ${requestId} | Catalog set_tdc confirmed: ${minutes} min → uplink_interval_s=${minutes * 60}`);
        }
      }

    } else if (result === 'mismatch') {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Change ${change.id} (${change.change_type}) MISMATCH - keeping as 'sent'`);
      // Don't fail the change on first mismatch; the device may not
      // have applied it yet if there were queued frames. Leave as 'sent'
      // and let the timeout handler deal with truly stale ones.

    } else {
      // inconclusive - leave as 'sent'
      console.log(`[TTN-WEBHOOK] ${requestId} | Change ${change.id} (${change.change_type}) inconclusive, still 'sent'`);
    }
  }
}

/**
 * Handle uplink from a legacy device
 */
async function handleLegacyDevice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  device: LegacyDevice,
  data: {
    devEui: string;
    deviceId: string;
    decoded: Record<string, unknown>;
    rssi: number | undefined;
    receivedAt: string;
    requestId: string;
    frmPayloadBase64: string | null;
    fPort: number | null;
    rawPayloadHex: string | null;
  }
): Promise<Response> {
  const { rssi, receivedAt, requestId, frmPayloadBase64, fPort, rawPayloadHex } = data;

  // Normalize vendor-specific keys (e.g. Dragino TempC_SHT → temperature)
  const decoded = normalizeTelemetry(data.decoded);

  const legacyBatteryVoltage = decoded.battery_voltage as number | undefined;
  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;
  const batteryVoltage = decoded.battery_voltage as number | undefined;
  let temperature = decoded.temperature as number | undefined;

  // Legacy devices: assume Celsius (most LoRaWAN sensors), convert to Fahrenheit
  if (temperature !== undefined) {
    temperature = (temperature * 9 / 5) + 32;
  }

  console.log(`[TTN-WEBHOOK] ${requestId} | Processing legacy device: ${device.id}`);

  // Update device
  const deviceUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    updated_at: new Date().toISOString(),
    status: 'active',
  };
  if (battery !== undefined) deviceUpdate.battery_level = battery;
  if (legacyBatteryVoltage !== undefined) deviceUpdate.battery_voltage = legacyBatteryVoltage;
  if (rssi !== undefined) deviceUpdate.signal_strength = rssi;

  await supabase.from('devices').update(deviceUpdate).eq('id', device.id);

  if (device.unit_id && temperature !== undefined) {
    // Core columns always exist on sensor_readings
    const coreData: Record<string, unknown> = {
      unit_id: device.unit_id,
      device_id: device.id,
      temperature,
      humidity: decoded.humidity,
      battery_level: battery,
      battery_voltage: legacyBatteryVoltage ?? null,
      signal_strength: rssi,
      door_open: decoded.door_open,
      source: 'ttn',
      recorded_at: receivedAt,
    };
    // Extended columns (require migrations — may not exist yet)
    const extData: Record<string, unknown> = {
      frm_payload_base64: frmPayloadBase64,
      f_port: fPort,
      raw_payload_hex: rawPayloadHex,
      network_decoded_payload: Object.keys(data.decoded).length > 0 ? data.decoded : null,
    };
    if (batteryVoltage !== undefined) extData.battery_voltage = batteryVoltage;
    // Try full insert, fall back to core-only
    const { error: fullErr } = await supabase
      .from('sensor_readings')
      .insert({ ...coreData, ...extData });
    if (fullErr) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Legacy full insert failed (${fullErr.message}), retrying core-only`);
      await supabase.from('sensor_readings').insert(coreData);
    }

    await supabase.from('units').update({
      last_temp_reading: temperature,
      last_reading_at: receivedAt,
      last_checkin_at: receivedAt,
      updated_at: new Date().toISOString(),
    }).eq('id', device.unit_id);
  }

  return new Response(
    JSON.stringify({ success: true, device_id: device.id }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
