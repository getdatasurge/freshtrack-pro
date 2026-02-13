/**
 * TTN Base URL - Cross-Cluster "Two Truths" Architecture
 *
 * CRITICAL FIX (2026-02-10): Restored cross-cluster for DEVICE provisioning.
 *
 * The "Two Truths" of TTN Cloud architecture:
 *   - EU1 hosts the GLOBAL Identity Server (device registry, the "phonebook")
 *   - NAM1 hosts the REGIONAL radio plane (Join Server, Network Server, App Server)
 *
 * For DEVICE provisioning, the Identity Server record on EU1 MUST include
 * network_server_address, join_server_address, and application_server_address
 * ALL pointing to nam1.cloud.thethings.network. This tells TTN's routing layer
 * where to send join requests and uplinks.
 *
 * Previous single-cluster (NAM1-only) approach missed the server_address fields,
 * causing "device is on a different cluster" errors.
 *
 * NOTE: Organization and application creation still uses NAM1 (TTN_BASE_URL).
 * Only device registration requires the cross-cluster approach.
 *
 * This is the CANONICAL source for TTN endpoints across all edge functions.
 * All other files MUST import from here instead of defining their own constants.
 */

// ============================================================================
// CROSS-CLUSTER DEVICE PROVISIONING ("Two Truths" Architecture)
//   Step 1: Identity Server (EU1) - Create device with NAM1 home pointers
//   Step 2: Join Server (NAM1)    - Store root keys
//   Step 3: Network Server (NAM1) - MAC/radio settings
//   Step 4: App Server (NAM1)     - Link application server
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
// THE TWO TRUTHS - Do not change these without understanding the architecture
// ============================================================================

/** Identity plane (global registry) — EU1 for device creation/lookup */
export const TTN_IDENTITY_URL = TTN_CLUSTERS.eu1.url;
export const TTN_IDENTITY_HOST = TTN_CLUSTERS.eu1.host;

/** Radio plane (US region) — NAM1 for Join/Network/App server operations */
export const TTN_REGIONAL_URL = TTN_CLUSTERS[DEFAULT_CLUSTER].url;
export const TTN_REGIONAL_HOST = TTN_CLUSTERS[DEFAULT_CLUSTER].host;

/** Server address pointer — Identity Server records point here for NAM1 devices */
export const TTN_NAM1_HOST = TTN_CLUSTERS.nam1.host;

// ============================================================================
// PRIMARY EXPORTS
// ============================================================================

/**
 * Primary TTN base URL — NAM1 for org/app operations and data plane
 */
export const TTN_BASE_URL = TTN_CLUSTERS[DEFAULT_CLUSTER].url;
export const TTN_HOST = TTN_CLUSTERS[DEFAULT_CLUSTER].host;

// Legacy exports for backward compatibility
export const CLUSTER_BASE_URL = TTN_BASE_URL;
export const CLUSTER_HOST = TTN_HOST;

// Identity Server URL — now correctly points to EU1 (global registry)
export const IDENTITY_SERVER_URL = TTN_IDENTITY_URL;
export const IDENTITY_SERVER_HOST = TTN_IDENTITY_HOST;

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
 * Get all TTN endpoints for a region.
 * Cross-cluster: Identity Server on EU1, data planes on regional cluster.
 */
export function getTtnEndpoints(region: string = DEFAULT_CLUSTER) {
  const regionalUrl = getTtnBaseUrl(region);
  const host = getTtnHost(region);

  return {
    baseUrl: regionalUrl,
    host,

    // Cross-cluster: Identity Server on EU1, data planes on regional
    identityServer: TTN_IDENTITY_URL,
    joinServer: regionalUrl,
    networkServer: regionalUrl,
    applicationServer: regionalUrl,

    // API endpoints (org/app management uses regional)
    api: {
      authInfo: `${regionalUrl}/api/v3/auth_info`,
      organizations: `${regionalUrl}/api/v3/organizations`,
      users: `${regionalUrl}/api/v3/users`,
      applications: `${regionalUrl}/api/v3/applications`,
      gateways: `${regionalUrl}/api/v3/gateways`,
    },

    // Device endpoints — Identity Server (EU1) for registry, regional for data planes
    devices: (appId: string) => ({
      list: `${TTN_IDENTITY_URL}/api/v3/applications/${appId}/devices`,
      create: `${TTN_IDENTITY_URL}/api/v3/applications/${appId}/devices`,
      get: (deviceId: string) => `${TTN_IDENTITY_URL}/api/v3/applications/${appId}/devices/${deviceId}`,
      delete: (deviceId: string) => `${TTN_IDENTITY_URL}/api/v3/applications/${appId}/devices/${deviceId}`,
      purge: (deviceId: string) => `${TTN_IDENTITY_URL}/api/v3/applications/${appId}/devices/${deviceId}/purge`,

      // Component-specific endpoints (regional cluster)
      js: (deviceId: string) => `${regionalUrl}/api/v3/js/applications/${appId}/devices/${deviceId}`,
      ns: (deviceId: string) => `${regionalUrl}/api/v3/ns/applications/${appId}/devices/${deviceId}`,
      as: (deviceId: string) => `${regionalUrl}/api/v3/as/applications/${appId}/devices/${deviceId}`,
    }),
  };
}

