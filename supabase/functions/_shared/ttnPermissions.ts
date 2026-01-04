/**
 * TTN Permission Constants & Utilities
 * 
 * Single source of truth for:
 * - Required rights definitions
 * - Fetching actual rights from TTN /rights endpoint
 * - Computing permission reports
 * 
 * Used by: ttn-bootstrap, ttn-provision-device, ttn-provision-gateway
 */

// TTN regional Identity Server URLs
export const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
  as1: "https://as1.cloud.thethings.network",
};

// Required rights for FrostGuard TTN integration
// These MUST match the exact strings returned by TTN's /rights endpoint
export const REQUIRED_RIGHTS = {
  // Minimum required permissions for basic functionality
  core: [
    "RIGHT_APPLICATION_INFO",           // Read application info
    "RIGHT_APPLICATION_TRAFFIC_READ",   // Read uplink messages (critical!)
  ],
  // Required for webhook management
  webhook: [
    "RIGHT_APPLICATION_SETTINGS_BASIC", // Manage webhooks
  ],
  // Required for device management (optional but recommended)
  devices: [
    "RIGHT_APPLICATION_DEVICES_READ",
    "RIGHT_APPLICATION_DEVICES_WRITE",
  ],
  // Required for downlinks (optional)
  downlink: [
    "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
  ],
};

// Required rights for gateway provisioning
// NOTE: These require a USER-SCOPED or ORGANIZATION-SCOPED API key
// Application-scoped API keys CANNOT have gateway rights
export const GATEWAY_RIGHTS = {
  // Minimum required for gateway provisioning
  required: [
    "RIGHT_GATEWAY_INFO",             // Read gateway info
    "RIGHT_GATEWAY_SETTINGS_BASIC",   // Basic gateway config (create, update)
    "RIGHT_GATEWAY_LINK",             // Link gateway to network server
  ],
  // Optional but recommended
  extended: [
    "RIGHT_GATEWAY_STATUS_READ",      // Read gateway status
    "RIGHT_GATEWAY_LOCATION_READ",    // Read gateway location
    "RIGHT_GATEWAY_DELETE",           // Delete gateways
  ],
  // Alternative: grant all gateway rights
  all: "RIGHT_GATEWAY_ALL",
};

// Complete set of application rights for auto-provisioned key
export const APPLICATION_KEY_RIGHTS = [
  "RIGHT_APPLICATION_INFO",
  "RIGHT_APPLICATION_DEVICES_READ",
  "RIGHT_APPLICATION_DEVICES_WRITE",
  "RIGHT_APPLICATION_TRAFFIC_READ",
  "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
  "RIGHT_APPLICATION_SETTINGS_BASIC", // For webhook management
];

// Complete set of gateway rights for user-scoped gateway key
export const GATEWAY_KEY_RIGHTS = [
  "RIGHT_GATEWAY_INFO",
  "RIGHT_GATEWAY_SETTINGS_BASIC",
  "RIGHT_GATEWAY_SETTINGS_API_KEYS",
  "RIGHT_GATEWAY_LINK",
  "RIGHT_GATEWAY_STATUS_READ",
  "RIGHT_GATEWAY_LOCATION_READ",
  "RIGHT_GATEWAY_DELETE",
];

// Organization-level rights for org API key (used to create applications and app keys)
export const ORGANIZATION_KEY_RIGHTS = [
  "RIGHT_ORGANIZATION_INFO",
  "RIGHT_ORGANIZATION_SETTINGS_BASIC",
  "RIGHT_ORGANIZATION_APPLICATIONS_CREATE",
  "RIGHT_ORGANIZATION_APPLICATIONS_LIST",
  "RIGHT_APPLICATION_INFO",
  "RIGHT_APPLICATION_SETTINGS_BASIC",
  "RIGHT_APPLICATION_SETTINGS_API_KEYS",
  "RIGHT_APPLICATION_DEVICES_READ",
  "RIGHT_APPLICATION_DEVICES_WRITE",
  "RIGHT_APPLICATION_TRAFFIC_READ",
  "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
];

// Human-readable permission names for UI
export const PERMISSION_LABELS: Record<string, string> = {
  "RIGHT_APPLICATION_INFO": "Read application info",
  "RIGHT_APPLICATION_TRAFFIC_READ": "Read uplink messages",
  "RIGHT_APPLICATION_SETTINGS_BASIC": "Manage application settings (webhooks)",
  "RIGHT_APPLICATION_DEVICES_READ": "Read devices",
  "RIGHT_APPLICATION_DEVICES_WRITE": "Write devices",
  "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE": "Send downlink messages",
};

