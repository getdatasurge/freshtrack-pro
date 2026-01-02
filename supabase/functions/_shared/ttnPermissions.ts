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
  // Minimum required permissions for basic functionality (APPLICATION-scoped)
  core: [
    "RIGHT_APPLICATION_INFO",           // Read application info
    "RIGHT_APPLICATION_TRAFFIC_READ",   // Read uplink messages (critical!)
  ],
  // Required for webhook management (APPLICATION-scoped)
  webhook: [
    "RIGHT_APPLICATION_SETTINGS_BASIC", // Manage webhooks
  ],
  // Required for device management (APPLICATION-scoped)
  devices: [
    "RIGHT_APPLICATION_DEVICES_READ",
    "RIGHT_APPLICATION_DEVICES_WRITE",
  ],
  // Required for downlinks (APPLICATION-scoped)
  downlink: [
    "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
  ],
};

/**
 * Required rights for GATEWAY provisioning
 * IMPORTANT: These must be on a PERSONAL or ORGANIZATION API key
 * Application API keys CANNOT provision gateways (TTN v3 API constraint)
 */
export const REQUIRED_GATEWAY_RIGHTS = {
  // Minimum required for gateway provisioning
  core: [
    "RIGHT_GATEWAY_INFO",              // Read gateway information
    "RIGHT_GATEWAY_SETTINGS_BASIC",    // Edit gateway settings
    "RIGHT_GATEWAY_LINK",              // Connect gateway to network
    "RIGHT_GATEWAY_STATUS_READ",       // Read gateway status
  ],
  // Full gateway management
  full: [
    "RIGHT_GATEWAY_ALL",               // All gateway rights (recommended)
  ],
};

// Human-readable permission names for gateway rights
export const GATEWAY_PERMISSION_LABELS: Record<string, string> = {
  "RIGHT_GATEWAY_ALL": "All gateway rights",
  "RIGHT_GATEWAY_INFO": "View gateway information",
  "RIGHT_GATEWAY_SETTINGS_BASIC": "Edit basic gateway settings",
  "RIGHT_GATEWAY_SETTINGS_API_KEYS": "Manage gateway API keys",
  "RIGHT_GATEWAY_DELETE": "Delete gateways",
  "RIGHT_GATEWAY_TRAFFIC_READ": "Read gateway traffic",
  "RIGHT_GATEWAY_TRAFFIC_DOWN_WRITE": "Send downlinks via gateway",
  "RIGHT_GATEWAY_LINK": "Connect gateway to network",
  "RIGHT_GATEWAY_STATUS_READ": "Read gateway status",
  "RIGHT_GATEWAY_LOCATION_READ": "Read gateway location",
};

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

// ========================================
// GATEWAY PERMISSION CHECKING
// ========================================

export interface GatewayPermissionReport {
  valid: boolean;
  key_type: "personal" | "organization" | "application" | "unknown";
  scope_id: string | null;
  rights: string[];
  has_gateway_read: boolean;
  has_gateway_write: boolean;
  has_gateway_link: boolean;
  missing_rights: string[];
  can_provision_gateways: boolean;
}

export interface AuthInfoResponse {
  is_admin?: boolean;
  universal_rights?: string[];
  user_ids?: Array<{ user_id: string }>;
  organization_ids?: Array<{ organization_id: string }>;
  application_ids?: Array<{ application_id: string }>;
}

/**
 * Fetch auth_info to determine API key type and scope
 * This is required because gateway rights are checked differently than application rights
 */
