/**
 * Sensor Catalog Types
 * Master reference library for all supported sensor models
 */

export interface SensorCatalogFPort {
  port: number;
  direction: "up" | "down";
  description: string;
  is_default?: boolean;
}

export interface SensorCatalogDecodedField {
  field: string;
  type: "number" | "boolean" | "string";
  unit: string | null;
  range: [number, number] | null;
  description: string;
}

export interface SensorCatalogSamplePayload {
  scenario: string;
  f_port: number;
  raw_hex?: string;
  raw_base64?: string;
  decoded: Record<string, unknown>;
  tts_v3_envelope?: Record<string, unknown>;
  notes?: string;
}

export interface SensorCatalogUplinkInfo {
  encoding?: string;
  default_interval_s?: number;
  min_interval_s?: number;
  max_interval_s?: number;
  max_payload_bytes?: number;
  confirmed_uplinks?: boolean;
  adaptive_data_rate?: boolean;
  event_driven?: boolean;
  event_types?: string[];
}

export type BatteryChemistry =
  | "Li-SOCl2"
  | "Li-MnO2"
  | "Alkaline"
  | "Li-ion"
  | "LiFePO4"
  | "Other";

export interface SensorCatalogBatteryInfo {
  type?: string;
  chemistry?: BatteryChemistry | string;
  quantity?: number;
  capacity_mah?: number;
  voltage_nominal?: number;
  voltage_range?: [number, number];
  expected_life_years?: number;
  low_threshold_v?: number;
  rechargeable?: boolean;
  reporting_format?: string;
  notes?: string;
}

export interface SensorCatalogDownlinkCommand {
  name: string;
  hex_template: string;
  description: string;
}

export interface SensorCatalogDownlinkInfo {
  supports_remote_config?: boolean;
  config_port?: number;
  commands?: SensorCatalogDownlinkCommand[];
}

export interface SensorCatalogDecoderProvenance {
  source?: "ttn_device_repo" | "vendor_github" | "internal" | "community";
  url?: string;
  commit_sha?: string;
  retrieved_at?: string;
}

export interface SensorCatalogSampleProvenance {
  source?: "live_uplink" | "vendor_docs" | "synthetic";
  device_eui?: string;
  captured_at?: string;
}

export interface SensorCatalogTestVector {
  raw_hex: string;
  f_port: number;
  expected_decoded: Record<string, unknown>;
}

export type SensorKind =
  | "temp"
  | "temp_humidity"
  | "door"
  | "combo"
  | "co2"
  | "leak"
  | "gps"
  | "pulse"
  | "soil"
  | "air_quality"
  | "vibration"
  | "meter"
  | "tilt";

export interface SensorCatalogEntry {
  id: string;
  manufacturer: string;
  model: string;
  model_variant: string | null;
  display_name: string;
  sensor_kind: SensorKind;
  description: string | null;
  frequency_bands: string[];
  lorawan_version: string;
  regional_params: string | null;
  supports_otaa: boolean;
  supports_abp: boolean;
  supports_class: string;
  f_ports: SensorCatalogFPort[];
  decoded_fields: SensorCatalogDecodedField[];
  sample_payloads: SensorCatalogSamplePayload[];
  decoder_js: string | null;
  decoder_python: string | null;
  decoder_source_url: string | null;
  decoder_provenance: SensorCatalogDecoderProvenance;
  sample_payload_provenance: SensorCatalogSampleProvenance;
  decoder_test_vectors: SensorCatalogTestVector[];
  uplink_info: SensorCatalogUplinkInfo;
  battery_info: SensorCatalogBatteryInfo;
  downlink_info: SensorCatalogDownlinkInfo;
  image_url: string | null;
  datasheet_url: string | null;
  product_url: string | null;
  ttn_device_repo_id: string | null;
  is_supported: boolean;
  is_visible: boolean;
  sort_order: number;
  tags: string[];
  notes: string | null;
  decode_mode: "ttn" | "trust" | "app" | "off";
  temperature_unit: "C" | "F";
  revision: number;
  deprecated_at: string | null;
  deprecated_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Subset of SensorCatalogEntry returned by the sensor_catalog_public view.
 * Used by org-level hooks — excludes internal fields like provenance,
 * decoder code, sample payloads, and admin notes.
 */
export interface SensorCatalogPublicEntry {
  id: string;
  manufacturer: string;
  model: string;
  model_variant: string | null;
  display_name: string;
  sensor_kind: SensorKind;
  description: string | null;
  frequency_bands: string[];
  supports_class: string;
  f_ports: SensorCatalogFPort[];
  decoded_fields: SensorCatalogDecodedField[];
  uplink_info: SensorCatalogUplinkInfo;
  battery_info: SensorCatalogBatteryInfo;
  is_supported: boolean;
  tags: string[];
  decode_mode: "ttn" | "trust" | "app" | "off";
  temperature_unit: "C" | "F";
}

export type DecodeMode = "ttn" | "trust" | "app" | "off";
export type TemperatureUnit = "C" | "F";

export interface SensorCatalogInsert {
  manufacturer: string;
  model: string;
  model_variant?: string | null;
  display_name: string;
  sensor_kind: SensorKind;
  description?: string | null;
  frequency_bands?: string[];
  lorawan_version?: string;
  supports_otaa?: boolean;
  supports_class?: string;
  f_ports?: SensorCatalogFPort[];
  decoded_fields?: SensorCatalogDecodedField[];
  sample_payloads?: SensorCatalogSamplePayload[];
  decoder_js?: string | null;
  uplink_info?: SensorCatalogUplinkInfo;
  battery_info?: SensorCatalogBatteryInfo;
  downlink_info?: SensorCatalogDownlinkInfo;
  is_supported?: boolean;
  tags?: string[];
  notes?: string | null;
}
