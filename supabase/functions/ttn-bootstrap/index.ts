/**
 * TTN Bootstrap Edge Function v2.0
 *
 * Handles full TTN provisioning flow:
 * Step 1:  Create Organization
 * Step 1B: Create Organization API Key
 * Step 2:  Create Application
 * Step 2B: Create Application API Key
 * Step 3:  Create Webhook
 *
 * Key fixes in this version:
 * - ALWAYS uses EU1 cluster
 * - Sanitizes org_id (no @ttn suffix, lowercase, URL-safe)
 * - Verifies org ownership BEFORE marking step 1 success
 * - Correct auth_info parsing (nested rights path)
 * - Proper error classification
 * - Start Fresh with org_id rotation on failure
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS
// ============================================================================

const TTN_BASE_URL = "https://eu1.cloud.thethings.network";
const TTN_REGION = "eu1"; // Default region
const FUNCTION_VERSION = "ttn-bootstrap-v2.9-region-param-20260108";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPES
// ============================================================================

interface ProvisioningRequest {
  action: "preflight" | "provision" | "start_fresh" | "status" | "validate_only";
  org_id: string;
  organization_id?: string;
  cluster?: string;
  application_id?: string;
  api_key?: string;
  customer_id?: string;
  site_id?: string;
  force_new_org?: boolean;
}

interface StepResult {
  step: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error_code?: string;
  error_category?: ErrorCategory;
}

interface ProvisioningResult {
  success: boolean;
  steps: StepResult[];
  ttn_org_id?: string;
  ttn_org_api_key?: string;
  ttn_app_id?: string;
  ttn_app_api_key?: string;
  webhook_id?: string;
  webhook_secret?: string;
  region?: string;
  version: string;
}

type ErrorCategory =
  | "ORGANIZATION_OWNERSHIP_ISSUE"
  | "APPLICATION_OWNERSHIP_ISSUE"
  | "WRONG_REGION"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

interface TtnAuthInfo {
  rights: string[];
  userId?: string;
  entityType: "user" | "organization" | "application" | "gateway" | "unknown";
  entityId?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize a TTN identifier to be valid:
 * - lowercase
 * - only alphanumeric and hyphens
 * - no leading/trailing hyphens
 * - no consecutive hyphens
 * - strip @ttn suffix
 * - max 36 characters
 */
function sanitizeTtnId(input: string): string {
  let sanitized = input
    .toLowerCase()
    .replace(/@ttn$/i, "")           // Remove @ttn suffix
    .replace(/[^a-z0-9-]/g, "-")     // Replace invalid chars with hyphen
    .replace(/-+/g, "-")              // Collapse consecutive hyphens
    .replace(/^-+|-+$/g, "");         // Trim leading/trailing hyphens

  // Ensure max length of 36 chars (TTN limit)
  if (sanitized.length > 36) {
    sanitized = sanitized.substring(0, 36).replace(/-+$/, "");
  }

  // Ensure it starts with a letter (TTN requirement)
  if (!/^[a-z]/.test(sanitized)) {
    sanitized = "fg-" + sanitized;
  }

  return sanitized;
}

/**
 * Generate a short random suffix for org_id rotation
 */
function generateSuffix(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Make a request to TTN API with proper error handling
 */
async function ttnRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    apiKey: string;
    body?: Record<string, unknown>;
  }
): Promise<{
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errorCode?: string;
  errorCategory: ErrorCategory;
}> {
  const { method = "GET", apiKey, body } = options;

  const url = `${TTN_BASE_URL}${endpoint}`;
  console.log(`[TTN] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `FrostGuard/${FUNCTION_VERSION}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    let data: T | undefined;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      const parsed = JSON.parse(responseText);
      if (response.ok) {
        data = parsed as T;
      } else {
        // TTN error response shape: { code: number, message: string, details: [...] }
        errorCode = parsed.code?.toString() || parsed.message;
        errorMessage = parsed.message || responseText;
      }
    } catch {
      errorMessage = responseText;
    }

    // Classify error category
    let errorCategory: ErrorCategory = "UNKNOWN";
    if (response.ok) {
      errorCategory = "UNKNOWN"; // Not an error
    } else if (response.status === 404 && responseText.includes("route_not_found")) {
      errorCategory = "WRONG_REGION";
    } else if (response.status === 403) {
      if (errorMessage?.includes("no_organization_rights") || errorCode === "no_organization_rights") {
        errorCategory = "ORGANIZATION_OWNERSHIP_ISSUE";
      } else if (errorMessage?.includes("no_application_rights") || errorCode === "no_application_rights") {
        errorCategory = "APPLICATION_OWNERSHIP_ISSUE";
      } else {
        errorCategory = "INVALID_CREDENTIALS";
      }
    } else if (response.status === 401) {
      errorCategory = "INVALID_CREDENTIALS";
    } else if (response.status === 429) {
      errorCategory = "RATE_LIMITED";
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: errorMessage,
      errorCode,
      errorCategory,
    };
  } catch (err) {
    console.error(`[TTN] Network error:`, err);
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
      errorCategory: "NETWORK_ERROR",
    };
  }
}

