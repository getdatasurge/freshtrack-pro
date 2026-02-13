/**
 * TTN Gateway Lookup — resolves a gateway's actual TTN ID from its EUI.
 *
 * Problem: Gateways can be registered on TTN with custom IDs (e.g. "my-gateway")
 * rather than the conventional "eui-{eui}" format. Our edge functions previously
 * only tried GET /api/v3/gateways/eui-{eui}, which returns 404 for custom IDs.
 *
 * Strategy:
 *   1. Try direct lookup: GET /api/v3/gateways/eui-{eui}
 *   2. If 404, call auth_info to determine key scope (user or org)
 *   3. List gateways for that scope and search by matching EUI
 */

import { IDENTITY_SERVER_URL } from "./ttnBase.ts";

export interface GatewayLookupResult {
  found: boolean;
  gatewayId?: string;
  gatewayData?: Record<string, unknown>;
}

/**
 * Find a gateway on TTN by its EUI, regardless of its registration ID.
 *
 * @param apiKey - TTN API key (org-scoped, user-scoped, or admin)
 * @param gatewayEui - Gateway EUI (any format: with/without colons/dashes)
 * @param options - Optional request ID for logging
 */
export async function findTtnGatewayByEui(
  apiKey: string,
  gatewayEui: string,
  options?: { requestId?: string }
): Promise<GatewayLookupResult> {
  const requestId = options?.requestId || "?";
  const euiClean = gatewayEui.toLowerCase().replace(/[:-]/g, "");
  const euiUpper = euiClean.toUpperCase();
  const baseUrl = IDENTITY_SERVER_URL;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // ── Strategy 1: Direct lookup by conventional eui-{eui} ID ──────────
  const directId = `eui-${euiClean}`;
  const directUrl = `${baseUrl}/api/v3/gateways/${directId}?field_mask=ids,name,description`;
  console.log(`[ttn-gateway-lookup] [${requestId}] Trying direct lookup: ${directId}`);

  try {
    const directResp = await fetch(directUrl, { headers });

    if (directResp.ok) {
      const data = await directResp.json();
      const resolvedId = data.ids?.gateway_id || directId;
      console.log(`[ttn-gateway-lookup] [${requestId}] Found via direct lookup: ${resolvedId}`);
      return { found: true, gatewayId: resolvedId, gatewayData: data };
    }

    if (directResp.status !== 404) {
      // Non-404 error (401, 403, 500) — can't search further with this key
      console.warn(`[ttn-gateway-lookup] [${requestId}] Direct lookup returned ${directResp.status}`);
      return { found: false };
    }
  } catch (err) {
    console.warn(`[ttn-gateway-lookup] [${requestId}] Direct lookup network error:`, err);
    // Fall through to list-based search
  }

  // ── Strategy 2: List gateways and search by EUI ─────────────────────
  console.log(`[ttn-gateway-lookup] [${requestId}] Direct lookup 404 — searching by EUI via gateway list`);

  // Get auth info to determine listing endpoint
  let authInfo: Record<string, unknown> | null = null;
  try {
    const authResp = await fetch(`${baseUrl}/api/v3/auth_info`, { headers });
    if (!authResp.ok) {
      console.warn(`[ttn-gateway-lookup] [${requestId}] auth_info failed: ${authResp.status}`);
      return { found: false };
    }
    authInfo = await authResp.json();
  } catch (err) {
    console.warn(`[ttn-gateway-lookup] [${requestId}] auth_info network error:`, err);
    return { found: false };
  }

  // deno-lint-ignore no-explicit-any
  const entityIds = (authInfo as any)?.api_key?.entity_ids;

  // Build list of endpoints to try (user-scoped and/or org-scoped)
  const listUrls: string[] = [];

  if (entityIds?.user_ids?.user_id) {
    const userId = entityIds.user_ids.user_id;
    listUrls.push(`${baseUrl}/api/v3/users/${userId}/gateways?field_mask=ids,name`);
    console.log(`[ttn-gateway-lookup] [${requestId}] Will list gateways for user: ${userId}`);
  }

  if (entityIds?.organization_ids?.organization_id) {
    const orgId = entityIds.organization_ids.organization_id;
    listUrls.push(`${baseUrl}/api/v3/organizations/${orgId}/gateways?field_mask=ids,name`);
    console.log(`[ttn-gateway-lookup] [${requestId}] Will list gateways for org: ${orgId}`);
  }

  if (listUrls.length === 0) {
    console.warn(`[ttn-gateway-lookup] [${requestId}] Cannot determine listing endpoint from auth_info`);
    return { found: false };
  }

  for (const listUrl of listUrls) {
    try {
      const listResp = await fetch(listUrl, { headers });

      if (!listResp.ok) {
        console.warn(`[ttn-gateway-lookup] [${requestId}] Gateway list failed (${listResp.status}): ${listUrl}`);
        continue;
      }

      const listData = await listResp.json();
      // deno-lint-ignore no-explicit-any
      const gateways: Array<Record<string, any>> = listData.gateways || [];
      console.log(`[ttn-gateway-lookup] [${requestId}] Listed ${gateways.length} gateway(s), searching for EUI ${euiUpper}`);

      for (const gw of gateways) {
        const gwEui = (gw.ids?.eui || "").toUpperCase().replace(/[:-]/g, "");
        if (gwEui === euiUpper) {
          const resolvedId = gw.ids?.gateway_id as string;
          console.log(`[ttn-gateway-lookup] [${requestId}] Found by EUI search: ${resolvedId}`);
          return { found: true, gatewayId: resolvedId, gatewayData: gw };
        }
      }
    } catch (err) {
      console.warn(`[ttn-gateway-lookup] [${requestId}] Gateway list error:`, err);
      continue;
    }
  }

  console.log(`[ttn-gateway-lookup] [${requestId}] Gateway not found by EUI search`);
  return { found: false };
}