// ============================================================================
// ENDPOINT TYPE IDENTIFICATION (simplified - no longer routes to different clusters)
// ============================================================================

export type TTNPlane = "IS" | "JS" | "NS" | "AS" | "OTHER";
export type TTNEndpointType = "IS" | "DATA";

/**
 * Determine endpoint type and base URL for a given API path.
 * Cross-cluster: IS paths → EU1, data plane paths → NAM1
 */
export function getEndpointForPath(path: string): { url: string; type: TTNEndpointType } {
  // Data plane paths → regional cluster (NAM1)
  // Includes Gateway Server (/api/v3/gs/) for connection stats
  if (path.includes("/api/v3/as/") ||
      path.includes("/api/v3/ns/") ||
      path.includes("/api/v3/js/") ||
      path.includes("/api/v3/gs/")) {
    return { url: TTN_REGIONAL_URL, type: "DATA" };
  }

  // Identity Server paths → EU1 (global registry)
  return { url: TTN_IDENTITY_URL, type: "IS" };
}

/**
 * Identify which TTN plane an endpoint targets based on path.
 * Used for structured logging.
 */
export function identifyPlane(endpoint: string): TTNPlane {
  if (endpoint.includes("/api/v3/js/")) return "JS";
  if (endpoint.includes("/api/v3/ns/")) return "NS";
  if (endpoint.includes("/api/v3/as/")) return "AS";
  // Gateway Server (connection stats) lives on the regional cluster
  if (endpoint.includes("/api/v3/gs/")) return "NS";
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
 * Validate that a URL uses the expected TTN cluster host for its endpoint type.
 * Cross-cluster: IS endpoints should target EU1, DATA endpoints should target NAM1.
 *
 * @param url - Full URL to validate
 * @param expectedType - "IS" targets EU1, "DATA" targets NAM1
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

  // Cross-cluster: IS → EU1, DATA → NAM1
  const expectedHost = expectedType === "IS" ? TTN_IDENTITY_HOST : TTN_REGIONAL_HOST;

  if (host !== expectedHost) {
    console.warn(
      `[TTN] Host mismatch for ${expectedType}: Expected ${expectedHost}, got ${host}. ` +
      `URL: ${url}.`
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
 * Cross-cluster: IS should go to EU1, DATA should go to NAM1.
 */
export function detectWrongCluster(
  actualHost: string,
  expectedType: TTNEndpointType
): { error: boolean; code: string | null; message: string } {
  const expectedHost = expectedType === "IS" ? TTN_IDENTITY_HOST : TTN_REGIONAL_HOST;

  if (actualHost !== expectedHost) {
    return {
      error: true,
      code: expectedType === "IS"
        ? TTN_ERROR_CODES.IS_CALL_ON_NAM1
        : TTN_ERROR_CODES.WEBHOOK_ON_WRONG_CLUSTER,
      message: `Expected ${expectedHost} for ${expectedType}, got ${actualHost}`,
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

  // Warn if unexpected cluster detected (EU1 is expected for IS operations)
  if (clusterHost !== TTN_HOST && clusterHost !== TTN_IDENTITY_HOST) {
    console.warn(`[TTN] Using unexpected cluster: ${clusterHost}`);
  }
}

/**
 * Build a full TTN URL from an endpoint path.
 * Routes to the correct cluster based on endpoint path.
 */
export function buildTtnUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const { url } = getEndpointForPath(normalizedEndpoint);
  return `${url}${normalizedEndpoint}`;
}

/**
 * Build a TTN URL with explicit base URL selection.
 * IS → EU1, DATA → NAM1.
 */
export function buildTtnUrlExplicit(endpoint: string, type: TTNEndpointType): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = type === "IS" ? TTN_IDENTITY_URL : TTN_REGIONAL_URL;
  return `${baseUrl}${normalizedEndpoint}`;
}

// ============================================================================
// TTN API FETCH HELPER
// ============================================================================

/**
 * Make a TTN API request with cross-cluster routing.
 * Routes IS paths to EU1 and data plane paths to the regional cluster.
 */
export async function ttnFetch(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: Record<string, unknown>,
  _region: string = DEFAULT_CLUSTER
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  let url: string;
  if (endpoint.startsWith("http")) {
    url = endpoint;
  } else {
    const { url: baseUrl } = getEndpointForPath(endpoint);
    url = `${baseUrl}${endpoint}`;
  }

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