/**
 * Parse TTN auth_info response with correct nested path handling
 *
 * Response shape:
 * {
 *   "api_key": {
 *     "api_key": {
 *       "rights": [...]
 *     },
 *     "entity_ids": {
 *       "user_ids": { "user_id": "..." } |
 *       "organization_ids": { "organization_id": "..." } |
 *       "application_ids": { "application_id": "..." }
 *     }
 *   }
 * }
 *
 * OR for some keys:
 * {
 *   "api_key": {
 *     "rights": [...]
 *   }
 * }
 *
 * OR universal rights:
 * {
 *   "universal_rights": [...]
 * }
 */
function parseAuthInfo(data: Record<string, unknown>): TtnAuthInfo {
  let rights: string[] = [];
  let entityType: TtnAuthInfo["entityType"] = "unknown";
  let entityId: string | undefined;
  let userId: string | undefined;

  // Try nested path first: data.api_key.api_key.rights
  const apiKeyOuter = data.api_key as Record<string, unknown> | undefined;
  if (apiKeyOuter) {
    const apiKeyInner = apiKeyOuter.api_key as Record<string, unknown> | undefined;
    if (apiKeyInner && Array.isArray(apiKeyInner.rights)) {
      rights = apiKeyInner.rights as string[];
    } else if (Array.isArray(apiKeyOuter.rights)) {
      // Fallback: data.api_key.rights
      rights = apiKeyOuter.rights as string[];
    }

    // Parse entity_ids
    const entityIds = apiKeyOuter.entity_ids as Record<string, unknown> | undefined;
    if (entityIds) {
      if (entityIds.user_ids) {
        const userIds = entityIds.user_ids as Record<string, string>;
        entityType = "user";
        userId = userIds.user_id;
        entityId = userIds.user_id;
      } else if (entityIds.organization_ids) {
        const orgIds = entityIds.organization_ids as Record<string, string>;
        entityType = "organization";
        entityId = orgIds.organization_id;
      } else if (entityIds.application_ids) {
        const appIds = entityIds.application_ids as Record<string, string>;
        entityType = "application";
        entityId = appIds.application_id;
      } else if (entityIds.gateway_ids) {
        const gwIds = entityIds.gateway_ids as Record<string, string>;
        entityType = "gateway";
        entityId = gwIds.gateway_id;
      }
    }
  }

  // Fallback: universal_rights
  if (rights.length === 0 && Array.isArray(data.universal_rights)) {
    rights = data.universal_rights as string[];
  }

  console.log(`[AuthInfo] Parsed: entityType=${entityType}, entityId=${entityId}, rights=${rights.length}`);

  return { rights, userId, entityType, entityId };
}

/**
 * Verify that the API key is a valid personal (user-scoped) key
 * REJECT keys scoped to organizations, applications, or gateways
 * ACCEPT keys scoped to user_ids (personal keys)
 */
async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  authInfo?: TtnAuthInfo;
  error?: string;
  errorCategory?: ErrorCategory;
}> {
  const result = await ttnRequest<Record<string, unknown>>("/api/v3/auth_info", {
    apiKey,
  });

  if (!result.ok) {
    return {
      valid: false,
      error: result.error || "Failed to validate API key",
      errorCategory: result.errorCategory,
    };
  }

  const authInfo = parseAuthInfo(result.data!);

  // Personal keys are scoped to user_ids - this is EXPECTED and VALID
  if (authInfo.entityType === "user") {
    // Check for required rights
    const hasOrgCreate =
      authInfo.rights.includes("RIGHT_USER_ALL") ||
      authInfo.rights.includes("RIGHT_USER_ORGANIZATIONS_CREATE");

    if (!hasOrgCreate) {
      return {
        valid: false,
        authInfo,
        error: "API key lacks RIGHT_USER_ORGANIZATIONS_CREATE permission",
        errorCategory: "INVALID_CREDENTIALS",
      };
    }

    return { valid: true, authInfo };
  }

  // REJECT keys scoped to other entity types
  if (authInfo.entityType === "organization") {
    return {
      valid: false,
      authInfo,
      error: "API key is scoped to an organization. Use a personal (user-scoped) API key.",
      errorCategory: "INVALID_CREDENTIALS",
    };
  }

  if (authInfo.entityType === "application") {
    return {
      valid: false,
      authInfo,
      error: "API key is scoped to an application. Use a personal (user-scoped) API key.",
      errorCategory: "INVALID_CREDENTIALS",
    };
  }

  if (authInfo.entityType === "gateway") {
    return {
      valid: false,
      authInfo,
      error: "API key is scoped to a gateway. Use a personal (user-scoped) API key.",
      errorCategory: "INVALID_CREDENTIALS",
    };
  }

  // Unknown entity type - might still work if rights are present
  if (authInfo.rights.length > 0) {
    return { valid: true, authInfo };
  }

  return {
    valid: false,
    authInfo,
    error: "Could not determine API key scope",
    errorCategory: "INVALID_CREDENTIALS",
  };
}

