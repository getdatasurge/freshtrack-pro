/**
 * TTN Operation Guards
 * Unified guard functions to prevent operations on invalid/unvalidated configs
 */

import type { TTNConfigContext, TTNConfigState } from '@/types/ttnState';

export interface TTNBlocker {
  code: string;
  message: string;
  howToFix: string;
  fixSteps: string[];
}

export interface TTNGuardResult {
  allowed: boolean;
  blockers: TTNBlocker[];
  warnings: string[];
}

export type TTNOperation = 
  | 'simulate'
  | 'provision_gateway'
  | 'provision_sensor'
  | 'configure_webhook'
  | 'test_connection';

/**
 * States that allow TTN operations
 */
const ALLOWED_STATES: TTNConfigState[] = ['validated', 'canonical'];

/**
 * Permission requirements by operation
 */
const OPERATION_REQUIREMENTS: Record<TTNOperation, string[]> = {
  simulate: ['devices_read', 'webhooks_write'],
  provision_gateway: ['gateways_read', 'gateways_write'],
  provision_sensor: ['devices_read', 'devices_write'],
  configure_webhook: ['webhooks_write', 'applications_write'],
  test_connection: ['applications_read'],
};

/**
 * Human-readable operation labels
 */
const OPERATION_LABELS: Record<TTNOperation, string> = {
  simulate: 'Start Simulation',
  provision_gateway: 'Provision Gateway',
  provision_sensor: 'Provision Sensor',
  configure_webhook: 'Configure Webhook',
  test_connection: 'Test Connection',
};

/**
 * Check if a TTN operation is allowed based on current config context
 */
export function checkTTNOperationAllowed(
  operation: TTNOperation,
  context: TTNConfigContext | null
): TTNGuardResult {
  const blockers: TTNBlocker[] = [];
  const warnings: string[] = [];

  // No context at all
  if (!context) {
    blockers.push({
      code: 'NO_CONFIG',
      message: 'TTN configuration not loaded',
      howToFix: 'Navigate to Settings → Developer → TTN Connection to configure TTN',
      fixSteps: [
        'Go to Settings → Developer',
        'Open the TTN Connection section',
        'Enter your TTN credentials',
        'Click "Validate Configuration"',
      ],
    });
    return { allowed: false, blockers, warnings };
  }

  // Check state
  if (!ALLOWED_STATES.includes(context.state)) {
    const stateBlocker = getStateBlocker(context.state, operation);
    blockers.push(stateBlocker);
  }

  // Check permissions for the operation
  const requiredPermissions = OPERATION_REQUIREMENTS[operation];
  const permissions = context.last_validation_result?.permissions;

  if (permissions && requiredPermissions.length > 0) {
    const missingPerms: string[] = [];

    for (const perm of requiredPermissions) {
      const permKey = perm as keyof typeof permissions;
      if (permKey in permissions && !permissions[permKey]) {
        missingPerms.push(perm);
      }
    }

    if (missingPerms.length > 0) {
      blockers.push({
        code: 'MISSING_PERMISSIONS',
        message: `Missing required permissions for ${OPERATION_LABELS[operation]}`,
        howToFix: 'Update your TTN API key to include the required permissions',
        fixSteps: [
          'Go to TTN Console → Your Profile → Personal API Keys',
          'Create a new API key with "Grant all current and future rights"',
          'Or select specific rights: ' + missingPerms.join(', '),
          'Update the API key in Settings → Developer → TTN Connection',
        ],
      });
    }
  }

  // Add warnings for potentially problematic states
  if (context.state === 'drifted') {
    warnings.push('Local configuration differs from saved version. Re-validate before proceeding.');
  }

  if (context.last_validation_result?.warnings) {
    warnings.push(...context.last_validation_result.warnings);
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
  };
}

/**
 * Get appropriate blocker for a config state
 */
function getStateBlocker(state: TTNConfigState, operation: TTNOperation): TTNBlocker {
  switch (state) {
    case 'local_draft':
      return {
        code: 'CONFIG_NOT_VALIDATED',
        message: 'TTN configuration must be validated before proceeding',
        howToFix: 'Click "Validate Configuration" to verify your settings',
        fixSteps: [
          'Go to Settings → Developer → TTN Connection',
          'Click the "Validate Configuration" button',
          'Fix any errors shown',
          `Then retry ${OPERATION_LABELS[operation]}`,
        ],
      };

    case 'invalid':
      return {
        code: 'CONFIG_INVALID',
        message: 'TTN configuration failed validation',
        howToFix: 'Fix the validation errors and re-validate',
        fixSteps: [
          'Go to Settings → Developer → TTN Connection',
          'Review the validation errors shown',
          'Correct the configuration',
          'Click "Validate Configuration" again',
        ],
      };

    case 'drifted':
      return {
        code: 'CONFIG_DRIFTED',
        message: 'Local config differs from saved version',
        howToFix: 'Re-validate the configuration to sync changes',
        fixSteps: [
          'Go to Settings → Developer → TTN Connection',
          'Review your changes',
          'Click "Validate Configuration"',
          'Then "Save & Configure Webhook"',
        ],
      };

    default:
      return {
        code: 'UNKNOWN_STATE',
        message: `Configuration in unexpected state: ${state}`,
        howToFix: 'Refresh the page and try again',
        fixSteps: ['Refresh the page', 'Navigate to TTN settings', 'Re-validate configuration'],
      };
  }
}

/**
 * Get a user-friendly summary of guard result
 */
export function getGuardSummary(result: TTNGuardResult): string {
  if (result.allowed) {
    if (result.warnings.length > 0) {
      return `Allowed with ${result.warnings.length} warning(s)`;
    }
    return 'Ready';
  }
  
  if (result.blockers.length === 1) {
    return result.blockers[0].message;
  }
  
  return `${result.blockers.length} issue(s) must be resolved`;
}

/**
 * Check if operation requires specific permissions
 */
export function getRequiredPermissions(operation: TTNOperation): string[] {
  return OPERATION_REQUIREMENTS[operation] || [];
}
