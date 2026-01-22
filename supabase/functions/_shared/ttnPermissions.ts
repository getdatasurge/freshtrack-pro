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

import { CLUSTER_BASE_URL, CLUSTER_HOST, assertClusterHost, logTtnApiCall } from "./ttnBase.ts";

// ============================================================================
// NAM1-ONLY HARD LOCK
// All TTN API operations MUST target the NAM1 cluster exclusively.
// Using single source of truth: _shared/ttnBase.ts
// ============================================================================

// @deprecated - Use CLUSTER_BASE_URL directly
export const IDENTITY_SERVER_URL = CLUSTER_BASE_URL;

// @deprecated - Use CLUSTER_BASE_URL directly
export const REGIONAL_URLS: Record<string, string> = {
  nam1: CLUSTER_BASE_URL,
  // Other clusters removed - NAM1-ONLY mode enforced
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
  "RIGHT_APPLICATION_LINK",              // Link app to Network Server (critical for data flow)
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
// APPLICATION-SCOPED API KEY RIGHTS (ALL)
// Grants full application access - simpler and future-proof
// ============================================================================
export const APPLICATION_KEY_RIGHTS_ALL = [
  "RIGHT_APPLICATION_ALL",
];

// ============================================================================
// APPLICATION-SCOPED API KEY RIGHTS (Granular - kept for reference)
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

// ============================================================================
// GATEWAY-SCOPED API KEY RIGHTS (ALL)
// Grants full gateway access - simpler and future-proof
// ============================================================================
export const GATEWAY_KEY_RIGHTS_ALL = [
  "RIGHT_GATEWAY_ALL",
];

// Complete set of gateway rights for gateway API keys (Granular - kept for reference)
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
  "RIGHT_APPLICATION_LINK": "Link application to Network Server",
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
  // Validate cluster is known (for logging purposes)
  const targetCluster = REGIONAL_URLS[cluster];
  if (!targetCluster) {
    return {
      success: false,
      error: `Unknown cluster: ${cluster}`,
      hint: "NAM1-ONLY mode: Only 'nam1' cluster is supported",
    };
  }

  // NAM1-ONLY: auth_info uses the NAM1 Identity Server (unified cluster)
  const url = `${IDENTITY_SERVER_URL}/api/v3/auth_info`;
  console.log(`[ttnPermissions] [${requestId}] Preflight: Identity Server at ${url}`);
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
      
      // 404 on Identity Server auth_info is a service/network issue, not a region mismatch
      if (response.status === 404 || errorText.includes('route_not_found')) {
        return {
          success: false,
          error: "TTN Identity Server unreachable",
          hint: "The authentication endpoint returned 404. Check TTN service status at status.thethings.network or retry later.",
          statusCode: 404,
        };
      }
      
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
    
    // DEBUG: Log the full raw response to diagnose user_id extraction issues
    console.log(`[ttnPermissions] [${requestId}] DEBUG raw auth_info (truncated): ${JSON.stringify(data).substring(0, 1500)}`);
    console.log(`[ttnPermissions] [${requestId}] Preflight: raw response keys: ${Object.keys(data).join(', ')}`);
    
    // CRITICAL: TTN auth_info response structure for Personal API keys is DOUBLE-NESTED:
    // { api_key: { api_key: { rights: [...] }, entity_ids: { user_ids: { user_id: "..." } } } }
    // The outer api_key contains entity_ids, the inner api_key.api_key contains rights
    const outer = data.api_key;
    const inner = outer?.api_key;
    
    // DEBUG: Log the entity_ids structure specifically
    console.log(`[ttnPermissions] [${requestId}] DEBUG entity_ids raw: ${JSON.stringify(outer?.entity_ids)}`);
    console.log(`[ttnPermissions] [${requestId}] DEBUG user_ids raw: ${JSON.stringify(outer?.entity_ids?.user_ids)}`);
    
    // Parse rights with correct fallback chain
    const rights = inner?.rights ?? outer?.rights ?? data.universal_rights ?? [];
    
    // Parse entity ownership ONLY from outer.entity_ids (NOT innerApiKey.entity_ids)
    const entityIds = outer?.entity_ids ?? {};
    const entityType = Object.keys(entityIds)[0] || null; // "user_ids", "application_ids", "organization_ids", or null
    
    // Extract user ID - NO innerApiKey.entity_ids fallback
    const userId = entityIds?.user_ids?.user_id ?? "unknown";
    
    // DEBUG: Log the final userId extraction
    console.log(`[ttnPermissions] [${requestId}] DEBUG final userId extracted: "${userId}"`);
    
    const isAdmin = data.is_admin || false;
    
    // Debug logging for structure verification
    console.log(`[ttnPermissions] [${requestId}] Preflight: outer keys: ${Object.keys(outer || {}).join(', ')}`);
    console.log(`[ttnPermissions] [${requestId}] Preflight: inner exists: ${!!inner}, rights count: ${rights.length}`);
    console.log(`[ttnPermissions] [${requestId}] Preflight: entity_type=${entityType}, user_id=${userId}, is_admin=${isAdmin}`);
    
    // allRights for compatibility with downstream checks
    const allRights = rights;
    
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

    // CRITICAL: Only accept user-scoped keys (Personal API Keys)
    // Reject application_ids and organization_ids scoped keys
    if (entityType === "application_ids") {
      const appId = entityIds.application_ids?.application_id || "unknown";
      console.log(`[ttnPermissions] [${requestId}] Preflight: Rejected - Application-scoped key for ${appId}`);
      return {
        success: false,
        user_id: userId,
        granted_rights: rights,
        missing_rights: MAIN_USER_KEY_REQUIRED_RIGHTS,
        error: "This is an Application API key, not a Personal API key",
        hint: `This key is scoped to application '${appId}'. Provisioning requires a Personal API Key (user-scoped). Create one in TTN Console → User Settings → API Keys with 'Grant all current and future rights' checked.`,
      };
    }
    
    if (entityType === "organization_ids") {
      const orgId = entityIds.organization_ids?.organization_id || "unknown";
      console.log(`[ttnPermissions] [${requestId}] Preflight: Rejected - Organization-scoped key for ${orgId}`);
      return {
        success: false,
        user_id: userId,
        granted_rights: rights,
        missing_rights: MAIN_USER_KEY_REQUIRED_RIGHTS,
        error: "This is an Organization API key, not a Personal API key",
        hint: `This key is scoped to organization '${orgId}'. Provisioning requires a Personal API Key (user-scoped). Create one in TTN Console → User Settings → API Keys with 'Grant all current and future rights' checked.`,
      };
    }
    
    if (entityType === "gateway_ids") {
      const gwId = entityIds.gateway_ids?.gateway_id || "unknown";
      console.log(`[ttnPermissions] [${requestId}] Preflight: Rejected - Gateway-scoped key for ${gwId}`);
      return {
        success: false,
        user_id: userId,
        granted_rights: rights,
        missing_rights: MAIN_USER_KEY_REQUIRED_RIGHTS,
        error: "This is a Gateway API key, not a Personal API key",
        hint: `This key is scoped to gateway '${gwId}'. Provisioning requires a Personal API Key (user-scoped). Create one in TTN Console → User Settings → API Keys with 'Grant all current and future rights' checked.`,
      };
    }

    // Check for required user-level rights
    // For Personal API keys, allRights should contain the granted rights
    const grantedSet = new Set(allRights);
    const missingRights = MAIN_USER_KEY_REQUIRED_RIGHTS.filter(r => !grantedSet.has(r));
    
    console.log(`[ttnPermissions] [${requestId}] Preflight: ${allRights.length} total rights, ${missingRights.length} missing`);
    
    // Check if key has sufficient rights
    if (missingRights.length > 0) {
      console.log(`[ttnPermissions] [${requestId}] Preflight: Missing rights: ${missingRights.join(', ')}`);
      return {
        success: false,
        user_id: userId,
        granted_rights: allRights,
        missing_rights: missingRights,
        error: "Personal API key is missing required rights",
        hint: `The key is valid but missing these rights: ${missingRights.slice(0, 3).map(r => PERMISSION_LABELS[r] || r).join(', ')}${missingRights.length > 3 ? ` and ${missingRights.length - 3} more` : ''}. Edit the key in TTN Console or create a new one with 'Grant all current and future rights' checked.`,
      };
    }

    // Success - key is valid and has sufficient rights
    console.log(`[ttnPermissions] [${requestId}] Preflight: SUCCESS - Valid Personal API key with all required rights`);
    return {
      success: true,
      user_id: userId,
      is_admin: false,
      granted_rights: allRights,
      missing_rights: [],
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
  // NAM1-ONLY: Always use NAM1 regardless of cluster parameter
  const baseUrl = REGIONAL_URLS.nam1;
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
// WILDCARD RIGHTS HELPER
// Checks if a right is granted, supporting _ALL wildcards (e.g., RIGHT_APPLICATION_ALL)
// ============================================================================
function hasRight(rights: string[], requiredRight: string): boolean {
  // Direct match
  if (rights.includes(requiredRight)) return true;
  
  // Check for _ALL wildcard patterns
  if (requiredRight.startsWith('RIGHT_APPLICATION_') && rights.includes('RIGHT_APPLICATION_ALL')) return true;
  if (requiredRight.startsWith('RIGHT_ORGANIZATION_') && rights.includes('RIGHT_ORGANIZATION_ALL')) return true;
  if (requiredRight.startsWith('RIGHT_GATEWAY_') && rights.includes('RIGHT_GATEWAY_ALL')) return true;
  if (requiredRight.startsWith('RIGHT_USER_') && rights.includes('RIGHT_USER_ALL')) return true;
  if (requiredRight.startsWith('RIGHT_CLIENT_') && rights.includes('RIGHT_CLIENT_ALL')) return true;
  
  return false;
}

// ============================================================================
// COMPUTE PERMISSION REPORT
// ============================================================================
export function computePermissionReport(rights: string[]): PermissionReport {
  const missing_core = REQUIRED_RIGHTS.core.filter(r => !hasRight(rights, r));
  const missing_webhook = REQUIRED_RIGHTS.webhook.filter(r => !hasRight(rights, r));
  const missing_devices = REQUIRED_RIGHTS.devices.filter(r => !hasRight(rights, r));
  const missing_downlink = REQUIRED_RIGHTS.downlink.filter(r => !hasRight(rights, r));
  
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