/**
 * Verify organization ownership by checking:
 * 1. Organization exists (GET /organizations/{orgId})
 * 2. User has required rights (GET /organizations/{orgId}/rights)
 */
async function verifyOrgOwnership(
  orgId: string,
  apiKey: string
): Promise<{
  verified: boolean;
  error?: string;
  errorCategory?: ErrorCategory;
  rights?: string[];
}> {
  console.log(`[Verify] Checking ownership of org: ${orgId}`);

  // Step 1: Check org exists and we can access it
  const orgResult = await ttnRequest<Record<string, unknown>>(
    `/api/v3/organizations/${orgId}`,
    { apiKey }
  );

  if (!orgResult.ok) {
    console.log(`[Verify] Org GET failed: ${orgResult.status} ${orgResult.error}`);
    return {
      verified: false,
      error: orgResult.error || `Organization ${orgId} not found or not accessible`,
      errorCategory: orgResult.errorCategory,
    };
  }

  // Step 2: Check we have required rights
  const rightsResult = await ttnRequest<{ rights?: string[] }>(
    `/api/v3/organizations/${orgId}/rights`,
    { apiKey }
  );

  if (!rightsResult.ok) {
    console.log(`[Verify] Rights GET failed: ${rightsResult.status} ${rightsResult.error}`);
    return {
      verified: false,
      error: rightsResult.error || `Cannot read rights for organization ${orgId}`,
      errorCategory: rightsResult.errorCategory,
    };
  }

  const rights = rightsResult.data?.rights || [];
  console.log(`[Verify] Org rights: ${rights.join(", ")}`);

  // Check for required rights to create API keys
  const hasApiKeyRight =
    rights.includes("RIGHT_ORGANIZATION_ALL") ||
    rights.includes("RIGHT_ORGANIZATION_SETTINGS_API_KEYS");

  if (!hasApiKeyRight) {
    return {
      verified: false,
      error: `Missing RIGHT_ORGANIZATION_SETTINGS_API_KEYS for ${orgId}`,
      errorCategory: "ORGANIZATION_OWNERSHIP_ISSUE",
      rights,
    };
  }

  return { verified: true, rights };
}

/**
 * Verify application ownership
 */
async function verifyAppOwnership(
  appId: string,
  apiKey: string
): Promise<{
  verified: boolean;
  error?: string;
  errorCategory?: ErrorCategory;
  rights?: string[];
}> {
  console.log(`[Verify] Checking ownership of app: ${appId}`);

  const appResult = await ttnRequest<Record<string, unknown>>(
    `/api/v3/applications/${appId}`,
    { apiKey }
  );

  if (!appResult.ok) {
    return {
      verified: false,
      error: appResult.error || `Application ${appId} not found or not accessible`,
      errorCategory: appResult.errorCategory,
    };
  }

  const rightsResult = await ttnRequest<{ rights?: string[] }>(
    `/api/v3/applications/${appId}/rights`,
    { apiKey }
  );

  if (!rightsResult.ok) {
    return {
      verified: false,
      error: rightsResult.error || `Cannot read rights for application ${appId}`,
      errorCategory: rightsResult.errorCategory,
    };
  }

  const rights = rightsResult.data?.rights || [];
  const hasRequired =
    rights.includes("RIGHT_APPLICATION_ALL") ||
    (rights.includes("RIGHT_APPLICATION_SETTINGS_API_KEYS") &&
      rights.includes("RIGHT_APPLICATION_TRAFFIC_READ"));

  if (!hasRequired) {
    return {
      verified: false,
      error: `Missing required rights for ${appId}`,
      errorCategory: "APPLICATION_OWNERSHIP_ISSUE",
      rights,
    };
  }

  return { verified: true, rights };
}

// ============================================================================
// PROVISIONING STEPS
// ============================================================================

