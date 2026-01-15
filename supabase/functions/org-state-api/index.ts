/**
 * org-state-api: Pull-based endpoint for Project 2 (Emulator) to fetch authoritative org state
 * 
 * Authentication: Uses PROJECT2_SYNC_API_KEY (no JWT, no service role key)
 * Headers accepted: Authorization: Bearer <key> OR X-Sync-API-Key: <key>
 * 
 * Usage examples:
 * 
 * # Health check (no auth required)
 * curl -X GET "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/org-state-api?action=health"
 * 
 * # Check dirty status
 * curl -X GET "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/org-state-api?org_id=YOUR_ORG_ID&check_only=true" \
 *   -H "X-Sync-API-Key: YOUR_API_KEY"
 * 
 * # Get full org state
 * curl -X GET "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/org-state-api?org_id=YOUR_ORG_ID" \
 *   -H "X-Sync-API-Key: YOUR_API_KEY"
 * 
 * # With debug info
 * curl -X GET "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/org-state-api?org_id=YOUR_ORG_ID" \
 *   -H "X-Sync-API-Key: YOUR_API_KEY" \
 *   -H "X-Debug: 1"
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  validateProject2SyncApiKey, 
  structuredErrorResponse,
  uuidSchema 
} from "../_shared/validation.ts";

const VERSION = "1.1.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-api-key, x-debug',
};

interface OrgSyncPayload {
  organization_id: string;
  sync_version: number;
  updated_at: string;
  sites: Array<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    timezone: string;
    is_active: boolean;
  }>;
  areas: Array<{
    id: string;
    name: string;
    description: string | null;
    site_id: string;
    sort_order: number;
    is_active: boolean;
  }>;
  units: Array<{
    id: string;
    name: string;
    unit_type: string;
    area_id: string;
    site_id: string;
    temp_limit_high: number;
    temp_limit_low: number | null;
    status: string;
    is_active: boolean;
    created_at: string;
  }>;
  sensors: Array<{
    id: string;
    name: string;
    dev_eui: string;
    app_eui: string | null;
    sensor_type: string;
    status: string;
    site_id: string | null;
    unit_id: string | null;
    ttn_device_id: string | null;
    ttn_application_id: string | null;
    manufacturer: string | null;
    model: string | null;
    is_primary: boolean;
    last_seen_at: string | null;
  }>;
  gateways: Array<{
    id: string;
    name: string;
    gateway_eui: string;
    status: string;
    site_id: string | null;
    description: string | null;
    last_seen_at: string | null;
  }>;
  ttn: {
    enabled: boolean;
    provisioning_status: string;
    cluster: string | null;
    application_id: string | null;
    webhook_id: string | null;
    webhook_url: string | null;
    api_key_last4: string | null;
    updated_at: string | null;
  };
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

function log(requestId: string, level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const prefix = `[org-state-api][${requestId}]`;
  const logData = data ? ` ${JSON.stringify(data)}` : '';
  
  if (level === 'error') {
    console.error(`${prefix} ${message}${logData}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}${logData}`);
  } else {
    console.log(`${prefix} ${message}${logData}`);
  }
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const isDebugMode = req.headers.get('X-Debug') === '1';
  
  // Health endpoint (no auth required)
  if (action === 'health') {
    log(requestId, 'info', 'Health check requested');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const syncApiKey = Deno.env.get('PROJECT2_SYNC_API_KEY');
    
    return new Response(
      JSON.stringify({
        ok: true,
        version: VERSION,
        timestamp: new Date().toISOString(),
        request_id: requestId,
        env_configured: {
          supabase_url: !!supabaseUrl,
          sync_api_key: !!syncApiKey,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // All other endpoints require authentication
  const authResult = validateProject2SyncApiKey(req);
  
  if (!authResult.valid) {
    log(requestId, 'warn', 'Authentication failed', { error: authResult.error });
    
    const status = authResult.errorCode === 'NOT_CONFIGURED' ? 500 : 401;
    const hint = authResult.errorCode === 'NOT_CONFIGURED' 
      ? 'Contact FrostGuard admin to configure PROJECT2_SYNC_API_KEY'
      : 'Provide valid API key via Authorization: Bearer <key> or X-Sync-API-Key header';
    
    return structuredErrorResponse(
      status,
      authResult.errorCode || 'UNAUTHORIZED',
      authResult.error || 'Authentication failed',
      requestId,
      corsHeaders,
      { hint }
    );
  }

  // Get org_id from query params or body
  let orgId = url.searchParams.get('org_id');

  // Also support POST with body
  if (!orgId && req.method === 'POST') {
    try {
      const body = await req.json();
      orgId = body.org_id || body.organization_id;
    } catch {
      // No body or invalid JSON
    }
  }

  // Validate org_id is present
  if (!orgId) {
    log(requestId, 'warn', 'Missing org_id parameter');
    return structuredErrorResponse(
      400,
      'BAD_REQUEST',
      'org_id parameter is required',
      requestId,
      corsHeaders,
      { 
        hint: 'Provide org_id as query parameter: ?org_id=<uuid>',
        details: { parameter: 'org_id', received: null }
      }
    );
  }

  // Validate org_id is valid UUID
  const uuidValidation = uuidSchema.safeParse(orgId);
  if (!uuidValidation.success) {
    log(requestId, 'warn', 'Invalid org_id format', { org_id: orgId });
    return structuredErrorResponse(
      400,
      'BAD_REQUEST',
      'org_id must be a valid UUID',
      requestId,
      corsHeaders,
      { 
        hint: 'org_id should be in format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        details: { 
          parameter: 'org_id', 
          received: orgId,
          validation_error: uuidValidation.error.issues[0]?.message 
        }
      }
    );
  }

  // Use anon key - the SECURITY DEFINER function handles access
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Check for dirty status first if requested
    const checkOnly = url.searchParams.get('check_only') === 'true';
    
    if (checkOnly) {
      log(requestId, 'info', 'Checking dirty status', { org_id: orgId });
      
      const { data, error } = await supabase.rpc('check_org_dirty', {
        p_org_id: orgId
      });

      if (error) {
        log(requestId, 'error', 'check_org_dirty RPC failed', { 
          error_message: error.message,
          error_code: error.code 
        });
        
        return structuredErrorResponse(
          500,
          'RPC_FAILED',
          'Failed to check organization dirty status',
          requestId,
          corsHeaders,
          {
            hint: 'The database function may be unavailable or the org may not exist',
            details: {
              rpc_function: 'check_org_dirty',
              error_code: error.code,
              error_message: error.message
            }
          }
        );
      }

      const durationMs = Date.now() - startTime;
      log(requestId, 'info', 'Dirty status check complete', { 
        org_id: orgId, 
        is_dirty: data?.is_dirty,
        duration_ms: durationMs 
      });

      const response: Record<string, unknown> = {
        success: true,
        request_id: requestId,
        ...data
      };

      if (isDebugMode) {
        response._debug = {
          request_id: requestId,
          resolved_org_id: orgId,
          sync_version: data?.sync_version,
          api_key_last4: authResult.keyLast4,
          duration_ms: durationMs
        };
      }

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get full sync payload
    log(requestId, 'info', 'Fetching full state', { org_id: orgId });
    
    const { data, error } = await supabase.rpc('get_org_sync_payload', {
      p_org_id: orgId
    });

    if (error) {
      log(requestId, 'error', 'get_org_sync_payload RPC failed', { 
        error_message: error.message,
        error_code: error.code,
        error_details: error.details
      });
      
      return structuredErrorResponse(
        500,
        'RPC_FAILED',
        'Failed to fetch organization state',
        requestId,
        corsHeaders,
        {
          hint: 'The database function may be unavailable or the org may not exist. Check org_id is correct.',
          details: {
            rpc_function: 'get_org_sync_payload',
            error_code: error.code,
            error_message: error.message
          }
        }
      );
    }

    // Handle case where RPC returns null (org not found)
    if (!data) {
      log(requestId, 'warn', 'Organization not found', { org_id: orgId });
      return structuredErrorResponse(
        404,
        'ORG_NOT_FOUND',
        'Organization not found or has no sync state',
        requestId,
        corsHeaders,
        {
          hint: 'Verify the organization ID is correct and the org exists in FrostGuard',
          details: { org_id: orgId }
        }
      );
    }

    const payload = data as OrgSyncPayload;
    const durationMs = Date.now() - startTime;
    
    log(requestId, 'info', 'State fetch complete', { 
      org_id: orgId,
      sites_count: payload.sites?.length || 0,
      areas_count: payload.areas?.length || 0,
      units_count: payload.units?.length || 0,
      sensors_count: payload.sensors?.length || 0,
      gateways_count: payload.gateways?.length || 0,
      duration_ms: durationMs
    });

    const response: Record<string, unknown> = {
      success: true,
      request_id: requestId,
      ...payload
    };

    if (isDebugMode) {
      response._debug = {
        request_id: requestId,
        resolved_org_id: orgId,
        sync_version: payload.sync_version,
        counts: {
          sites: payload.sites?.length || 0,
          areas: payload.areas?.length || 0,
          units: payload.units?.length || 0,
          sensors: payload.sensors?.length || 0,
          gateways: payload.gateways?.length || 0
        },
        api_key_last4: authResult.keyLast4,
        duration_ms: durationMs
      };
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log(requestId, 'error', 'Unexpected error', { 
      error_message: errorMessage,
      error_stack: errorStack
    });
    
    return structuredErrorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      requestId,
      corsHeaders,
      {
        hint: 'Export a support snapshot if this error persists',
        details: {
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          error_message: errorMessage
        }
      }
    );
  }
});
