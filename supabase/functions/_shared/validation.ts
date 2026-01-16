/**
 * Shared validation schemas and utilities for edge functions
 * 
 * Uses Zod for runtime type validation to prevent injection attacks
 * and ensure data integrity.
 */

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============= Common Schemas =============

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const temperatureSchema = z.number()
  .min(-100, "Temperature too low")
  .max(300, "Temperature too high");

export const humiditySchema = z.number()
  .int("Humidity must be an integer")
  .min(0, "Humidity must be >= 0")
  .max(100, "Humidity must be <= 100");

export const batteryLevelSchema = z.number()
  .int("Battery level must be an integer")
  .min(0, "Battery level must be >= 0")
  .max(100, "Battery level must be <= 100");

export const signalStrengthSchema = z.number()
  .int("Signal strength must be an integer")
  .min(-150, "Signal too weak")
  .max(0, "Signal too strong");

export const dateStringSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const isoDateTimeSchema = z.string()
  .datetime({ message: "Must be a valid ISO 8601 datetime" })
  .optional();

// ============= Ingest Readings Schemas =============

export const sensorSourceSchema = z.enum([
  "ttn", "ble", "simulator", "manual_sensor", "api"
]);

export const normalizedReadingSchema = z.object({
  unit_id: uuidSchema,
  device_serial: z.string().max(50, "Device serial too long").optional(),
  temperature: temperatureSchema,
  humidity: humiditySchema.optional(),
  battery_level: batteryLevelSchema.optional(),
  battery_voltage: z.number().min(0).max(10).optional(),
  signal_strength: signalStrengthSchema.optional(),
  door_open: z.boolean().optional(),
  source: sensorSourceSchema,
  source_metadata: z.record(z.unknown()).optional(),
  recorded_at: isoDateTimeSchema,
});

export const ingestRequestSchema = z.object({
  readings: z.array(normalizedReadingSchema)
    .min(1, "At least one reading required")
    .max(100, "Maximum 100 readings per request"),
});

export type NormalizedReadingInput = z.infer<typeof normalizedReadingSchema>;
export type IngestRequestInput = z.infer<typeof ingestRequestSchema>;

// ============= Export Request Schemas =============

export const reportTypeSchema = z.enum([
  "daily", "exceptions", "manual", "compliance"
]);

export const exportFormatSchema = z.enum(["csv", "pdf"]).default("csv");

export const exportRequestSchema = z.object({
  unit_id: uuidSchema.optional(),
  site_id: uuidSchema.optional(),
  start_date: dateStringSchema,
  end_date: dateStringSchema,
  report_type: reportTypeSchema,
  format: exportFormatSchema.optional(),
}).refine(
  (data) => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    return end >= start;
  },
  { message: "End date must be >= start date" }
).refine(
  (data) => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 366;
  },
  { message: "Date range cannot exceed 1 year" }
);

export type ExportRequestInput = z.infer<typeof exportRequestSchema>;

// ============= Simulator Request Schemas =============

export const simulatorActionSchema = z.enum([
  "pair_sensor", "unpair_sensor", "set_online", "set_offline",
  "update_telemetry", "set_door_state", "inject",
  "start_streaming", "stop_streaming", "reset",
  "start", "stop"
]);

export const doorStateSchema = z.enum(["open", "closed"]);

export const simulatorRequestSchema = z.object({
  action: simulatorActionSchema,
  unit_id: uuidSchema,
  temperature: temperatureSchema.optional(),
  humidity: humiditySchema.optional(),
  battery_level: batteryLevelSchema.optional(),
  signal_strength: signalStrengthSchema.optional(),
  door_state: doorStateSchema.optional(),
  door_sensor_present: z.boolean().optional(),
  interval_seconds: z.number().int().min(10).max(3600).optional(),
  door_cycle_enabled: z.boolean().optional(),
  door_cycle_open_seconds: z.number().int().min(5).max(3600).optional(),
  door_cycle_closed_seconds: z.number().int().min(5).max(3600).optional(),
});

export type SimulatorRequestInput = z.infer<typeof simulatorRequestSchema>;

// ============= Emulator Sync Schemas =============

export const emulatorGatewaySchema = z.object({
  gateway_eui: z.string().min(1, "Gateway EUI required").max(32, "Gateway EUI too long"),
  name: z.string().min(1, "Gateway name required").max(100, "Gateway name too long"),
  status: z.enum(["pending", "online", "offline", "maintenance"]).optional(),
  site_id: uuidSchema.optional().nullable(),
  description: z.string().max(500, "Description too long").optional().nullable(),
});