/**
 * Step 1: Create TTN Organization
 */
async function createOrganization(
  orgId: string,
  apiKey: string,
  userId: string
): Promise<StepResult> {
  const sanitizedOrgId = sanitizeTtnId(orgId);
  console.log(`[Step1] Creating org: ${sanitizedOrgId} (original: ${orgId}) under user: ${userId}`);

  // TTN requires user-scoped endpoint for organization creation
  const createResult = await ttnRequest<Record<string, unknown>>(`/api/v3/users/${userId}/organizations`, {
    method: "POST",
    apiKey,
    body: {
      organization: {
        ids: { organization_id: sanitizedOrgId },
        name: `FrostGuard - ${sanitizedOrgId}`,
        description: `Auto-provisioned by FrostGuard for customer monitoring`,
      },
    },
  });

  // Handle response status codes STRICTLY
  if (createResult.status === 201) {
    // Success - but MUST verify ownership
    console.log(`[Step1] Org created with 201, verifying ownership...`);
    const verify = await verifyOrgOwnership(sanitizedOrgId, apiKey);

    if (!verify.verified) {
      return {
        step: "1_create_org",
        success: false,
        message: `Organization created but ownership verification failed: ${verify.error}`,
        error_code: "VERIFY_FAILED",
        error_category: verify.errorCategory,
        data: { org_id: sanitizedOrgId },
      };
    }

    return {
      step: "1_create_org",
      success: true,
      message: `Organization ${sanitizedOrgId} created and verified`,
      data: { org_id: sanitizedOrgId, rights: verify.rights },
    };
  }

  if (createResult.status === 409) {
    // Org exists - MUST verify we own it
    console.log(`[Step1] Org exists (409), verifying ownership...`);
    const verify = await verifyOrgOwnership(sanitizedOrgId, apiKey);

    if (!verify.verified) {
      return {
        step: "1_create_org",
        success: false,
        message: `Organization ${sanitizedOrgId} exists but you don't own it: ${verify.error}`,
        error_code: "NOT_OWNER",
        error_category: verify.errorCategory,
        data: { org_id: sanitizedOrgId },
      };
    }

    return {
      step: "1_create_org",
      success: true,
      message: `Organization ${sanitizedOrgId} already exists and ownership verified`,
      data: { org_id: sanitizedOrgId, rights: verify.rights, existed: true },
    };
  }

  // Any other status = FAIL
  return {
    step: "1_create_org",
    success: false,
    message: `Failed to create organization: ${createResult.error}`,
    error_code: createResult.errorCode || `HTTP_${createResult.status}`,
    error_category: createResult.errorCategory,
    data: { org_id: sanitizedOrgId },
  };
}

/**
 * Step 1B: Create Organization API Key
 */
async function createOrgApiKey(
  orgId: string,
  apiKey: string
): Promise<StepResult & { orgApiKey?: string }> {
  const sanitizedOrgId = sanitizeTtnId(orgId);
  console.log(`[Step1B] Creating API key for org: ${sanitizedOrgId}`);

  const keyName = `frostguard-org-key-${Date.now()}`;

  const result = await ttnRequest<{ api_key?: string; key?: string }>(
    `/api/v3/organizations/${sanitizedOrgId}/api-keys`,
    {
      method: "POST",
      apiKey,
      body: {
        name: keyName,
        rights: [
          "RIGHT_ORGANIZATION_ALL",
          "RIGHT_APPLICATION_ALL",
        ],
        expires_at: null, // No expiration
      },
    }
  );

  if (!result.ok) {
    return {
      step: "1b_create_org_api_key",
      success: false,
      message: `Failed to create org API key: ${result.error}`,
      error_code: result.errorCode,
      error_category: result.errorCategory,
      data: { org_id: sanitizedOrgId },
    };
  }

  // TTN returns the key in either api_key or key field
  const orgApiKey = result.data?.api_key || result.data?.key;

  if (!orgApiKey) {
    return {
      step: "1b_create_org_api_key",
      success: false,
      message: "API key created but key value not returned",
      error_code: "NO_KEY_RETURNED",
      error_category: "UNKNOWN",
      data: { org_id: sanitizedOrgId },
    };
  }

  return {
    step: "1b_create_org_api_key",
    success: true,
    message: `Organization API key created: ${keyName}`,
    data: { org_id: sanitizedOrgId, key_name: keyName },
    orgApiKey,
  };
}

/**
 * Step 2: Create TTN Application under Organization
 */
