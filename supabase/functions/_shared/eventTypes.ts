/**
 * FrostGuard Event Types
 * 
 * Canonical event envelope that wraps all incoming sensor payloads,
 * providing a unified structure for processing regardless of source.
 */

// ============================================================================
// INFERENCE TYPES
// ============================================================================

/**
 * Explains a single inference decision with confidence contribution.
 */
export interface InferenceReason {
  /** Rule that contributed to inference (e.g., "field_match", "schema_valid") */
  rule: string;
  /** Field that triggered this reason (optional) */
  field?: string;
  /** Value that was matched (optional) */
  value?: unknown;
  /** Confidence contribution (0-1) */
  confidence: number;
  /** Human-readable explanation */
  message: string;
}

/**
 * Result of payload type inference.
 * 
 * IMPORTANT: payloadType is now versioned (e.g., "door_v1", "temp_rh_v1").
 * sensorType is derived from the payload type manifest at runtime.
 */
export interface InferenceResult {
  /** Versioned payload type (e.g., "door_v1", "temp_rh_v1", "unclassified") */
  payloadType: string;
  
  /** Inferred device model (e.g., "LDS02") - metadata only */
  model: string | null;
  
  /** Derived sensor type (e.g., "door", "temperature") - from manifest */
  sensorType: string;
  
  /** Overall confidence score (0-1) */
  confidence: number;
  
  /** Explainable chain of inference reasons */
  reasons: InferenceReason[];
  
  /** True if multiple types match with similar confidence */
  isAmbiguous: boolean;
  
  /** Other possible payload types if ambiguous */
  alternates: string[];
  
  /** Schema version of the payload type manifest */
  schemaVersion: string;
}

// ============================================================================
// EVENT ENVELOPE
// ============================================================================

/**
 * Source of the event data.
 */
export type EventSource = 'ttn' | 'emulator' | 'simulator' | 'api' | 'manual';

/**
 * Canonical event envelope for all incoming sensor data.
 * This unified structure allows consistent processing regardless of source.
 */
export interface FrostGuardEvent {
  // --------------------------------------------------------------------------
  // Envelope Metadata
  // --------------------------------------------------------------------------
  
  /** Unique event identifier (UUID) */
  eventId: string;
  
  /** ISO timestamp when event was received */
  receivedAt: string;
  
  /** Source of this event */
  source: EventSource;
  
  /** Version of the source handler (e.g., "ttn-webhook/1.0") */
  sourceVersion: string;
  
  // --------------------------------------------------------------------------
  // Device Identity
  // --------------------------------------------------------------------------
  
  /** Device EUI (8-byte hex string) */
  devEui: string;
  
  /** TTN device_id if available */
  deviceId?: string;
  
  /** Organization ID this device belongs to */
  organizationId?: string;
  
  /** Sensor ID in our database (if resolved) */
  sensorId?: string;
  
  // --------------------------------------------------------------------------
  // Payload Data
  // --------------------------------------------------------------------------
  
  /** Base64-encoded raw payload bytes (if available) */
  rawPayload?: string;
  
  /** Decoded payload object from decoder/source */
  decodedPayload: Record<string, unknown>;
  
  /** Port number for LoRaWAN payloads */
  fPort?: number;
  
  // --------------------------------------------------------------------------
  // Network Metadata
  // --------------------------------------------------------------------------
  
  /** Frame counter (for deduplication) */
  fCnt?: number;
  
  /** Gateway ID that received this uplink */
  gatewayId?: string;
  
  /** RSSI signal strength */
  rssi?: number;
  
  /** SNR value */
  snr?: number;
  
  // --------------------------------------------------------------------------
  // Inference Result
  // --------------------------------------------------------------------------
  
  /** Populated after payload classification */
  inference?: InferenceResult;
}

// ============================================================================
// TTN WEBHOOK TYPES (for normalization)
// ============================================================================

/**
 * Simplified TTN uplink message structure.
 */
export interface TTNUplinkMessage {
  device_id: string;
  dev_eui?: string;
  received_at: string;
  frm_payload?: string;
  decoded_payload?: Record<string, unknown>;
  f_port?: number;
  f_cnt?: number;
  rx_metadata?: Array<{
    gateway_ids?: { gateway_id?: string };
    rssi?: number;
    snr?: number;
  }>;
}

/**
 * TTN webhook payload structure.
 */
export interface TTNWebhookPayload {
  end_device_ids?: {
    device_id?: string;
    dev_eui?: string;
    application_ids?: { application_id?: string };
  };
  uplink_message?: TTNUplinkMessage;
  received_at?: string;
}

// ============================================================================
// NORMALIZATION UTILITIES
// ============================================================================

/**
 * Generate a unique event ID.
 */
function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp.
 */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Normalize a TTN webhook payload into a FrostGuardEvent.
 */
export function normalizeFromTTN(
  webhook: TTNWebhookPayload,
  sourceVersion = 'ttn-webhook/1.0'
): FrostGuardEvent {
  const uplink = webhook.uplink_message;
  const deviceIds = webhook.end_device_ids;
  
  // Extract gateway info from first rx_metadata entry
  const rxMeta = uplink?.rx_metadata?.[0];
  
  return {
    eventId: generateEventId(),
    receivedAt: webhook.received_at || nowISO(),
    source: 'ttn',
    sourceVersion,
    devEui: deviceIds?.dev_eui || '',
    deviceId: deviceIds?.device_id,
    rawPayload: uplink?.frm_payload,
    decodedPayload: uplink?.decoded_payload || {},
    fPort: uplink?.f_port,
    fCnt: uplink?.f_cnt,
    gatewayId: rxMeta?.gateway_ids?.gateway_id,
    rssi: rxMeta?.rssi,
    snr: rxMeta?.snr,
  };
}

/**
 * Emulator sensor input structure.
 */
export interface EmulatorSensorInput {
  dev_eui: string;
  name?: string;
  decoded_payload: Record<string, unknown>;
  organization_id?: string;
}

/**
 * Normalize an emulator sync payload into a FrostGuardEvent.
 */
export function normalizeFromEmulator(
  input: EmulatorSensorInput,
  sourceVersion = 'emulator-sync/1.0'
): FrostGuardEvent {
  return {
    eventId: generateEventId(),
    receivedAt: nowISO(),
    source: 'emulator',
    sourceVersion,
    devEui: input.dev_eui,
    organizationId: input.organization_id,
    decodedPayload: input.decoded_payload,
  };
}

/**
 * Simulator payload input structure.
 */
export interface SimulatorPayload {
  dev_eui: string;
  sensor_id?: string;
  payload: Record<string, unknown>;
}

/**
 * Normalize a simulator payload into a FrostGuardEvent.
 */
export function normalizeFromSimulator(
  input: SimulatorPayload,
  sourceVersion = 'simulator/1.0'
): FrostGuardEvent {
  return {
    eventId: generateEventId(),
    receivedAt: nowISO(),
    source: 'simulator',
    sourceVersion,
    devEui: input.dev_eui,
    sensorId: input.sensor_id,
    decodedPayload: input.payload,
  };
}

/**
 * Create a FrostGuardEvent from raw components.
 */
export function createFrostGuardEvent(
  devEui: string,
  decodedPayload: Record<string, unknown>,
  source: EventSource = 'api',
  options: Partial<FrostGuardEvent> = {}
): FrostGuardEvent {
  return {
    eventId: generateEventId(),
    receivedAt: nowISO(),
    source,
    sourceVersion: `${source}/1.0`,
    devEui,
    decodedPayload,
    ...options,
  };
}
