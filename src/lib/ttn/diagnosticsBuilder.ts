/**
 * TTN Diagnostics Builder
 * Creates support-ready diagnostic snapshots with redacted secrets
 */

import type { TTNConfigContext, TTNValidationResult, TTNConfigState } from '@/types/ttnState';
import { supabase } from '@/integrations/supabase/client';

// Single cluster base URL - must match backend
const CLUSTER_BASE_URL = "https://nam1.cloud.thethings.network";
const CLUSTER_HOST = "nam1.cloud.thethings.network";

export interface TTNDiagnostics {
  generated_at: string;
  app_version: string;
  
  // TTN Config (single cluster)
  config: {
    state: TTNConfigState;
    source: string;
    cluster_base_url: string;
    cluster_host: string;
    application_id: string | null;
    api_key_last4: string | null;
    webhook_configured: boolean;
    webhook_url_redacted: string | null;
  };
  
  // Cluster verification
  cluster_verification: {
    host_locked: boolean;
    expected_host: string;
    planes_use_same_host: boolean;
  };
  
  // Validation
  last_validation: TTNValidationResult | null;
  
  // Recent request_ids for correlation
  recent_request_ids: string[];
  
  // Edge function versions
  edge_function_versions: {
    ttn_bootstrap: string | null;
    manage_ttn_settings: string | null;
    ttn_gateway_preflight: string | null;
  };
  
  // Environment info
  environment: {
    user_agent: string;
    timezone: string;
    locale: string;
    screen_resolution: string;
    online: boolean;
  };
  
  // Organization context
  organization: {
    id: string | null;
    has_sensors: boolean;
    has_gateways: boolean;
  };
}

/**
 * Redact a URL to hide sensitive parts
 */
function redactUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Keep only the host and first path segment
    return `${parsed.protocol}//${parsed.host}/${parsed.pathname.split('/')[1] || '...'}/**REDACTED**`;
  } catch {
    return '**INVALID_URL**';
  }
}

/**
 * Fetch edge function versions from health endpoints
 */
async function fetchEdgeFunctionVersions(): Promise<TTNDiagnostics['edge_function_versions']> {
  const versions: TTNDiagnostics['edge_function_versions'] = {
    ttn_bootstrap: null,
    manage_ttn_settings: null,
    ttn_gateway_preflight: null,
  };

const fetchVersion = async (funcName: string): Promise<string | null> => {
    try {
      // Use native fetch with GET to avoid Supabase SDK always sending POST
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/${funcName}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.warn(`[diagnostics] ${funcName} returned ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      // Handle multiple response formats from different edge functions
      return data?.version || data?.contract?.version || data?.BUILD_VERSION || null;
    } catch (err) {
      console.warn(`[diagnostics] Failed to fetch version for ${funcName}:`, err);
      return null;
    }
  };

  // Fetch in parallel
  const [bootstrap, settings, preflight] = await Promise.all([
    fetchVersion('ttn-bootstrap'),
    fetchVersion('manage-ttn-settings'),
    fetchVersion('ttn-gateway-preflight'),
  ]);

  versions.ttn_bootstrap = bootstrap;
  versions.manage_ttn_settings = settings;
  versions.ttn_gateway_preflight = preflight;

  return versions;
}

/**
 * Build a complete TTN diagnostics snapshot
 */
export async function buildTTNDiagnostics(
  context: TTNConfigContext | null,
  organizationId: string | null,
  settings?: {
    cluster?: string;
    application_id?: string;
    api_key_last4?: string;
    webhook_url?: string;
    is_enabled?: boolean;
  }
): Promise<TTNDiagnostics> {
  // Collect request IDs from context
  const requestIds: string[] = [];
  if (context?.request_id) {
    requestIds.push(context.request_id);
  }
  if (context?.last_validation_result?.request_id) {
    requestIds.push(context.last_validation_result.request_id);
  }

  // Fetch edge function versions
  const edgeVersions = await fetchEdgeFunctionVersions();

  // Check for sensors/gateways if we have an org
  let hasSensors = false;
  let hasGateways = false;
  
  if (organizationId) {
    const [sensorsResult, gatewaysResult] = await Promise.all([
      supabase.from('lora_sensors').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      supabase.from('gateways').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    ]);
    hasSensors = (sensorsResult.count || 0) > 0;
    hasGateways = (gatewaysResult.count || 0) > 0;
  }

  return {
    generated_at: new Date().toISOString(),
    app_version: import.meta.env.VITE_APP_VERSION || 'unknown',
    
    config: {
      state: context?.state || 'local_draft',
      source: context?.source || 'LOCAL',
      cluster_base_url: CLUSTER_BASE_URL,
      cluster_host: CLUSTER_HOST,
      application_id: settings?.application_id || null,
      api_key_last4: settings?.api_key_last4 || null,
      webhook_configured: settings?.is_enabled || false,
      webhook_url_redacted: redactUrl(settings?.webhook_url || null),
    },
    
    cluster_verification: {
      host_locked: true, // Always true - single cluster mode
      expected_host: CLUSTER_HOST,
      planes_use_same_host: true, // All planes use CLUSTER_BASE_URL
    },
    
    last_validation: context?.last_validation_result || null,
    recent_request_ids: requestIds,
    edge_function_versions: edgeVersions,
    
    environment: {
      user_agent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      online: navigator.onLine,
    },
    
    organization: {
      id: organizationId,
      has_sensors: hasSensors,
      has_gateways: hasGateways,
    },
  };
}

/**
 * Download diagnostics as a JSON file
 */
export function downloadDiagnostics(diagnostics: TTNDiagnostics): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const filename = `frostguard-ttn-diagnostics-${timestamp}.json`;
  
  const blob = new Blob(
    [JSON.stringify(diagnostics, null, 2)], 
    { type: 'application/json' }
  );
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy diagnostics to clipboard
 */
export async function copyDiagnosticsToClipboard(diagnostics: TTNDiagnostics): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    return true;
  } catch {
    return false;
  }
}