async function createApplication(
  orgId: string,
  appId: string,
  apiKey: string
): Promise<StepResult> {
  const sanitizedOrgId = sanitizeTtnId(orgId);
  const sanitizedAppId = sanitizeTtnId(appId);
  console.log(`[Step2] Creating app: ${sanitizedAppId} under org: ${sanitizedOrgId}`);

  const createResult = await ttnRequest<Record<string, unknown>>(
    `/api/v3/organizations/${sanitizedOrgId}/applications`,
    {
      method: "POST",
      apiKey,
      body: {
        application: {
          ids: { application_id: sanitizedAppId },
          name: `FrostGuard App - ${sanitizedAppId}`,
          description: "Temperature monitoring application",
        },
      },
    }
  );

  if (createResult.status === 201) {
    // Verify ownership
    const verify = await verifyAppOwnership(sanitizedAppId, apiKey);
    if (!verify.verified) {
      return {
        step: "2_create_app",
        success: false,
        message: `Application created but verification failed: ${verify.error}`,
        error_code: "VERIFY_FAILED",
        error_category: verify.errorCategory,
        data: { org_id: sanitizedOrgId, app_id: sanitizedAppId },
      };
    }

    return {
      step: "2_create_app",
      success: true,
      message: `Application ${sanitizedAppId} created and verified`,
      data: { org_id: sanitizedOrgId, app_id: sanitizedAppId },
    };
  }

  if (createResult.status === 409) {
    // App exists - verify ownership
    const verify = await verifyAppOwnership(sanitizedAppId, apiKey);
    if (!verify.verified) {
      return {
        step: "2_create_app",
        success: false,
        message: `Application ${sanitizedAppId} exists but you don't own it: ${verify.error}`,
        error_code: "NOT_OWNER",
        error_category: verify.errorCategory,
        data: { org_id: sanitizedOrgId, app_id: sanitizedAppId },
      };
    }

    return {
      step: "2_create_app",
      success: true,
      message: `Application ${sanitizedAppId} already exists and ownership verified`,
      data: { org_id: sanitizedOrgId, app_id: sanitizedAppId, existed: true },
    };
  }

  return {
    step: "2_create_app",
    success: false,
    message: `Failed to create application: ${createResult.error}`,
    error_code: createResult.errorCode || `HTTP_${createResult.status}`,
    error_category: createResult.errorCategory,
    data: { org_id: sanitizedOrgId, app_id: sanitizedAppId },
  };
}

/**
 * Step 2B: Create Application API Key
 */
async function createAppApiKey(
  appId: string,
  apiKey: string
): Promise<StepResult & { appApiKey?: string }> {
  const sanitizedAppId = sanitizeTtnId(appId);
  console.log(`[Step2B] Creating API key for app: ${sanitizedAppId}`);

  const keyName = `frostguard-app-key-${Date.now()}`;

  const result = await ttnRequest<{ api_key?: string; key?: string }>(
    `/api/v3/applications/${sanitizedAppId}/api-keys`,
    {
      method: "POST",
      apiKey,
      body: {
        name: keyName,
        rights: [
          "RIGHT_APPLICATION_ALL",
        ],
        expires_at: null,
      },
    }
  );

  if (!result.ok) {
    return {
      step: "2b_create_app_api_key",
      success: false,
      message: `Failed to create app API key: ${result.error}`,
      error_code: result.errorCode,
      error_category: result.errorCategory,
      data: { app_id: sanitizedAppId },
    };
  }

  const appApiKey = result.data?.api_key || result.data?.key;

  if (!appApiKey) {
    return {
      step: "2b_create_app_api_key",
      success: false,
      message: "API key created but key value not returned",
      error_code: "NO_KEY_RETURNED",
      error_category: "UNKNOWN",
      data: { app_id: sanitizedAppId },
    };
  }

  return {
    step: "2b_create_app_api_key",
    success: true,
    message: `Application API key created: ${keyName}`,
    data: { app_id: sanitizedAppId, key_name: keyName },
    appApiKey,
  };
}

/**
 * Step 3: Create Webhook
 */