// Expanded sensor type enum to match device categories
const sensorTypeEnum = z.enum([
  "temperature", 
  "temperature_humidity", 
  "door", 
  "combo", 
  "contact",
  "motion",
  "leak",
  "metering",
  "gps",
  "air_quality",
  "multi_sensor"
]);

export const emulatorDeviceSchema = z.object({
  serial_number: z.string().min(1, "Serial number required").max(100, "Serial number too long"),
  unit_id: uuidSchema.optional().nullable(),
  status: z.enum(["active", "inactive", "fault"]).optional(),
  mac_address: z.string().max(50, "MAC address too long").optional().nullable(),
  firmware_version: z.string().max(50, "Firmware version too long").optional().nullable(),
  // Optional dev_eui - if present, also creates a corresponding lora_sensor
  dev_eui: z.string().max(32, "Device EUI too long").optional().nullable(),
  sensor_type: sensorTypeEnum.optional(),
  name: z.string().max(100, "Name too long").optional().nullable(),
  model: z.string().max(100, "Model too long").optional().nullable(),
  manufacturer: z.string().max(100, "Manufacturer too long").optional().nullable(),
  // Payload-based inference fields (same as sensor schema)
  decoded_payload: z.record(z.unknown()).optional().nullable(),
  unit_name: z.string().max(200, "Unit name too long").optional().nullable(),
});

export const emulatorSensorSchema = z.object({
  dev_eui: z.string().min(1, "Device EUI required").max(32, "Device EUI too long"),
  name: z.string().min(1, "Sensor name required").max(100, "Sensor name too long"),
  sensor_type: sensorTypeEnum.optional(),
  status: z.enum(["pending", "joining", "active", "offline", "fault"]).optional(),
  unit_id: uuidSchema.optional().nullable(),
  site_id: uuidSchema.optional().nullable(),
  manufacturer: z.string().max(100, "Manufacturer too long").optional().nullable(),
  model: z.string().max(100, "Model too long").optional().nullable(),
  // OTAA credentials for TTN provisioning
  app_eui: z.string().max(32, "App EUI too long").optional().nullable(),
  app_key: z.string().max(64, "App Key too long").optional().nullable(), // 32 bytes hex = 64 chars
  // TTN registration info
  ttn_device_id: z.string().max(100, "TTN Device ID too long").optional().nullable(),
  ttn_application_id: z.string().max(100, "TTN Application ID too long").optional().nullable(),
  // Payload-based inference fields
  decoded_payload: z.record(z.unknown()).optional().nullable(),
  unit_name: z.string().max(200, "Unit name too long").optional().nullable(),
});

export const emulatorSyncPayloadSchema = z.object({
  org_id: uuidSchema,
  sync_id: z.string().max(100, "Sync ID too long").optional(),
  synced_at: z.string().datetime({ message: "Must be a valid ISO 8601 datetime" }),
  gateways: z.array(emulatorGatewaySchema).max(50, "Maximum 50 gateways per sync").optional().default([]),
  devices: z.array(emulatorDeviceSchema).max(100, "Maximum 100 devices per sync").optional().default([]),
  sensors: z.array(emulatorSensorSchema).max(100, "Maximum 100 sensors per sync").optional().default([]),
});

export type EmulatorGatewayInput = z.infer<typeof emulatorGatewaySchema>;
export type EmulatorDeviceInput = z.infer<typeof emulatorDeviceSchema>;
export type EmulatorSensorInput = z.infer<typeof emulatorSensorSchema>;
export type EmulatorSyncPayloadInput = z.infer<typeof emulatorSyncPayloadSchema>;

// ============= API Key Validation =============

/**
 * Validate emulator sync API key for Project 2 integration
 * Checks for EMULATOR_SYNC_API_KEY environment variable
 */
export function validateEmulatorSyncApiKey(req: Request): { valid: boolean; error?: string } {
  const expectedKey = Deno.env.get("EMULATOR_SYNC_API_KEY");
  
  if (!expectedKey) {
    console.warn("EMULATOR_SYNC_API_KEY not configured - emulator sync disabled");
    return { valid: false, error: "Emulator sync API not configured" };
  }
  
  const authHeader = req.headers.get("Authorization");
  const customHeader = req.headers.get("X-Emulator-Sync-Key");
  
  // Check X-Emulator-Sync-Key header first
  if (customHeader === expectedKey) {
    return { valid: true };
  }
  
  // Check Authorization: Bearer <key> format
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === expectedKey) {
      return { valid: true };
    }
  }
  
  return { valid: false, error: "Invalid or missing emulator sync API key" };
}

/**
 * Validate internal API key for scheduled/internal functions
 * Checks for INTERNAL_API_KEY environment variable
 */
