/**
 * TTN Base URL - Single Cluster Architecture
 *
 * CRITICAL FIX (2026-01-24): Changed from dual-endpoint to single-cluster.
 *
 * WRONG (causes cross-cluster device registration):
 * - Identity Server (IS): eu1.cloud.thethings.network
 * - Data Planes (NS/AS/JS): nam1.cloud.thethings.network
 *
 * CORRECT (all operations use same cluster):
 * - ALL servers: nam1.cloud.thethings.network
 *
 * Proven by debugging: CLI with single cluster works correctly.
 * The dual-endpoint pattern caused "other cluster" warnings and broken joins.
 *
 * This is the CANONICAL source for TTN endpoints across all edge functions.
 * All other files MUST import from here instead of defining their own constants.
 */

// ============================================================================
// SINGLE CLUSTER CONFIGURATION
// ALL TTN operations use the same cluster - no mixing!
// ============================================================================

const DEFAULT_CLUSTER = "nam1";

const TTN_CLUSTERS: Record<string, { url: string; host: string }> = {
  nam1: {
    url: "https://nam1.cloud.thethings.network",
    host: "nam1.cloud.thethings.network",
  },
  eu1: {
    url: "https://eu1.cloud.thethings.network",
    host: "eu1.cloud.thethings.network",
  },
  au1: {
    url: "https://au1.cloud.thethings.network",
    host: "au1.cloud.thethings.network",
  },
};

// ============================================================================
// PRIMARY EXPORTS - Use these for all TTN operations
// ============================================================================

/**
 * Primary TTN base URL - use for ALL operations
 * Identity Server, Join Server, Network Server, Application Server
 */
export const TTN_BASE_URL = TTN_CLUSTERS[DEFAULT_CLUSTER].url;
export const TTN_HOST = TTN_CLUSTERS[DEFAULT_CLUSTER].host;

// Legacy exports for backward compatibility - all point to same cluster now
export const CLUSTER_BASE_URL = TTN_BASE_URL;
export const CLUSTER_HOST = TTN_HOST;

// DEPRECATED: These now point to NAM1 instead of EU1 to fix cross-cluster issues
// The Identity Server is co-located with data planes on NAM1 for TTN Cloud
export const IDENTITY_SERVER_URL = TTN_BASE_URL;
export const IDENTITY_SERVER_HOST = TTN_HOST;

// ============================================================================
// CLUSTER UTILITIES
// ============================================================================

/**
 * Get TTN base URL for a specific cluster region
 * Use when you need to explicitly target a different cluster (rare)
 */
export function getTtnBaseUrl(region: string = DEFAULT_CLUSTER): string {
  const cluster = TTN_CLUSTERS[region.toLowerCase()];
  if (!cluster) {
    console.warn(`[getTtnBaseUrl] Unknown region "${region}", using ${DEFAULT_CLUSTER}`);
    return TTN_CLUSTERS[DEFAULT_CLUSTER].url;
  }
  return cluster.url;
}

/**
 * Get TTN host for a specific cluster region
 */
export function getTtnHost(region: string = DEFAULT_CLUSTER): string {
  const cluster = TTN_CLUSTERS[region.toLowerCase()];
  if (!cluster) {
    return TTN_CLUSTERS[DEFAULT_CLUSTER].host;
  }
  return cluster.host;
}

/**
 * Get all TTN endpoints for a region
 * CRITICAL: All endpoints use the SAME base URL - no cluster mixing!
 */