async function createWebhook(
  appId: string,
  apiKey: string,
  webhookUrl: string
): Promise<StepResult & { webhookId?: string; webhookSecret?: string }> {
  const sanitizedAppId = sanitizeTtnId(appId);
  const webhookId = `frostguard-webhook`;
  const webhookSecret = crypto.randomUUID().replace(/-/g, "");

  console.log(`[Step3] Creating webhook for app: ${sanitizedAppId}`);

  // First, check if webhook exists and delete it
  const existingCheck = await ttnRequest(
    `/api/v3/as/webhooks/${sanitizedAppId}/${webhookId}`,
    { apiKey }
  );

  if (existingCheck.ok) {
    console.log(`[Step3] Existing webhook found, deleting...`);
    await ttnRequest(`/api/v3/as/webhooks/${sanitizedAppId}/${webhookId}`, {
      method: "DELETE",
      apiKey,
    });
  }

  // Create new webhook
  const result = await ttnRequest<Record<string, unknown>>(
    `/api/v3/as/webhooks/${sanitizedAppId}`,
    {
      method: "POST",
      apiKey,
      body: {
        webhook: {
          ids: {
            application_ids: { application_id: sanitizedAppId },
            webhook_id: webhookId,
          },
          base_url: webhookUrl,
          format: "json",
          headers: {
            "X-Webhook-Secret": webhookSecret,
          },
          uplink_message: {
            path: "",
          },
          join_accept: {
            path: "/join",
          },
          downlink_ack: {
            path: "/ack",
          },
          downlink_nack: {
            path: "/nack",
          },
          downlink_sent: {
            path: "/sent",
          },
          downlink_failed: {
            path: "/failed",
          },
          downlink_queued: {
            path: "/queued",
          },
          location_solved: {
            path: "/location",
          },
          service_data: {
            path: "/service",
          },
        },
      },
    }
  );

  if (!result.ok) {
    return {
      step: "3_create_webhook",
      success: false,
      message: `Failed to create webhook: ${result.error}`,
      error_code: result.errorCode,
      error_category: result.errorCategory,
      data: { app_id: sanitizedAppId },
    };
  }

  return {
    step: "3_create_webhook",
    success: true,
    message: `Webhook ${webhookId} created successfully`,
    data: { app_id: sanitizedAppId, webhook_id: webhookId },
    webhookId,
    webhookSecret,
  };
}

// ============================================================================
// MAIN PROVISIONING FLOW
// ============================================================================

