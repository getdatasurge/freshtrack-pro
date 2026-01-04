/**
 * TTN Permission Constants & Utilities
 * 
 * ARCHITECTURE:
 * - MAIN_USER_KEY_REQUIRED_RIGHTS: Rights the Main User API Key must have for ALL provisioning
 * - ORGANIZATION_KEY_RIGHTS: Rights granted to per-org API keys (output artifacts for runtime)
 * - APPLICATION_KEY_RIGHTS: Rights granted to per-app API keys (output artifacts for runtime)
 * 
 * CRITICAL: The Main User API Key (TTN_ADMIN_API_KEY) is used for ALL provisioning steps.
 * Created Org/App API keys are OUTPUT ARTIFACTS for runtime use, NOT inputs to provisioning.
 */

// TTN regional Identity Server URLs
export const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
  as1: "https://as1.cloud.thethings.network",
};

// ============================================================================
// MAIN USER API KEY REQUIRED RIGHTS
// These are the rights the TTN_ADMIN_API_KEY (Main User Key) must have
// to perform ALL provisioning operations end-to-end.
// ============================================================================
export const MAIN_USER_KEY_REQUIRED_RIGHTS = [
  // User-level rights for creating top-level entities
  "RIGHT_USER_ORGANIZATIONS_CREATE",       // Create new organizations
  "RIGHT_USER_APPLICATIONS_CREATE",        // Create applications (user-level)
  "RIGHT_USER_GATEWAYS_CREATE",            // Create gateways
];

// Required rights for application-level operations (after provisioning)
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
export const GATEWAY_RIGHTS = {
  required: [
    "RIGHT_GATEWAY_INFO",
    "RIGHT_GATEWAY_SETTINGS_BASIC",
    "RIGHT_GATEWAY_LINK",
  ],
  extended: [
    "RIGHT_GATEWAY_STATUS_READ",
    "RIGHT_GATEWAY_LOCATION_READ",
    "RIGHT_GATEWAY_DELETE",
  ],
  all: "RIGHT_GATEWAY_ALL",
};

// ============================================================================
// ORGANIZATION-SCOPED API KEY RIGHTS (ALL)
// Grants full access - used when creating org API key as output artifact
// ============================================================================
export const ORGANIZATION_KEY_RIGHTS_ALL = [
  "RIGHT_ORGANIZATION_ALL",
  "RIGHT_APPLICATION_ALL",
  "RIGHT_GATEWAY_ALL",
];

// ============================================================================
// ORGANIZATION-LEVEL API KEY RIGHTS (Granular)
// Output artifact: created by provisioning, used for runtime org operations
// ============================================================================
export const ORGANIZATION_KEY_RIGHTS = [
  "RIGHT_ORGANIZATION_INFO",
  "RIGHT_ORGANIZATION_SETTINGS_BASIC",
  "RIGHT_ORGANIZATION_SETTINGS_API_KEYS",
  "RIGHT_ORGANIZATION_APPLICATIONS_CREATE",
  "RIGHT_ORGANIZATION_APPLICATIONS_LIST",
  "RIGHT_ORGANIZATION_GATEWAYS_CREATE",
  "RIGHT_ORGANIZATION_GATEWAYS_LIST",
  "RIGHT_APPLICATION_INFO",
  "RIGHT_APPLICATION_SETTINGS_BASIC",
  "RIGHT_APPLICATION_SETTINGS_API_KEYS",
  "RIGHT_APPLICATION_DEVICES_READ",
  "RIGHT_APPLICATION_DEVICES_WRITE",
  "RIGHT_APPLICATION_TRAFFIC_READ",
  "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
  "RIGHT_GATEWAY_INFO",
  "RIGHT_GATEWAY_SETTINGS_BASIC",
  "RIGHT_GATEWAY_STATUS_READ",
  "RIGHT_GATEWAY_LINK",
];

// ============================================================================
// APPLICATION-SCOPED API KEY RIGHTS
// Output artifact: created by provisioning, used for runtime app operations
// ============================================================================
export const APPLICATION_KEY_RIGHTS = [
  "RIGHT_APPLICATION_INFO",
  "RIGHT_APPLICATION_LINK",
  "RIGHT_APPLICATION_DEVICES_READ",
  "RIGHT_APPLICATION_DEVICES_WRITE",
  "RIGHT_APPLICATION_TRAFFIC_READ",
  "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
  "RIGHT_APPLICATION_SETTINGS_BASIC",
  "RIGHT_APPLICATION_SETTINGS_API_KEYS",
];

// Complete set of gateway rights for gateway API keys
export const GATEWAY_KEY_RIGHTS = [
  "RIGHT_GATEWAY_INFO",
  "RIGHT_GATEWAY_SETTINGS_BASIC",
  "RIGHT_GATEWAY_SETTINGS_API_KEYS",
  "RIGHT_GATEWAY_LINK",
  "RIGHT_GATEWAY_STATUS_READ",
  "RIGHT_GATEWAY_LOCATION_READ",
  "RIGHT_GATEWAY_DELETE",
];

// Human-readable permission names for UI
export const PERMISSION_LABELS: Record<string, string> = {
  "RIGHT_APPLICATION_INFO": "Read application info",
  "RIGHT_APPLICATION_TRAFFIC_READ": "Read uplink messages",
  "RIGHT_APPLICATION_SETTINGS_BASIC": "Manage application settings (webhooks)",
  "RIGHT_APPLICATION_DEVICES_READ": "Read devices",
  "RIGHT_APPLICATION_DEVICES_WRITE": "Write devices",
  "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE": "Send downlink messages",
  "RIGHT_USER_ORGANIZATIONS_CREATE": "Create organizations",
  "RIGHT_USER_APPLICATIONS_CREATE": "Create applications",
  "RIGHT_USER_GATEWAYS_CREATE": "Create gateways",
};