export async function fetchAuthInfo(
  cluster: string,
  apiKey: string,
  requestId: string
): Promise<{ success: boolean; authInfo?: AuthInfoResponse; error?: string; hint?: string }> {
  const baseUrl = REGIONAL_URLS[cluster] || REGIONAL_URLS.eu1;
  const authInfoUrl = `${baseUrl}/api/v3/auth_info`;

  console.log(`[ttnPermissions] [${requestId}] Fetching auth_info from: ${authInfoUrl}`);

  try {
    const response = await fetch(authInfoUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ttnPermissions] [${requestId}] auth_info failed: ${response.status}`);

      if (response.status === 401) {
        return {
          success: false,
          error: "Invalid or expired API key",
          hint: "Generate a new API key in TTN Console",
        };
      }

      return {
        success: false,
        error: `TTN API error (${response.status})`,
        hint: errorText.slice(0, 200),
      };
    }

    const authInfo: AuthInfoResponse = await response.json();
    console.log(`[ttnPermissions] [${requestId}] auth_info received:`, {
      is_admin: authInfo.is_admin,
      user_ids: authInfo.user_ids?.length || 0,
      organization_ids: authInfo.organization_ids?.length || 0,
      application_ids: authInfo.application_ids?.length || 0,
      universal_rights_count: authInfo.universal_rights?.length || 0,
    });

    return { success: true, authInfo };
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
 * Check if API key has gateway provisioning rights
 * Gateway rights are found in universal_rights for Personal/Org keys
 */
export function checkGatewayRights(authInfo: AuthInfoResponse): GatewayPermissionReport {
  const universalRights = authInfo.universal_rights || [];

  // Determine key type
  let keyType: "personal" | "organization" | "application" | "unknown" = "unknown";
  let scopeId: string | null = null;

  if (authInfo.user_ids && authInfo.user_ids.length > 0) {
    keyType = "personal";
    scopeId = authInfo.user_ids[0].user_id;
  } else if (authInfo.organization_ids && authInfo.organization_ids.length > 0) {
    keyType = "organization";
    scopeId = authInfo.organization_ids[0].organization_id;
  } else if (authInfo.application_ids && authInfo.application_ids.length > 0) {
    keyType = "application";
    scopeId = authInfo.application_ids[0].application_id;
  }

  // Check gateway rights - look for exact matches or RIGHT_GATEWAY_ALL
  const hasGatewayAll = universalRights.includes("RIGHT_GATEWAY_ALL");
  const hasGatewayRead = hasGatewayAll || universalRights.includes("RIGHT_GATEWAY_INFO");
  const hasGatewayWrite = hasGatewayAll || universalRights.includes("RIGHT_GATEWAY_SETTINGS_BASIC");
  const hasGatewayLink = hasGatewayAll || universalRights.includes("RIGHT_GATEWAY_LINK");
  const hasGatewayStatus = hasGatewayAll || universalRights.includes("RIGHT_GATEWAY_STATUS_READ");

  // Determine missing rights
  const missingRights: string[] = [];
  if (!hasGatewayRead) missingRights.push("RIGHT_GATEWAY_INFO");
  if (!hasGatewayWrite) missingRights.push("RIGHT_GATEWAY_SETTINGS_BASIC");
  if (!hasGatewayLink) missingRights.push("RIGHT_GATEWAY_LINK");
  if (!hasGatewayStatus) missingRights.push("RIGHT_GATEWAY_STATUS_READ");

  // Can provision gateways if:
  // 1. Key type is personal or organization (NOT application)
  // 2. Has required gateway rights
  const canProvision =
    (keyType === "personal" || keyType === "organization") &&
    hasGatewayRead && hasGatewayWrite && hasGatewayLink;

  return {
    valid: canProvision,
    key_type: keyType,
    scope_id: scopeId,
    rights: universalRights,
    has_gateway_read: hasGatewayRead,
    has_gateway_write: hasGatewayWrite,
    has_gateway_link: hasGatewayLink,
    missing_rights: missingRights,
    can_provision_gateways: canProvision,
  };
}

/**
 * Full gateway permission validation
 * Fetches auth_info and checks gateway rights in one call
 */
export async function validateGatewayPermissions(
  cluster: string,
  apiKey: string,
  requestId: string
): Promise<{
  success: boolean;
  report?: GatewayPermissionReport;
  error?: string;
  hint?: string;
}> {
  const authResult = await fetchAuthInfo(cluster, apiKey, requestId);

  if (!authResult.success || !authResult.authInfo) {
    return {
      success: false,
      error: authResult.error,
      hint: authResult.hint,
    };
  }

  const report = checkGatewayRights(authResult.authInfo);

  return {
    success: true,
    report,
  };
}
