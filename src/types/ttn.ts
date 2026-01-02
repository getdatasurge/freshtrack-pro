/**
 * TTN Provisioning Types
 * Types for gateways and LoRa sensors
 */

export type GatewayStatus = 'pending' | 'online' | 'offline' | 'maintenance';

export interface Gateway {
  id: string;
  organization_id: string;
  site_id: string | null;
  gateway_eui: string;
  name: string;
  description: string | null;
  status: GatewayStatus;
  last_seen_at: string | null;
  ttn_application_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LoraSensorType = 'temperature' | 'temperature_humidity' | 'door' | 'combo' | 'contact';
export type LoraSensorStatus = 'pending' | 'joining' | 'active' | 'offline' | 'fault';

export interface LoraSensor {
  id: string;
  organization_id: string;
  site_id: string | null;
  unit_id: string | null;
  dev_eui: string;
  app_eui: string | null;
  app_key: string | null;
  ttn_device_id: string | null;
  ttn_application_id: string | null;
  name: string;
  description: string | null;
  sensor_type: LoraSensorType;
  manufacturer: string | null;
  model: string | null;
  firmware_version: string | null;
  status: LoraSensorStatus;
  battery_level: number | null;
  signal_strength: number | null;
  last_seen_at: string | null;
  last_join_at: string | null;
  is_primary: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GatewayInsert {
  organization_id: string;
  gateway_eui: string;
  name: string;
  site_id?: string | null;
  description?: string | null;
  status?: GatewayStatus;
  ttn_application_id?: string | null;
  created_by?: string | null;
}

export interface LoraSensorInsert {
  organization_id: string;
  dev_eui: string;
  name: string;
  site_id?: string | null;
  unit_id?: string | null;
  app_eui?: string | null;
  app_key?: string | null;
  ttn_device_id?: string | null;
  ttn_application_id?: string | null;
  description?: string | null;
  sensor_type?: LoraSensorType;
  manufacturer?: string | null;
  model?: string | null;
  created_by?: string | null;
}