export interface PermissionReport {
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

export interface FetchRightsResult {
  success: boolean;
  rights?: string[];
  error?: string;
  hint?: string;
  statusCode?: number;
  method?: "direct" | "probe"; // Which method was used
}

/**
 * Fetch actual rights from TTN's /rights endpoint
 * This is the CORRECT way to get permissions - not probing endpoints
 */
export async function fetchTtnRights(
  cluster: string,
  applicationId: string,
  apiKey: string,
  requestId: string
): Promise<FetchRightsResult> {
  const baseUrl = REGIONAL_URLS[cluster] || REGIONAL_URLS.eu1;
  const rightsUrl = `${baseUrl}/api/v3/applications/${applicationId}/rights`;
  
  console.log(`[ttnPermissions] [${requestId}] Fetching rights from: ${rightsUrl}`);
  console.log(`[ttnPermissions] [${requestId}] API key last4: ...${apiKey.slice(-4)}`);
  
  try {
    const response = await fetch(rightsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ttnPermissions] [${requestId}] Rights fetch failed: ${response.status} ${errorText}`);
      
      // Parse TTN error for better messaging
      let ttnError: { code?: number; message?: string } = {};
      try {
        ttnError = JSON.parse(errorText);
      } catch {
        // Not JSON
      }
      
      if (response.status === 401) {
        return {
          success: false,
          error: "Invalid or expired API key",
          hint: "Generate a new API key in TTN Console → Applications → API keys",
          statusCode: 401,
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          error: "API key lacks permission to read rights",
          hint: `This API key cannot access application '${applicationId}'. Verify it was created for the correct application.`,
          statusCode: 403,
        };
      }
      
      if (response.status === 404) {
        return {
          success: false,
          error: "Application not found",
          hint: `Application '${applicationId}' doesn't exist on cluster '${cluster}'. Check the Application ID and cluster selection.`,
          statusCode: 404,
        };
      }
      
      return {
        success: false,
        error: `TTN API error (${response.status})`,
        hint: ttnError.message || errorText.slice(0, 200),
        statusCode: response.status,
      };
    }
    
    const data = await response.json();
    const rights = data.rights || [];
    
    console.log(`[ttnPermissions] [${requestId}] Fetched ${rights.length} rights from TTN:`, rights);
    
    return { 
      success: true, 
      rights,
      method: "direct",
    };
  } catch (fetchError) {
    console.error(`[ttnPermissions] [${requestId}] Network error:`, fetchError);
    return {
      success: false,
      error: "Network error connecting to TTN",
      hint: fetchError instanceof Error ? fetchError.message : "Check internet connectivity",
    };
  }
}

/**
 * Compute a detailed permission report from a list of rights
 * Uses exact string matching against REQUIRED_RIGHTS
 */
export function computePermissionReport(rights: string[]): PermissionReport {
  const missing_core = REQUIRED_RIGHTS.core.filter(r => !rights.includes(r));
  const missing_webhook = REQUIRED_RIGHTS.webhook.filter(r => !rights.includes(r));
  const missing_devices = REQUIRED_RIGHTS.devices.filter(r => !rights.includes(r));
  const missing_downlink = REQUIRED_RIGHTS.downlink.filter(r => !rights.includes(r));
  
  const report: PermissionReport = {
    valid: missing_core.length === 0,
    rights,
    missing_core,
    missing_webhook,
    missing_devices,
    missing_downlink,
    can_configure_webhook: missing_webhook.length === 0,
    can_manage_devices: missing_devices.length === 0,
    can_send_downlinks: missing_downlink.length === 0,
  };
  
  console.log(`[ttnPermissions] Permission report:`, {
    valid: report.valid,
    rightsCount: rights.length,
    missingCore: missing_core,
    canWebhook: report.can_configure_webhook,
    canDevices: report.can_manage_devices,
  });
  
  return report;
}

/**
 * Validate API key and return both the fetched rights and computed report
 * This is the main entry point for permission checking
 */
export async function validateAndAnalyzePermissions(
  cluster: string,
  applicationId: string,
  apiKey: string,
  requestId: string
): Promise<{ 
  success: boolean; 
  report?: PermissionReport; 
  error?: string; 
  hint?: string;
  statusCode?: number;
}> {
  // Fetch actual rights from TTN
  const rightsResult = await fetchTtnRights(cluster, applicationId, apiKey, requestId);
  
  if (!rightsResult.success) {
    return {
      success: false,
      error: rightsResult.error,
      hint: rightsResult.hint,
      statusCode: rightsResult.statusCode,
    };
  }
  
  // Compute permission report
  const report = computePermissionReport(rightsResult.rights || []);
  
  return {
    success: true,
    report,
  };
}
