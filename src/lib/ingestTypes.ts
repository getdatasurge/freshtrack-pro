/**
 * Ingest Abstraction Layer Types
 * 
 * Shared TypeScript interfaces for normalized sensor readings.
 * Used by both frontend and edge functions for type safety.
 */

/**
 * Supported sensor data sources
 */
export type SensorSource = "ttn" | "ble" | "simulator" | "manual_sensor" | "api";

/**
 * Normalized reading interface - vendor-agnostic sensor data
 * 
 * This is the standard format for all sensor readings regardless of source.
 * The ingest-readings edge function accepts this format.
 */
export interface NormalizedReading {
  /** UUID of the target unit */
  unit_id: string;
  
  /** Device serial number (optional, used to link to devices table) */
  device_serial?: string;
  
  /** Temperature in Fahrenheit */
  temperature: number;
  
  /** Relative humidity percentage (0-100) */
  humidity?: number;
  
  /** Battery level percentage (0-100) */
  battery_level?: number;
  
  /** Signal strength in dBm (typically -120 to 0) */
  signal_strength?: number;
  
  /** Whether the door/lid is currently open */
  door_open?: boolean;
  
  /** Source of the reading for traceability */
  source: SensorSource;
  
  /** Vendor-specific metadata for debugging */
  source_metadata?: Record<string, unknown>;
  
  /** When the reading was taken (ISO string, defaults to now) */
  recorded_at?: string;
}

/**
 * Request body for the ingest-readings edge function
 */
export interface IngestRequest {
  readings: NormalizedReading[];
}

/**
 * Response from the ingest-readings edge function
 */
export interface IngestResponse {
  success: boolean;
  ingested: number;
  failed: number;
  results: {
    unit_id: string;
    success: boolean;
    error?: string;
  }[];
}

/**
 * TTN Uplink Payload (for future TTN webhook integration)
 * 
 * This represents the typical structure of a TTN uplink message.
 * The ingest-readings function can transform this to NormalizedReading.
 */
export interface TTNUplinkPayload {
  end_device_ids: {
    device_id: string;
    dev_eui: string;
  };
  uplink_message: {
    decoded_payload?: {
      temperature?: number;
      humidity?: number;
      battery?: number;
      door_open?: boolean;
    };
    rx_metadata?: {
      rssi?: number;
    }[];
    received_at: string;
  };
}

/**
 * Transform TTN payload to normalized reading
 */
export function transformTTNPayload(
  ttnPayload: TTNUplinkPayload,
  unitId: string
): NormalizedReading | null {
  const decoded = ttnPayload.uplink_message?.decoded_payload;
  
  if (!decoded?.temperature) {
    return null;
  }

  return {
    unit_id: unitId,
    device_serial: ttnPayload.end_device_ids.dev_eui,
    temperature: decoded.temperature,
    humidity: decoded.humidity,
    battery_level: decoded.battery,
    door_open: decoded.door_open,
    signal_strength: ttnPayload.uplink_message.rx_metadata?.[0]?.rssi,
    source: "ttn",
    source_metadata: {
      device_id: ttnPayload.end_device_ids.device_id,
      dev_eui: ttnPayload.end_device_ids.dev_eui,
    },
    recorded_at: ttnPayload.uplink_message.received_at,
  };
}
