/**
 * TTN Error Mapper
 * Maps backend error codes to user-friendly messages with fix guidance
 */

export interface TTNErrorGuidance {
  message: string;
  howToFix: string;
  consoleSteps: string[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * Map of known TTN error codes to user guidance
 */
const ERROR_MAP: Record<string, TTNErrorGuidance> = {
  // Authentication & Permission Errors
  TTN_FORBIDDEN: {
    message: 'TTN rejected the request due to insufficient permissions',
    howToFix: 'Your API key doesn\'t have the required permissions',
    consoleSteps: [
      '1. Go to TTN Console → your username → Personal API keys',
      '2. Create a new key or edit existing',
      '3. Select "Grant all current and future rights" or add specific rights',
      '4. Copy the new key and update it in FrostGuard',
    ],
    severity: 'error',
  },
  TTN_UNAUTHORIZED: {
    message: 'TTN authentication failed',
    howToFix: 'Your API key is invalid or expired',
    consoleSteps: [
      '1. Go to TTN Console → your username → Personal API keys',
      '2. Verify the key exists and hasn\'t been revoked',
      '3. Generate a new key if needed',
      '4. Update the key in FrostGuard settings',
    ],
    severity: 'error',
  },
  TTN_KEY_INVALID: {
    message: 'API key lacks permission to access this application',
    howToFix: 'The key must be created inside the target application (not another app or user-level)',
    consoleSteps: [
      '1. Go to TTN Console → Applications → {application_id}',
      '2. Navigate to API Keys (left sidebar)',
      '3. Click "+ Add API Key"',
      '4. Name it "FrostGuard Integration"',
      '5. Select "Grant all current and future rights" OR add specific rights',
      '6. Click "Create API Key" and copy the full key immediately',
      '7. Paste the key in FrostGuard and re-validate',
    ],
    severity: 'error',
  },
  TTN_KEY_FORMAT_INVALID: {
    message: 'The API key format is invalid',
    howToFix: 'The key doesn\'t appear to be a valid TTN API key',
    consoleSteps: [
      '1. TTN API keys start with "NNSXS."',
      '2. Go to TTN Console → Your App → API Keys',
      '3. Copy the full key value (it\'s only shown once)',
      '4. Paste it carefully without extra spaces',
    ],
    severity: 'error',
  },

  // Application Errors
  APPLICATION_NOT_FOUND: {
    message: 'The TTN application was not found',
    howToFix: 'The application ID doesn\'t exist in this TTN cluster',
    consoleSteps: [
      '1. Go to TTN Console → Applications',
      '2. Verify the application exists',
      '3. Check you\'re using the correct cluster (EU1, NAM1, etc.)',
      '4. Copy the exact Application ID from the console',
    ],
    severity: 'error',
  },
  CLUSTER_MISMATCH: {
    message: 'Application not found in the selected cluster',
    howToFix: 'Your application may be in a different TTN region',
    consoleSteps: [
      '1. Check the TTN Console URL (eu1, nam1, au1, etc.)',
      '2. Select the matching cluster in FrostGuard',
      '3. Applications are region-specific and can\'t be accessed cross-region',
    ],
    severity: 'error',
  },

  // Webhook Errors
  WEBHOOK_CREATE_FAILED: {
    message: 'Failed to create the webhook in TTN',
    howToFix: 'Check your API key has webhook permissions',
    consoleSteps: [
      '1. Verify your API key includes "applications" write permissions',
      '2. Go to TTN Console → Your App → Integrations → Webhooks',
      '3. Check if a webhook already exists (there may be a conflict)',
      '4. Try creating the webhook manually if issues persist',
    ],
    severity: 'error',
  },
  WEBHOOK_UPDATE_FAILED: {
    message: 'Failed to update the existing webhook',
    howToFix: 'The webhook may have been modified or deleted',
    consoleSteps: [
      '1. Go to TTN Console → Your App → Integrations → Webhooks',
      '2. Check the FrostGuard webhook status',
      '3. Delete it and let FrostGuard recreate it',
      '4. Or manually update the webhook URL',
    ],
    severity: 'warning',
  },

  // Device Errors
  DEVICE_NOT_FOUND: {
    message: 'Device not registered in TTN',
    howToFix: 'The sensor needs to be registered in your TTN application',
    consoleSteps: [
      '1. Go to TTN Console → Your App → End devices',
      '2. Click "+ Register end device"',
      '3. Enter the device\'s DevEUI, AppEUI, and AppKey',
      '4. Use the same DevEUI shown in FrostGuard',
    ],
    severity: 'error',
  },
  DEVICE_PROVISION_FAILED: {
    message: 'Failed to register the device in TTN',
    howToFix: 'Check device credentials and API key permissions',
    consoleSteps: [
      '1. Verify DevEUI is unique (not already registered)',
      '2. Check AppEUI and AppKey are correctly formatted',
      '3. Ensure API key has "devices" write permission',
      '4. Try registering the device manually in TTN Console',
    ],
    severity: 'error',
  },

  // Gateway Errors
  GATEWAY_PROVISION_FAILED: {
    message: 'Failed to register the gateway in TTN',
    howToFix: 'Gateway may already be registered or API key lacks permissions',
    consoleSteps: [
      '1. Go to TTN Console → Gateways',
      '2. Check if the gateway EUI is already registered',
      '3. Ensure your API key has gateway permissions',
      '4. If already registered to another account, contact TTN support',
    ],
    severity: 'error',
  },

  // General Errors
  NETWORK_ERROR: {
    message: 'Unable to reach TTN servers',
    howToFix: 'Check your internet connection and try again',
    consoleSteps: [
      '1. Verify you have internet connectivity',
      '2. Check if TTN Console is accessible in your browser',
      '3. Try again in a few minutes (TTN may have temporary issues)',
      '4. Check status.thethings.industries for outages',
    ],
    severity: 'warning',
  },
  RATE_LIMITED: {
    message: 'Too many requests to TTN',
    howToFix: 'Wait a moment and try again',
    consoleSteps: [
      '1. Wait 30-60 seconds before retrying',
      '2. Avoid rapid repeated requests',
      '3. If persistent, check TTN rate limit documentation',
    ],
    severity: 'warning',
  },
  INTERNAL_ERROR: {
    message: 'An unexpected error occurred',
    howToFix: 'Try again or contact support if the issue persists',
    consoleSteps: [
      '1. Refresh the page and try again',
      '2. Check the browser console for details',
      '3. Download TTN Diagnostics for support',
      '4. Contact support with the diagnostics file',
    ],
    severity: 'error',
  },

  // Validation Errors
  ORG_FORBIDDEN: {
    message: 'You don\'t have permission to configure TTN for this organization',
    howToFix: 'Only organization owners and admins can configure TTN',
    consoleSteps: [
      '1. Contact your organization owner',
      '2. Request admin or owner role',
      '3. Then return to TTN settings',
    ],
    severity: 'error',
  },
  NO_ORGANIZATION_RIGHTS: {
    message: 'No rights to the TTN organization',
    howToFix: 'The TTN organization exists but the current key has no access rights',
    consoleSteps: [
      '1. The organization may have been created under another account',
      '2. Verify your TTN admin key has organization management rights',
      '3. Use "Start Fresh" to create a new organization',
      '4. Or contact TTN support if you believe you should have access',
    ],
    severity: 'error',
  },
  MISSING_FIELDS: {
    message: 'Required configuration fields are missing',
    howToFix: 'Fill in all required fields',
    consoleSteps: [
      '1. Cluster selection is required',
      '2. Application ID is required',
      '3. API Key is required for full functionality',
    ],
    severity: 'error',
  },
};

/**
 * Map a TTN error code to user-friendly guidance
 */
export function mapTTNErrorToGuidance(
  errorCode: string,
  statusCode?: number,
  errorMessage?: string
): TTNErrorGuidance {
  // Try direct code match first
  if (ERROR_MAP[errorCode]) {
    return ERROR_MAP[errorCode];
  }

  // Map HTTP status codes to common errors
  if (statusCode) {
    switch (statusCode) {
      case 401:
        return ERROR_MAP.TTN_UNAUTHORIZED;
      case 403:
        return ERROR_MAP.TTN_FORBIDDEN;
      case 404:
        return ERROR_MAP.APPLICATION_NOT_FOUND;
      case 429:
        return ERROR_MAP.RATE_LIMITED;
      case 500:
      case 502:
      case 503:
        return {
          message: 'TTN service temporarily unavailable',
          howToFix: 'The TTN servers may be experiencing issues',
          consoleSteps: [
            '1. Wait a few minutes and try again',
            '2. Check status.thethings.industries',
            '3. If persistent, contact TTN support',
          ],
          severity: 'warning',
        };
    }
  }

  // Fallback for unknown errors
  return {
    message: errorMessage || `Unknown error: ${errorCode}`,
    howToFix: 'Try again or download diagnostics for support',
    consoleSteps: [
      '1. Refresh the page and retry',
      '2. Download TTN Diagnostics',
      '3. Contact support with the error details',
    ],
    severity: 'error',
  };
}

/**
 * Format error guidance for display
 */
export function formatErrorForDisplay(guidance: TTNErrorGuidance): {
  title: string;
  description: string;
  steps: string[];
} {
  return {
    title: guidance.message,
    description: guidance.howToFix,
    steps: guidance.consoleSteps,
  };
}