async function runProvisioning(
  request: ProvisioningRequest,
  adminApiKey: string,
  supabaseClient: any,  // Type relaxed to avoid strict typing issues with dynamic tables
  webhookBaseUrl: string
): Promise<ProvisioningResult> {
  const steps: StepResult[] = [];
  let currentOrgId = request.org_id;
  let orgApiKey: string | undefined;
  let appApiKey: string | undefined;
  let webhookId: string | undefined;
  let webhookSecret: string | undefined;

  // Validate API key first
  const validation = await validateApiKey(adminApiKey);
  if (!validation.valid) {
    return {
      success: false,
      steps: [
        {
          step: "0_preflight",
          success: false,
          message: validation.error || "API key validation failed",
          error_category: validation.errorCategory,
        },
      ],
      version: FUNCTION_VERSION,
    };
  }

  const userId = validation.authInfo?.userId || "frostguard101";

  //                                                                          
  // STEP 1: Create Organization
  //                                                                          
  let step1 = await createOrganization(currentOrgId, adminApiKey, userId);

  // If step 1 fails with ownership issue, try rotating org_id (Start Fresh logic)
  if (
    !step1.success &&
    (step1.error_category === "ORGANIZATION_OWNERSHIP_ISSUE" ||
      step1.error_code === "NOT_OWNER") &&
    !request.force_new_org
  ) {
    console.log(`[Provision] Step 1 failed, rotating org_id...`);
    const rotatedOrgId = `${sanitizeTtnId(request.org_id)}-${generateSuffix()}`;
    step1 = await createOrganization(rotatedOrgId, adminApiKey, userId);
    if (step1.success) {
      currentOrgId = rotatedOrgId;
    }
  }

  steps.push(step1);
  if (!step1.success) {
    return {
      success: false,
      steps,
      ttn_org_id: sanitizeTtnId(currentOrgId),
      version: FUNCTION_VERSION,
    };
  }

  currentOrgId = sanitizeTtnId(currentOrgId);

  //                                                                          
  // STEP 1B: Create Organization API Key
  //                                                                          
  const step1b = await createOrgApiKey(currentOrgId, adminApiKey);
  steps.push(step1b);

  if (!step1b.success) {
    return {
      success: false,
      steps,
      ttn_org_id: currentOrgId,
      version: FUNCTION_VERSION,
    };
  }

  orgApiKey = step1b.orgApiKey;

  //                                                                          
  // STEP 2: Create Application
  //                                                                          
  // Use orgApiKey if available (has RIGHT_APPLICATION_ALL), fallback to adminApiKey
  const appCreationKey = orgApiKey || adminApiKey;
  console.log(`[Step2] Using credential: ${orgApiKey ? 'org_api_key' : 'admin_api_key'} (key_last4: ${appCreationKey.slice(-4)})`);
  
  const appId = `${currentOrgId}-app`;
  const step2 = await createApplication(currentOrgId, appId, appCreationKey);
  steps.push(step2);

  if (!step2.success) {
    return {
      success: false,
      steps,
      ttn_org_id: currentOrgId,
      ttn_org_api_key: orgApiKey,
      version: FUNCTION_VERSION,
    };
  }

  const sanitizedAppId = sanitizeTtnId(appId);

  //                                                                          
  // STEP 2B: Create Application API Key
  //                                                                          
  // CRITICAL: Use orgApiKey here - it has RIGHT_APPLICATION_ALL needed to create app keys
  const appKeyCreationKey = orgApiKey || adminApiKey;
  console.log(`[Step2B] Using credential: ${orgApiKey ? 'org_api_key' : 'admin_api_key'} (key_last4: ${appKeyCreationKey.slice(-4)})`);
  
  const step2b = await createAppApiKey(sanitizedAppId, appKeyCreationKey);
  steps.push(step2b);

  if (!step2b.success) {
    return {
      success: false,
      steps,
      ttn_org_id: currentOrgId,
      ttn_org_api_key: orgApiKey,
      ttn_app_id: sanitizedAppId,
      version: FUNCTION_VERSION,
    };
  }

  appApiKey = step2b.appApiKey;

  //                                                                          
  // STEP 3: Create Webhook
  //                                                                          
  const webhookCreationKey = orgApiKey || adminApiKey;
  console.log(`[Step3] Using credential: ${orgApiKey ? 'org_api_key' : 'admin_api_key'} (key_last4: ${webhookCreationKey.slice(-4)})`);
  
  const webhookUrl = `${webhookBaseUrl}/functions/v1/ttn-webhook`;
  const step3 = await createWebhook(sanitizedAppId, webhookCreationKey, webhookUrl);
  steps.push(step3);

  if (!step3.success) {
    return {
      success: false,
      steps,
      ttn_org_id: currentOrgId,
      ttn_org_api_key: orgApiKey,
      ttn_app_id: sanitizedAppId,
      ttn_app_api_key: appApiKey,
      version: FUNCTION_VERSION,
    };
  }

  webhookId = step3.webhookId;
  webhookSecret = step3.webhookSecret;

  //                                                                          
  // SUCCESS: Save to database
  //                                                                          
  // Use region from request, fallback to default
  const effectiveRegion = request.cluster || TTN_REGION;
  console.log(`[DB] Saving with region: ${effectiveRegion}`);

  try {
    // Note: ttn_settings table may not exist - this is a legacy reference
    // The primary storage is ttn_connections managed by manage-ttn-settings
    const { error: dbError } = await (supabaseClient as any).from("ttn_settings").upsert(
      {
        org_id: request.customer_id || currentOrgId,
        site_id: request.site_id || null,
        enabled: true,
        cluster: effectiveRegion,
        application_id: sanitizedAppId,
        api_key: appApiKey, // Store app API key for webhook auth
        webhook_secret: webhookSecret,
        last_test_at: new Date().toISOString(),
        last_test_success: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    );

    if (dbError) {
      console.error(`[DB] Failed to save ttn_settings:`, dbError);
    }

    // CRITICAL: Also update ttn_connections table with the region
    // This is what ttn-provision-device reads from. Without this update,
    // device provisioning will use the wrong cluster (default) causing
    // split-cluster bugs where IS records are on eu1 but JS/NS/AS go elsewhere.
    if (request.customer_id) {
      const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") ||
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32) || "";

      // Simple XOR obfuscation for API key storage
      const obfuscateKey = (key: string, salt: string): string => {
        const result: number[] = [];
        for (let i = 0; i < key.length; i++) {
          result.push(key.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
        }
        return btoa(String.fromCharCode(...result));
      };

      const { error: connError } = await supabaseClient
        .from("ttn_connections")
        .update({
          ttn_region: TTN_REGION,  // CRITICAL: Set region to eu1
          ttn_organization_id: currentOrgId,
          ttn_application_id: sanitizedAppId,
          ttn_api_key_encrypted: appApiKey ? obfuscateKey(appApiKey, encryptionSalt) : null,
          ttn_api_key_last4: appApiKey ? appApiKey.slice(-4) : null,
          ttn_webhook_secret_encrypted: webhookSecret ? obfuscateKey(webhookSecret, encryptionSalt) : null,
          ttn_webhook_secret_last4: webhookSecret ? webhookSecret.slice(-4) : null,
          provisioning_status: "ready",
          provisioning_error: null,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", request.customer_id);

      if (connError) {
        console.error(`[DB] Failed to update ttn_connections:`, connError);
        steps.push({
          step: "4_save_settings",
          success: false,
          message: `TTN provisioning succeeded but failed to save ttn_connections: ${connError.message}`,
        });
      } else {
        console.log(`[DB] Updated ttn_connections for org ${request.customer_id} with region=${TTN_REGION}`);
        steps.push({
          step: "4_save_settings",
          success: true,
          message: `Settings saved to database (region=${TTN_REGION})`,
        });
      }
    } else {
      steps.push({
        step: "4_save_settings",
        success: !dbError,
        message: dbError ? `Failed: ${dbError.message}` : "Settings saved to ttn_settings",
      });
    }
  } catch (err) {
    console.error(`[DB] Exception:`, err);
  }

  return {
    success: true,
    steps,
    ttn_org_id: currentOrgId,
    ttn_org_api_key: orgApiKey,
    ttn_app_id: sanitizedAppId,
    ttn_app_api_key: appApiKey,
    webhook_id: webhookId,
    webhook_secret: webhookSecret,
    region: effectiveRegion,
    version: FUNCTION_VERSION,
  };
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check endpoint (GET request)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "ok",
        function: "ttn-bootstrap",
        version: FUNCTION_VERSION,
        capabilities: {
          validate_only: true,
          preflight: true,
          provision: true,
          start_fresh: true,
          status: true,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Handle POST with empty body as health check (diagnostics tool may send POST)
  const contentLength = req.headers.get("content-length");
  if (req.method === "POST" && (!contentLength || contentLength === "0")) {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "healthy",
        function: "ttn-bootstrap",
        version: FUNCTION_VERSION,
        hint: "POST with empty body treated as health check",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get environment variables
    const adminApiKey = Deno.env.get("TTN_ADMIN_API_KEY")?.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!adminApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "TTN_ADMIN_API_KEY not configured",
          version: FUNCTION_VERSION,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Supabase environment variables not configured",
          version: FUNCTION_VERSION,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const body = (await req.json()) as ProvisioningRequest;

    if (!body.action) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing action parameter",
          version: FUNCTION_VERSION,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different actions
    switch (body.action) {
      case "preflight": {
        const validation = await validateApiKey(adminApiKey);
        return new Response(
          JSON.stringify({
            success: validation.valid,
            message: validation.valid
              ? "API key validated successfully"
              : validation.error,
            auth_info: validation.authInfo,
            region: TTN_REGION,
            base_url: TTN_BASE_URL,
            version: FUNCTION_VERSION,
          }),
          {
            status: validation.valid ? 200 : 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "provision":
      case "start_fresh": {
        if (!body.org_id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Missing org_id parameter",
              version: FUNCTION_VERSION,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // For start_fresh, force a new org_id suffix
        if (body.action === "start_fresh") {
          body.org_id = `${sanitizeTtnId(body.org_id)}-${generateSuffix()}`;
        }

        const result = await runProvisioning(
          body,
          adminApiKey,
          supabase,
          supabaseUrl
        );

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        // Return current deployment status and diagnostics
        const validation = await validateApiKey(adminApiKey);
        return new Response(
          JSON.stringify({
            success: true,
            version: FUNCTION_VERSION,
            region: TTN_REGION,
            base_url: TTN_BASE_URL,
            api_key_valid: validation.valid,
            api_key_entity_type: validation.authInfo?.entityType,
            api_key_user_id: validation.authInfo?.userId,
            api_key_rights_count: validation.authInfo?.rights.length,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "validate_only": {
        // Validate API key and application access without provisioning
        console.log(`[validate_only] Validating configuration for org: ${body.organization_id || body.org_id}`);
        
        const apiKeyToValidate = body.api_key || adminApiKey;
        const validation = await validateApiKey(apiKeyToValidate);
        
        if (!validation.valid) {
          return new Response(
            JSON.stringify({
              valid: false,
              ok: false,
              error: validation.error,
              error_category: validation.errorCategory,
              version: FUNCTION_VERSION,
            }),
            {
              status: 200, // Return 200 with valid=false for application-level errors
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        // Return successful validation with permissions info
        return new Response(
          JSON.stringify({
            valid: true,
            ok: true,
            message: "Configuration validated successfully",
            permissions: {
              rights: validation.authInfo?.rights || [],
              entity_type: validation.authInfo?.entityType,
              user_id: validation.authInfo?.userId,
            },
            region: TTN_REGION,
            base_url: TTN_BASE_URL,
            request_id: crypto.randomUUID().slice(0, 8),
            version: FUNCTION_VERSION,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown action: ${body.action}`,
            version: FUNCTION_VERSION,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (err) {
    console.error(`[Handler] Unhandled error:`, err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
        version: FUNCTION_VERSION,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
