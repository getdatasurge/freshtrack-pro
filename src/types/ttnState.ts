/**
 * TTN Config State Machine Types
 * Defines the canonical state model for TTN configuration
 */

/**
 * TTN configuration states following a clear state machine model:
 * - local_draft: User has entered values but not validated/saved
 * - validated: Passed validate_only check, ready to save
 * - canonical: Saved to FrostGuard DB, authoritative source
 * - drifted: Local config differs from canonical (potential conflict)
 * - invalid: Failed validation, cannot be used
 */
export type TTNConfigState = 
  | 'local_draft'
  | 'validated'
  | 'canonical'
  | 'drifted'
  | 'invalid';

/**
 * Source of the TTN configuration
 */
export type TTNConfigSource = 'LOCAL' | 'FROSTGUARD' | 'EMULATOR';

/**
 * Permission matrix from TTN API key validation
 */
export interface TTNPermissions {
  applications_read: boolean;
  applications_write: boolean;
  devices_read: boolean;
  devices_write: boolean;
  gateways_read: boolean;
  gateways_write: boolean;
  webhooks_write: boolean;
  can_configure_webhook: boolean;
  can_manage_devices: boolean;
  can_provision_gateways: boolean;
  rights: string[];
}

/**
 * Result of a TTN configuration validation
 */
export interface TTNValidationResult {
  valid: boolean;
  api_key_type: 'personal' | 'application' | 'organization' | 'unknown';
  permissions: TTNPermissions | null;
  missing_permissions: string[];
  invalid_fields: string[];
  warnings: string[];
  resolved: {
    cluster: string;
    application_id: string;
    organization_id: string;
  };
  request_id: string;
  validated_at: string;
}

/**
 * Current TTN configuration context state
 */
export interface TTNConfigContext {
  state: TTNConfigState;
  source: TTNConfigSource;
  last_validated_at: string | null;
  last_validation_result: TTNValidationResult | null;
  canonical_hash: string | null;
  local_hash: string | null;
  request_id: string | null;
  error_message: string | null;
}

/**
 * TTN Configuration values (the actual config data)
 */
export interface TTNConfigValues {
  cluster: string;
  application_id: string;
  api_key: string;
  api_key_last4: string | null;
  webhook_url: string | null;
  webhook_secret_last4: string | null;
  is_enabled: boolean;
}

/**
 * Initial/empty TTN config context
 */
export const INITIAL_TTN_CONFIG_CONTEXT: TTNConfigContext = {
  state: 'local_draft',
  source: 'LOCAL',
  last_validated_at: null,
  last_validation_result: null,
  canonical_hash: null,
  local_hash: null,
  request_id: null,
  error_message: null,
};

/**
 * State transition rules
 */
export const TTN_STATE_TRANSITIONS = {
  local_draft: ['validated', 'invalid'],
  validated: ['canonical', 'local_draft', 'invalid'],
  canonical: ['drifted', 'validated', 'invalid'],
  drifted: ['validated', 'canonical', 'invalid'],
  invalid: ['local_draft', 'validated'],
} as const;

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(
  from: TTNConfigState, 
  to: TTNConfigState
): boolean {
  const allowed = TTN_STATE_TRANSITIONS[from] as readonly TTNConfigState[];
  return allowed.includes(to);
}

/**
 * Generate a simple hash of config values for drift detection
 */
export function hashConfigValues(values: Partial<TTNConfigValues>): string {
  const normalized = JSON.stringify({
    cluster: values.cluster || '',
    application_id: values.application_id || '',
    api_key_last4: values.api_key_last4 || '',
    is_enabled: values.is_enabled || false,
  });
  
  // Simple hash for drift detection (not cryptographic)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
