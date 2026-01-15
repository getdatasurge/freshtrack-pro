/**
 * TTN Provisioning Types
 * Types for gateways and LoRa sensors
 */

// TTN Provisioning State - tracks whether device exists in TTN
export type TtnProvisioningState =
  | "not_configured"
  | "unknown"
  | "exists_in_ttn"
  | "missing_in_ttn"
  | "error";

// Where the device was provisioned from
export type ProvisionedSource = "emulator" | "app" | "unknown" | "manual";

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
  ttn_cluster: string | null;
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
  deleted_at: string | null;
  deleted_by: string | null;
  // TTN provisioning detection fields
  provisioning_state: TtnProvisioningState;
  last_provision_check_at: string | null;
  last_provision_check_error: string | null;
  provisioned_source: ProvisionedSource | null;
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
  ttn_cluster?: string | null;
  description?: string | null;
  sensor_type?: LoraSensorType;
  manufacturer?: string | null;
  model?: string | null;
  created_by?: string | null;
  provisioning_state?: TtnProvisioningState;
  provisioned_source?: ProvisionedSource | null;
}

// ============================================================================
// TTN Bootstrap Types
// Types for the automated webhook setup flow
// ============================================================================

export interface TTNPermissionCheckResult {
  valid: boolean;
  rights: string[];
  missing_core: string[];
  missing_webhook: string[];
  missing_devices: string[];
  missing_downlink: string[];
  can_configure_webhook: boolean;
  can_manage_devices: boolean;
  can_send_downlinks: boolean;
}

export interface TTNWebhookConfig {
  webhook_id: string;
  base_url: string;
  format: string;
  events_enabled: string[];
  secret_configured: boolean;
}

export interface TTNBootstrapError {
  code: string;
  message: string;
  hint: string;
  missing_permissions?: string[];
}

export interface TTNBootstrapConfig {
  api_key_last4: string;
  webhook_secret_last4: string;
  webhook_url: string;
  application_id: string;
  cluster: string;
  updated_at: string;
}

export interface TTNBootstrapResult {
  ok: boolean;
  request_id: string;
  action: 'validate' | 'configure' | 'save_and_configure';

  // Permission validation results
  permissions?: TTNPermissionCheckResult;

  // Webhook configuration results
  webhook?: TTNWebhookConfig;
  webhook_action?: 'created' | 'updated' | 'unchanged';

  // Error information
  error?: TTNBootstrapError;

  // Stored configuration metadata
  config?: TTNBootstrapConfig;
}

export interface TTNOrgState {
  enabled: boolean;
  cluster: string | null;
  application_id: string | null;
  api_key_last4: string | null;
  api_key_updated_at: string | null;
  webhook_secret_last4: string | null;
  webhook_url: string | null;
  webhook_id: string | null;
  webhook_events: string[] | null;
  provisioning_status: string;
  updated_at: string | null;
  last_updated_source: string | null;
  synced_from_frostguard: boolean;
}

export interface FetchOrgStateResponse {
  ok: boolean;
  request_id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  ttn: TTNOrgState;
  _meta: {
    version: string;
    timestamp: string;
  };
}