export function validateInternalApiKey(req: Request): { valid: boolean; error?: string } {
  const expectedKey = Deno.env.get("INTERNAL_API_KEY");
  
  // If no key is configured, reject all requests
  if (!expectedKey) {
    console.warn("INTERNAL_API_KEY not configured - internal endpoints disabled");
    return { valid: false, error: "Internal API not configured" };
  }
  
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("X-Internal-API-Key");
  
  // Check X-Internal-API-Key header first
  if (apiKeyHeader === expectedKey) {
    return { valid: true };
  }
  
  // Check Authorization: Bearer <key> format
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === expectedKey) {
      return { valid: true };
    }
  }
  
  return { valid: false, error: "Invalid or missing API key" };
}

/**
 * Validate device API key for IoT ingestion
 * Checks for DEVICE_INGEST_API_KEY environment variable
 * 
 * SECURITY: Rejects all requests if DEVICE_INGEST_API_KEY is not configured
 */
export function validateDeviceApiKey(req: Request): { valid: boolean; error?: string } {
  const expectedKey = Deno.env.get("DEVICE_INGEST_API_KEY");
  
  // If no device key configured, reject all requests for security
  if (!expectedKey) {
    console.warn("DEVICE_INGEST_API_KEY not configured - device ingestion endpoints disabled");
    return { valid: false, error: "Device ingestion API not configured" };
  }
  
  const apiKeyHeader = req.headers.get("X-Device-API-Key");
  const authHeader = req.headers.get("Authorization");
  
  // Check X-Device-API-Key header
  if (apiKeyHeader === expectedKey) {
    return { valid: true };
  }
  
  // Check Authorization: Bearer <key> format
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === expectedKey) {
      return { valid: true };
    }
  }
  
  return { valid: false, error: "Invalid or missing device API key" };
}

// ============= Project 2 Sync API Key Validation =============

/**
 * Validate Project 2 sync API key for org-state-api pull endpoint
 * Checks for PROJECT2_SYNC_API_KEY environment variable
 * Accepts: Authorization: Bearer <key> OR X-Sync-API-Key: <key>
 */
export function validateProject2SyncApiKey(req: Request): { 
  valid: boolean; 
  error?: string;
  errorCode?: 'NOT_CONFIGURED' | 'UNAUTHORIZED';
  keyLast4?: string;
} {
  const expectedKey = Deno.env.get("PROJECT2_SYNC_API_KEY");
  
  if (!expectedKey) {
    console.warn("[validateProject2SyncApiKey] PROJECT2_SYNC_API_KEY not configured");
    return { valid: false, error: "Sync API not configured", errorCode: 'NOT_CONFIGURED' };
  }
  
  const authHeader = req.headers.get("Authorization");
  const syncHeader = req.headers.get("X-Sync-API-Key");
  
  // Check X-Sync-API-Key header first
  if (syncHeader === expectedKey) {
    return { valid: true, keyLast4: expectedKey.slice(-4) };
  }
  
  // Check Authorization: Bearer <key> format
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === expectedKey) {
      return { valid: true, keyLast4: expectedKey.slice(-4) };
    }
  }
  
  return { valid: false, error: "Invalid or missing sync API key", errorCode: 'UNAUTHORIZED' };
}

// ============= Structured Error Response Builder =============

export interface StructuredErrorResponse {
  success: false;
  error_code: string;
  message: string;
  request_id: string;
  details?: Record<string, unknown>;
  hint?: string;
  timestamp: string;
}

export function buildStructuredError(
  errorCode: string,
  message: string,
  requestId: string,
  options?: {
    details?: Record<string, unknown>;
    hint?: string;
  }
): StructuredErrorResponse {
  return {
    success: false,
    error_code: errorCode,
    message,
    request_id: requestId,
    details: options?.details,
    hint: options?.hint,
    timestamp: new Date().toISOString(),
  };
}

export function structuredErrorResponse(
  status: number,
  errorCode: string,
  message: string,
  requestId: string,
  corsHeaders: Record<string, string>,
  options?: {
    details?: Record<string, unknown>;
    hint?: string;
  }
): Response {
  const body = buildStructuredError(errorCode, message, requestId, options);
  
  return new Response(
    JSON.stringify(body),
    { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

// ============= Error Response Helpers =============

export function validationErrorResponse(error: z.ZodError, corsHeaders: Record<string, string>) {
  const issues = error.issues.map(i => ({
    path: i.path.join("."),
    message: i.message,
  }));
  
  return new Response(
    JSON.stringify({
      error: "Validation error",
      details: issues,
    }),
    { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

export function unauthorizedResponse(message: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

export function forbiddenResponse(message: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status: 403, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}
