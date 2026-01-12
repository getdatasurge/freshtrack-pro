import { EdgeFunctionInfo } from './types';

/**
 * Comprehensive list of all Edge Functions with their health check configuration.
 * 
 * Check methods:
 * - GET: Function supports GET requests for health checks
 * - POST: Function only accepts POST, but we can test with empty body
 * - skip: Function cannot be tested without side effects or auth
 */
export const EDGE_FUNCTIONS: EdgeFunctionInfo[] = [
  // TTN Integration Functions
  {
    name: 'ttn-webhook',
    description: 'Receives uplinks from The Things Network',
    checkMethod: 'skip',
    critical: true,
    skipReason: 'Webhook endpoint, requires valid TTN payload',
  },
  {
    name: 'ttn-provision-device',
    description: 'Provisions sensors to TTN application',
    checkMethod: 'GET',
    critical: true,
  },
  {
    name: 'ttn-provision-gateway',
    description: 'Provisions gateways to TTN',
    checkMethod: 'GET',
    critical: false,
  },
  {
    name: 'ttn-manage-application',
    description: 'Manages TTN application settings',
    checkMethod: 'GET',
    critical: true,
  },
  {
    name: 'ttn-provision-org',
    description: 'Creates TTN application for organization',
    checkMethod: 'GET',
    critical: false,
  },
  {
    name: 'ttn-list-devices',
    description: 'Lists devices from TTN application',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Requires authentication',
  },
  {
    name: 'ttn-bootstrap',
    description: 'Bootstraps TTN configuration',
    checkMethod: 'GET',
    critical: false,
  },
  {
    name: 'ttn-deprovision-worker',
    description: 'Background worker for TTN cleanup',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Background job, no health endpoint',
  },

  // Sync Functions
  {
    name: 'sync-ttn-settings',
    description: 'Syncs TTN settings from Emulator',
    checkMethod: 'GET',
    critical: true,
  },
  {
    name: 'emulator-sync',
    description: 'Receives sync bundles from Emulator',
    checkMethod: 'GET',
    critical: true,
  },
  {
    name: 'org-state-api',
    description: 'Pull-based org state for Emulator',
    checkMethod: 'GET',
    critical: true,
  },
  {
    name: 'fetch-org-state',
    description: 'Fetches organization TTN state',
    checkMethod: 'GET',
    critical: false,
  },
  {
    name: 'user-sync-emitter',
    description: 'Emits user sync events to Emulator',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Triggered by database, no direct endpoint',
  },

  // Data Processing Functions
  {
    name: 'ingest-readings',
    description: 'Ingests sensor readings',
    checkMethod: 'GET',
    critical: true,
  },
  {
    name: 'process-unit-states',
    description: 'Processes unit state changes',
    checkMethod: 'GET',
    critical: true,
  },
  {
    name: 'process-escalations',
    description: 'Processes alert escalations',
    checkMethod: 'GET',
    critical: true,
  },

  // Simulator Functions
  {
    name: 'sensor-simulator',
    description: 'Generates simulated sensor readings',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Requires authentication',
  },
  {
    name: 'run-simulator-heartbeats',
    description: 'Scheduled simulator heartbeats',
    checkMethod: 'GET',
    critical: false,
  },

  // Notification Functions
  {
    name: 'send-sms-alert',
    description: 'Sends SMS alerts via Telnyx',
    checkMethod: 'skip',
    critical: true,
    skipReason: 'Would send actual SMS',
  },

  // Utility Functions
  {
    name: 'export-temperature-logs',
    description: 'Exports temperature logs to CSV',
    checkMethod: 'GET',
    critical: false,
  },
  {
    name: 'check-password-breach',
    description: 'Checks password against breach database',
    checkMethod: 'GET',
    critical: false,
  },
  {
    name: 'check-slug-available',
    description: 'Checks if organization slug is available',
    checkMethod: 'GET',
    critical: false,
  },
  {
    name: 'cleanup-user-sensors',
    description: 'Cleans up sensors on user deletion',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Destructive action',
  },
  {
    name: 'update-sensor-assignment',
    description: 'Updates sensor assignments from Emulator',
    checkMethod: 'GET',
    critical: false,
  },

  // Stripe Functions
  {
    name: 'stripe-checkout',
    description: 'Creates Stripe checkout session',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Requires authentication',
  },
  {
    name: 'stripe-webhook',
    description: 'Receives Stripe webhook events',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Webhook endpoint, requires valid Stripe payload',
  },
  {
    name: 'stripe-portal',
    description: 'Creates Stripe customer portal session',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Requires authentication',
  },

  // Health Check (self-referential)
  {
    name: 'health-check',
    description: 'Database and system health check',
    checkMethod: 'GET',
    critical: true,
  },

  // TTN Webhook Management
  {
    name: 'update-ttn-webhook',
    description: 'Updates TTN webhook configuration',
    checkMethod: 'skip',
    critical: false,
    skipReason: 'Requires authentication and POST',
  },
];

/**
 * Get functions that support GET health checks
 */
export function getTestableEdgeFunctions(): EdgeFunctionInfo[] {
  return EDGE_FUNCTIONS.filter(f => f.checkMethod === 'GET');
}

/**
 * Get functions that should be skipped
 */
export function getSkippedEdgeFunctions(): EdgeFunctionInfo[] {
  return EDGE_FUNCTIONS.filter(f => f.checkMethod === 'skip');
}

/**
 * Get critical functions only
 */
export function getCriticalEdgeFunctions(): EdgeFunctionInfo[] {
  return EDGE_FUNCTIONS.filter(f => f.critical);
}