export function getTtnEndpoints(region: string = DEFAULT_CLUSTER) {
  const baseUrl = getTtnBaseUrl(region);
  const host = getTtnHost(region);

  return {
    baseUrl,
    host,

    // ALL servers use same cluster
    identityServer: baseUrl,
    joinServer: baseUrl,
    networkServer: baseUrl,
    applicationServer: baseUrl,

    // API endpoints
    api: {
      authInfo: `${baseUrl}/api/v3/auth_info`,
      organizations: `${baseUrl}/api/v3/organizations`,
      users: `${baseUrl}/api/v3/users`,
      applications: `${baseUrl}/api/v3/applications`,
      gateways: `${baseUrl}/api/v3/gateways`,
    },

    // Device endpoints (need appId)
    devices: (appId: string) => ({
      list: `${baseUrl}/api/v3/applications/${appId}/devices`,
      create: `${baseUrl}/api/v3/applications/${appId}/devices`,
      get: (deviceId: string) => `${baseUrl}/api/v3/applications/${appId}/devices/${deviceId}`,
      delete: (deviceId: string) => `${baseUrl}/api/v3/applications/${appId}/devices/${deviceId}`,
      purge: (deviceId: string) => `${baseUrl}/api/v3/applications/${appId}/devices/${deviceId}/purge`,

      // Component-specific endpoints (same cluster!)
      js: (deviceId: string) => `${baseUrl}/api/v3/js/applications/${appId}/devices/${deviceId}`,
      ns: (deviceId: string) => `${baseUrl}/api/v3/ns/applications/${appId}/devices/${deviceId}`,
      as: (deviceId: string) => `${baseUrl}/api/v3/as/applications/${appId}/devices/${deviceId}`,
    }),
  };
}

// ============================================================================
// ENDPOINT TYPE IDENTIFICATION (simplified - no longer routes to different clusters)
// ============================================================================

export type TTNPlane = "IS" | "JS" | "NS" | "AS" | "OTHER";
export type TTNEndpointType = "IS" | "DATA";

/**
 * Determine endpoint type for a given API path.
 * NOTE: Both types now use the SAME base URL (single cluster architecture)
 */
export function getEndpointForPath(path: string): { url: string; type: TTNEndpointType } {
  // Data plane paths
  if (path.includes("/api/v3/as/") ||
      path.includes("/api/v3/ns/") ||
      path.includes("/api/v3/js/")) {
    return { url: TTN_BASE_URL, type: "DATA" };
  }

  // Identity Server paths (but using same cluster now!)
  return { url: TTN_BASE_URL, type: "IS" };
}

/**
 * Identify which TTN plane an endpoint targets based on path.
 * Used for structured logging.
 */
export function identifyPlane(endpoint: string): TTNPlane {
  if (endpoint.includes("/api/v3/js/")) return "JS";
  if (endpoint.includes("/api/v3/ns/")) return "NS";
  if (endpoint.includes("/api/v3/as/")) return "AS";
  if (
    endpoint.includes("/api/v3/applications/") ||
    endpoint.includes("/api/v3/devices/") ||
    endpoint.includes("/api/v3/organizations/") ||
    endpoint.includes("/api/v3/users/") ||
    endpoint.includes("/api/v3/gateways/") ||
    endpoint.includes("/api/v3/auth_info")
  ) {
    return "IS";
  }
  return "OTHER";
}

// ============================================================================
// HOST VALIDATION (simplified for single cluster)
// ============================================================================

/**
 * Validate that a URL uses the expected TTN cluster host.
 * With single-cluster architecture, all operations should use the same host.
 *
 * @param url - Full URL to validate
 * @param expectedType - "IS" or "DATA" (both use same host now)
 * @throws Error if URL host doesn't match expected cluster
 */
export function assertValidTtnHost(url: string, expectedType: TTNEndpointType): void {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    throw new Error(
      `FATAL: Invalid TTN URL format: ${url}. ` +
      `All TTN endpoints must be valid URLs.`
    );
  }

  // Single cluster: both IS and DATA use same host
  const expectedHost = TTN_HOST;

  if (host !== expectedHost) {
    // Warning instead of error to allow gradual migration
    console.warn(
      `[TTN] Host mismatch for ${expectedType}: Expected ${expectedHost}, got ${host}. ` +
      `URL: ${url}. Consider updating to use single cluster.`
    );
  }
}

/**
 * @deprecated Use assertValidTtnHost with explicit type instead.
 */
export function assertClusterHost(url: string): void {
  const path = new URL(url).pathname;
  const { type } = getEndpointForPath(path);
  assertValidTtnHost(url, type);
}

/**
 * Assert request is targeting the default cluster (NAM1).
 */
export function assertNam1Only(baseUrl: string): void {
  if (!baseUrl.startsWith(TTN_BASE_URL)) {
    throw new Error(`NAM1-ONLY violation: ${baseUrl} is not ${TTN_BASE_URL}`);
  }
}