// ============================================================================
// INTERFACES
// ============================================================================

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
  method?: "direct" | "probe";
}

export interface PreflightResult {
  success: boolean;
  user_id?: string;
  granted_rights?: string[];
  missing_rights?: string[];
  is_admin?: boolean;
  error?: string;
  hint?: string;
  statusCode?: number;
}

// ============================================================================
// PREFLIGHT: VALIDATE MAIN USER API KEY
// Verifies the Main User API Key has all rights needed for provisioning
// ============================================================================
export async function validateMainUserApiKey(
  cluster: string,
  apiKey: string,
  requestId: string
): Promise<PreflightResult> {
  const baseUrl = REGIONAL_URLS[cluster];
  if (!baseUrl) {
    return {
      success: false,
      error: `Unknown cluster: ${cluster}`,
      hint: "Supported clusters: eu1, nam1, au1, as1",
    };
  }

  const url = `${baseUrl}/api/v3/auth_info`;
  console.log(`[ttnPermissions] [${requestId}] Preflight: checking Main User API Key at ${url}`);
  console.log(`[ttnPermissions] [${requestId}] API key last4: ...${apiKey.slice(-4)}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ttnPermissions] [${requestId}] Preflight failed: ${response.status} ${errorText}`);
      
      if (response.status === 401) {
        return {
          success: false,
          error: "Invalid Main User API Key",
          hint: "The TTN_ADMIN_API_KEY is invalid or expired. Generate a new Personal API Key in TTN Console → User Settings → API Keys.",
          statusCode: 401,
        };
      }
      
      return {
        success: false,
        error: `Preflight failed: HTTP ${response.status}`,
        hint: errorText.substring(0, 200),
        statusCode: response.status,
      };
    }

    const data = await response.json();
    
    // Extract user info from various possible response formats
    const userId = data.oauth_access_token?.user_ids?.user_id 
      || data.api_key?.api_key_id 
      || data.user_session?.session?.user_ids?.user_id
      || "unknown";
    
    const universalRights = data.universal_rights || [];
    const isAdmin = data.is_admin || false;
    
    console.log(`[ttnPermissions] [${requestId}] Preflight: user_id=${userId}, is_admin=${isAdmin}, universal_rights=${universalRights.length}`);
    
    // If admin, they have all rights
    if (isAdmin) {
      console.log(`[ttnPermissions] [${requestId}] Preflight: User is admin, all rights granted`);
      return {
        success: true,
        user_id: userId,
        is_admin: true,
        granted_rights: ["ADMIN_ALL_RIGHTS"],
        missing_rights: [],
      };
    }

    // Check for required user-level rights
    const grantedSet = new Set(universalRights);
    const missingRights = MAIN_USER_KEY_REQUIRED_RIGHTS.filter(r => !grantedSet.has(r));
    
    console.log(`[ttnPermissions] [${requestId}] Preflight: ${universalRights.length} universal rights, ${missingRights.length} missing`);
    
    // If no universal rights at all, this is probably a scoped key (org/app)
    if (universalRights.length === 0 && !isAdmin) {
      // Try to detect if it's an org or app scoped key
      const apiKeyInfo = data.api_key;
      if (apiKeyInfo?.entity_ids) {
        const entityType = Object.keys(apiKeyInfo.entity_ids)[0] || "unknown";
        return {
          success: false,
          user_id: userId,
          granted_rights: [],
          missing_rights: MAIN_USER_KEY_REQUIRED_RIGHTS,
          error: "API key is scoped to specific entity",
          hint: `This appears to be a ${entityType}-scoped API key. Provisioning requires a Personal API Key (user-scoped) with full rights. Create one in TTN Console → User Settings → API Keys with 'Grant all current and future rights' checked.`,
        };
      }
    }

    // Success - key is valid and has sufficient rights
    return {
      success: true,
      user_id: userId,
      is_admin: false,
      granted_rights: universalRights,
      missing_rights: missingRights,
    };
  } catch (err) {
    console.error(`[ttnPermissions] [${requestId}] Preflight exception:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error during preflight",
      hint: "Check network connectivity and TTN service status.",
    };
  }
}

// ============================================================================
// FETCH APPLICATION RIGHTS (for app-scoped keys)
// ============================================================================
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
      
      if (response.status === 401) {
        return {
          success: false,
          error: "Invalid or expired API key",
          hint: "Generate a new API key in TTN Console",
          statusCode: 401,
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          error: "API key lacks permission to read rights",
          hint: `This API key cannot access application '${applicationId}'.`,
          statusCode: 403,
        };
      }
      
      if (response.status === 404) {
        return {
          success: false,
          error: "Application not found",
          hint: `Application '${applicationId}' doesn't exist on cluster '${cluster}'.`,
          statusCode: 404,
        };
      }
      
      return {
        success: false,
        error: `TTN API error (${response.status})`,
        hint: errorText.slice(0, 200),
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

// ============================================================================
// COMPUTE PERMISSION REPORT
// ============================================================================
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
  
  return report;
}

// ============================================================================
// VALIDATE AND ANALYZE PERMISSIONS (for app-scoped keys)
// ============================================================================
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
  const rightsResult = await fetchTtnRights(cluster, applicationId, apiKey, requestId);
  
  if (!rightsResult.success) {
    return {
      success: false,
      error: rightsResult.error,
      hint: rightsResult.hint,
      statusCode: rightsResult.statusCode,
    };
  }
  
  const report = computePermissionReport(rightsResult.rights || []);
  
  return {
    success: true,
    report,
  };
}
