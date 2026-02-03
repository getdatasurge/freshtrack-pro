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
import { normalizeDoorData, getDoorFieldSource, normalizeTelemetry } from "../_shared/payloadNormalization.ts";
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
  sensor_catalog_id: string | null;
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
  cachedAt: number;
}
const decoderCache = new Map<string, CachedDecoder>();
const DECODER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCatalogDecoder(supabase: any, catalogId: string): Promise<CachedDecoder | null> {
  const now = Date.now();
  const cached = decoderCache.get(catalogId);
  if (cached && (now - cached.cachedAt) < DECODER_CACHE_TTL_MS) {
    return cached;
  }
  const { data } = await supabase
    .from('sensor_catalog')
    .select('decoder_js, revision')
    .eq('id', catalogId)
    .maybeSingle();
  if (!data) return null;
  const entry: CachedDecoder = { decoder_js: data.decoder_js, revision: data.revision, cachedAt: now };
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

    // Validate DevEUI
    if (!rawDevEui) {
      console.warn(`[TTN-WEBHOOK] ${requestId} | Missing dev_eui`);
      return new Response(
        JSON.stringify({ accepted: true, processed: false, reason: 'Missing dev_eui' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedDevEui = normalizeDevEui(rawDevEui);
    if (!normalizedDevEui) {
      return new Response(
        JSON.stringify({ accepted: true, processed: false, reason: 'Invalid dev_eui format' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate match variants
    const devEuiLower = normalizedDevEui;
    const devEuiUpper = normalizedDevEui.toUpperCase();
    const devEuiColonUpper = formatDevEuiForDisplay(normalizedDevEui);
    const devEuiColonLower = devEuiColonUpper.toLowerCase();

    // ========================================
    // LOOKUP: Find sensor in authenticated org only
    // ========================================
    let loraSensor: LoraSensor | null = null;

    // Try by ttn_device_id first
    if (deviceId) {
      const { data: sensorByDeviceId } = await supabase
        .from('lora_sensors')
        .select('id, organization_id, site_id, unit_id, dev_eui, status, ttn_application_id, sensor_type, name, is_primary, model, sensor_catalog_id')
        .eq('ttn_device_id', deviceId)
        .eq('organization_id', authenticatedOrgId)  // CRITICAL: Scope to authenticated org
        .maybeSingle();

      if (sensorByDeviceId) {
        console.log(`[TTN-WEBHOOK] ${requestId} | Found sensor by ttn_device_id: ${sensorByDeviceId.name}`);
        loraSensor = sensorByDeviceId;
      }
    }

    // Fallback to dev_eui
    if (!loraSensor) {
      const { data: sensorByDevEui } = await supabase
        .from('lora_sensors')
        .select('id, organization_id, site_id, unit_id, dev_eui, status, ttn_application_id, sensor_type, name, is_primary, model, sensor_catalog_id')
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

    // Legacy fallback - also scope to org if possible
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

    // Unknown device
    console.warn(`[TTN-WEBHOOK] ${requestId} | Unknown device for org ${authenticatedOrgId}: ${devEuiLower}`);
    return new Response(
      JSON.stringify({ 
        accepted: true,
        processed: false,
        reason: 'Unknown device - not registered for this organization',
        dev_eui: devEuiLower,
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
  const decoded = normalizeTelemetry(data.decoded);

  // Battery handling
  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;

  // Temperature scaling
  let temperature = decoded.temperature as number | undefined;
  if (temperature !== undefined) {
    const tempScale = (decoded.temperature_scale ?? 1) as number;
    if (tempScale !== 1) {
      temperature = temperature * tempScale;
    } else if (temperature > 0 && temperature < 10) {
      const scaledTemp = temperature * 10;
      if (scaledTemp >= 10 && scaledTemp <= 100) {
        temperature = scaledTemp;
      }
    }
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
    const readingData: Record<string, unknown> = {
      unit_id: sensor.unit_id,
      lora_sensor_id: sensor.id,
      device_id: null,
      temperature: temperature ?? null,
      humidity: decoded.humidity,
      battery_level: battery,
      signal_strength: rssi,
      source: 'ttn',
      recorded_at: receivedAt,
      // Raw payload storage for decoder independence
      frm_payload_base64: frmPayloadBase64,
      f_port: fPort,
      raw_payload_hex: rawPayloadHex,
      network_decoded_payload: Object.keys(data.decoded).length > 0 ? data.decoded : null,
    };

    // Only set door_open if this is actually a door sensor
    if (hasDoorCapability && currentDoorOpen !== undefined) {
      readingData.door_open = currentDoorOpen;
    }

    // ========================================
    // TRUST MODE: Server-side decoding via catalog decoder_js
    // Only runs when sensor has a catalog entry with a decoder and we have raw bytes.
    // Never fails the uplink — all errors are caught and logged.
    // ========================================
    if (sensor.sensor_catalog_id && frmPayloadBytes && fPort != null) {
      try {
        const catalogEntry = await getCatalogDecoder(supabase, sensor.sensor_catalog_id);

        if (catalogEntry?.decoder_js) {
          const decoderCode = `${catalogEntry.decoder_js}\nreturn decodeUplink(input);`;
          const decoderFn = new Function('input', decoderCode);
          const decoderResult = decoderFn({ bytes: frmPayloadBytes, fPort });

          // TTN device repo decoders return { data, warnings, errors }
          const appDecoded = (decoderResult?.data ?? decoderResult) as Record<string, unknown>;
          readingData.app_decoded_payload = appDecoded;
          readingData.decoder_id = `catalog:${sensor.sensor_catalog_id}:rev${catalogEntry.revision}`;

          // Capture decoder warnings/errors if present
          if (Array.isArray(decoderResult?.warnings) && decoderResult.warnings.length > 0) {
            readingData.decoder_warnings = decoderResult.warnings;
          }
          if (Array.isArray(decoderResult?.errors) && decoderResult.errors.length > 0) {
            readingData.decoder_errors = decoderResult.errors;
          }

          // Compare against TTN decoded payload (use original, pre-normalization).
          // Apply normalizeTelemetry to both sides so vendor key aliases
          // (TempC_SHT→temperature, BatV→battery, etc.) don't cause false mismatches.
          const networkPayload = data.decoded;
          if (Object.keys(networkPayload).length > 0) {
            const normalizedApp = normalizeTelemetry(appDecoded);
            const normalizedNet = normalizeTelemetry(networkPayload);
            const { match, diffKeys } = deepComparePayloads(normalizedApp, normalizedNet);
            readingData.decode_match = match;
            if (!match) {
              readingData.decode_mismatch_reason = `key_diff:${diffKeys.join(',')}`;
              console.warn(`[TTN-WEBHOOK] ${requestId} | Decode mismatch: keys=${diffKeys.join(',')}`);
            } else {
              console.log(`[TTN-WEBHOOK] ${requestId} | Decode match confirmed (catalog rev${catalogEntry.revision})`);
            }
          }
        }
      } catch (decodeErr: unknown) {
        const errMsg = decodeErr instanceof Error ? decodeErr.message : String(decodeErr);
        console.warn(`[TTN-WEBHOOK] ${requestId} | Server-side decode failed: ${errMsg}`);
        readingData.decode_match = false;
        readingData.decode_mismatch_reason = `decode_error:${errMsg.slice(0, 200)}`;
      }
    }

    // Insert reading
    const { data: insertedReading, error: insertError } = await supabase
      .from('sensor_readings')
      .insert(readingData)
      .select('id')
      .single();

    if (insertError) throw insertError;

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
    // Stricter check: must be explicit door sensor type OR have door data but NOT be a temp-only sensor
    const shouldProcessDoor = hasDoorCapability && 
      currentDoorOpen !== undefined &&
      sensor.sensor_type !== 'temperature' && 
      sensor.sensor_type !== 'temperature_humidity';

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

  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;
  let temperature = decoded.temperature as number | undefined;

  if (temperature !== undefined && temperature > 0 && temperature < 10) {
    const scaledTemp = temperature * 10;
    if (scaledTemp >= 10 && scaledTemp <= 100) {
      temperature = scaledTemp;
    }
  }

  console.log(`[TTN-WEBHOOK] ${requestId} | Processing legacy device: ${device.id}`);

  // Update device
  const deviceUpdate: Record<string, unknown> = {
    last_seen_at: receivedAt,
    updated_at: new Date().toISOString(),
    status: 'active',
  };
  if (battery !== undefined) deviceUpdate.battery_level = battery;
  if (rssi !== undefined) deviceUpdate.signal_strength = rssi;

  await supabase.from('devices').update(deviceUpdate).eq('id', device.id);

  if (device.unit_id && temperature !== undefined) {
    await supabase.from('sensor_readings').insert({
      unit_id: device.unit_id,
      device_id: device.id,
      temperature,
      humidity: decoded.humidity,
      battery_level: battery,
      signal_strength: rssi,
      door_open: decoded.door_open,
      source: 'ttn',
      recorded_at: receivedAt,
      // Raw payload storage for decoder independence
      frm_payload_base64: frmPayloadBase64,
      f_port: fPort,
      raw_payload_hex: rawPayloadHex,
      network_decoded_payload: Object.keys(data.decoded).length > 0 ? data.decoded : null,
    });

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
