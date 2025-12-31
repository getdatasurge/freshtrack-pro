/**
 * TTN Error Configuration
 * Maps TTN API errors to user-friendly messages with actionable guidance
 */

export interface TTNErrorInfo {
  title: string;
  description: string;
  action: string;
  severity: 'info' | 'warning' | 'error';
}

export const TTN_ERROR_MAP: Record<string, TTNErrorInfo> = {
  CLUSTER_MISMATCH: {
    title: "Region Mismatch",
    description: "Your Application ID exists on a different TTN cluster than selected.",
    action: "Select the correct region that matches where your gateway is registered.",
    severity: 'error',
  },
  APP_NOT_FOUND: {
    title: "Application Not Found",
    description: "The TTN application could not be found on the selected cluster.",
    action: "Verify the Application ID and ensure you've selected the correct TTN region.",
    severity: 'error',
  },
  API_KEY_INVALID: {
    title: "Invalid API Key",
    description: "The TTN API key is invalid or has expired.",
    action: "Generate a new API key in TTN Console → Applications → API keys.",
    severity: 'error',
  },
  API_KEY_PERMISSIONS: {
    title: "Insufficient Permissions",
    description: "Your API key lacks the required permissions for device management.",
    action: "Create a new key with: applications:read, end_devices:read, end_devices:write.",
    severity: 'error',
  },
  DEVICE_NOT_FOUND: {
    title: "Device Not Registered",
    description: "This device is not registered in The Things Network.",
    action: "Provision this sensor to TTN using the cloud upload button, or manually register it in TTN Console.",
    severity: 'warning',
  },
  DEVICE_NOT_JOINED: {
    title: "Device Not Joined",
    description: "Device is registered but has not completed the LoRaWAN join process.",
    action: "Ensure the device is powered on and within range of an active gateway.",
    severity: 'info',
  },
  WEBHOOK_UNREACHABLE: {
    title: "Webhook Unreachable",
    description: "TTN could not deliver uplinks to the FrostGuard webhook endpoint.",
    action: "Verify the webhook URL in TTN Console → Applications → Integrations → Webhooks.",
    severity: 'error',
  },
  WEBHOOK_SECRET_MISMATCH: {
    title: "Webhook Secret Mismatch",
    description: "The webhook secret does not match what TTN is sending.",
    action: "Update the webhook secret in Settings → Developer → TTN Connection to match TTN Console.",
    severity: 'error',
  },
  NETWORK_ERROR: {
    title: "Network Connection Failed",
    description: "Could not connect to The Things Network servers.",
    action: "Check your internet connection and try again. If the issue persists, TTN may be experiencing issues.",
    severity: 'error',
  },
  NO_API_KEY: {
    title: "API Key Required",
    description: "No TTN API key has been configured.",
    action: "Add a TTN API key in Settings → Developer → TTN Connection.",
    severity: 'warning',
  },
  TTN_NOT_CONFIGURED: {
    title: "TTN Not Configured",
    description: "The Things Network integration has not been set up for this organization.",
    action: "Complete the TTN Setup Wizard to enable LoRaWAN device management.",
    severity: 'info',
  },
  NO_UPLINK: {
    title: "No Uplinks Received",
    description: "Device has never sent data since registration.",
    action: "Confirm the device is powered on and has completed OTAA join. Check gateway coverage.",
    severity: 'warning',
  },
};

/**
 * Get user-friendly error info from TTN API response
 */
export function getTTNErrorInfo(statusCode: number, errorMessage?: string): TTNErrorInfo {
  // Map HTTP status codes to error types
  if (statusCode === 401) {
    return TTN_ERROR_MAP.API_KEY_INVALID;
  }
  if (statusCode === 403) {
    return TTN_ERROR_MAP.API_KEY_PERMISSIONS;
  }
  if (statusCode === 404) {
    // Check if it's a device or app not found
    if (errorMessage?.toLowerCase().includes('device') || errorMessage?.toLowerCase().includes('end device')) {
      return TTN_ERROR_MAP.DEVICE_NOT_FOUND;
    }
    return TTN_ERROR_MAP.APP_NOT_FOUND;
  }
  if (statusCode >= 500) {
    return TTN_ERROR_MAP.NETWORK_ERROR;
  }

  // Default error
  return {
    title: "TTN Error",
    description: errorMessage || `Unexpected error (${statusCode})`,
    action: "Check TTN Console for more details or contact support.",
    severity: 'error',
  };
}

/**
 * TTN Wizard Step definitions
 */
export interface TTNWizardStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  error?: string;
}

export const TTN_WIZARD_STEPS: Omit<TTNWizardStep, 'isComplete' | 'isActive' | 'error'>[] = [
  {
    id: 'cluster',
    title: 'Select TTN Cluster',
    description: 'Choose the region where your TTN application is registered.',
  },
  {
    id: 'application',
    title: 'Verify Application',
    description: 'Confirm access to the TTN application.',
  },
  {
    id: 'apikey',
    title: 'Configure API Key',
    description: 'Add an API key with device management permissions.',
  },
  {
    id: 'device',
    title: 'Device Registration',
    description: 'Register your sensor device in TTN.',
  },
  {
    id: 'webhook',
    title: 'Configure Webhook',
    description: 'Set up the uplink webhook in TTN Console.',
  },
  {
    id: 'verify',
    title: 'Final Verification',
    description: 'Test the complete data path.',
  },
];

/**
 * TTN Region configuration
 */
export const TTN_REGIONS = [
  { value: 'nam1', label: 'North America (nam1)', url: 'https://nam1.cloud.thethings.network' },
  { value: 'eu1', label: 'Europe (eu1)', url: 'https://eu1.cloud.thethings.network' },
  { value: 'au1', label: 'Australia (au1)', url: 'https://au1.cloud.thethings.network' },
  { value: 'as1', label: 'Asia (as1)', url: 'https://as1.cloud.thethings.network' },
] as const;

export type TTNRegion = typeof TTN_REGIONS[number]['value'];

/**
 * Get TTN Console URL for a given region
 */
export function getTTNConsoleUrl(region: TTNRegion): string {
  const regionConfig = TTN_REGIONS.find(r => r.value === region);
  return regionConfig ? regionConfig.url : TTN_REGIONS[0].url;
}