// ============================================================================
// TTN ERROR CODES
// ============================================================================

export const TTN_ERROR_CODES = {
  IS_CALL_ON_NAM1: "ERR_IS_CALL_ON_WRONG_CLUSTER",
  WEBHOOK_ON_WRONG_CLUSTER: "ERR_WEBHOOK_WRONG_CLUSTER",
  APP_ID_MISMATCH: "ERR_APP_ID_MISMATCH_BETWEEN_STEPS",
  CREDENTIAL_MISMATCH: "ERR_CREDENTIAL_FINGERPRINT_MISMATCH",
  DEVICE_SPLIT_BRAIN: "ERR_DEVICE_SPLIT_BRAIN",
} as const;

/**
 * Detect if an API call is targeting the wrong cluster.
 * With single-cluster architecture, this checks against the default cluster.
 */
export function detectWrongCluster(
  actualHost: string,
  _expectedType: TTNEndpointType
): { error: boolean; code: string | null; message: string } {
  // Single cluster: all operations should use same host
  if (actualHost !== TTN_HOST) {
    return {
      error: true,
      code: TTN_ERROR_CODES.WEBHOOK_ON_WRONG_CLUSTER,
      message: `Expected ${TTN_HOST}, got ${actualHost}`,
    };
  }

  return { error: false, code: null, message: "OK" };
}

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

/**
 * Log a TTN API call with structured fields for debugging.
 */
export function logTtnApiCall(
  functionName: string,
  method: string,
  endpoint: string,
  step: string,
  requestId: string,
  baseUrl?: string
): void {
  const plane = identifyPlane(endpoint);
  const actualBaseUrl = baseUrl || TTN_BASE_URL;

  console.log(JSON.stringify({
    event: "ttn_api_call",
    plane,
    baseUrl: actualBaseUrl,
    host: TTN_HOST,
    endpoint,
    method,
    function_name: functionName,
    step,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Enhanced TTN API call logging with credential fingerprint.
 */
export function logTtnApiCallWithCred(
  functionName: string,
  method: string,
  endpoint: string,
  step: string,
  requestId: string,
  credLast4: string,
  orgId?: string,
  appId?: string,
  deviceId?: string,
  baseUrl?: string
): void {
  const plane = identifyPlane(endpoint);
  const actualBaseUrl = baseUrl || TTN_BASE_URL;

  let clusterHost: string;
  try {
    clusterHost = new URL(actualBaseUrl).host;
  } catch {
    clusterHost = "invalid-url";
  }

  console.log(JSON.stringify({
    event: "ttn_api_call",
    method,
    endpoint,
    base_url: actualBaseUrl,
    host: clusterHost,
    plane,
    cred_last4: credLast4,
    org_id: orgId,
    app_id: appId,
    device_id: deviceId,
    function_name: functionName,
    step,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  }));

  // Warn if wrong cluster detected
  if (clusterHost !== TTN_HOST) {
    console.warn(`[TTN] Using non-default cluster: ${clusterHost} (expected ${TTN_HOST})`);
  }
}

/**
 * Build a full TTN URL from an endpoint path.
 * Uses the single cluster base URL for all operations.
 */
export function buildTtnUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${TTN_BASE_URL}${normalizedEndpoint}`;
}

/**
 * Build a TTN URL with explicit base URL selection.
 * NOTE: With single-cluster architecture, type parameter is ignored.
 */
export function buildTtnUrlExplicit(endpoint: string, _type: TTNEndpointType): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${TTN_BASE_URL}${normalizedEndpoint}`;
}

// ============================================================================
// TTN API FETCH HELPER
// ============================================================================

/**
 * Make a TTN API request using the single cluster architecture.
 * Always uses the configured cluster - no dual-endpoint logic.
 */
export async function ttnFetch(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: Record<string, unknown>,
  region: string = DEFAULT_CLUSTER
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const baseUrl = getTtnBaseUrl(region);
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  console.log(`[TTN] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    console.log(`[TTN] Response: ${response.status}`);

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    console.error(`[TTN] Network error:`, err);
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : "Network error" }
    };
  }
}

// Export default cluster for reference
export const TTN_DEFAULT_REGION = DEFAULT_CLUSTER;
