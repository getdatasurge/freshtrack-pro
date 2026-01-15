/**
 * update-sensor-assignment: API-key-only endpoint for Project 2 (Emulator) to update sensor assignments
 * 
 * Authentication: Uses PROJECT2_SYNC_API_KEY (no JWT, no service role key)
 * Headers accepted: Authorization: Bearer <key> OR X-Sync-API-Key: <key>
 * 
 * Usage:
 * curl -X POST "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/update-sensor-assignment" \
 *   -H "Content-Type: application/json" \
 *   -H "X-Sync-API-Key: YOUR_API_KEY" \
 *   -d '{"org_id": "...", "sensor_id": "...", "site_id": "...", "unit_id": "..."}'
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  validateProject2SyncApiKey, 
  structuredErrorResponse,
  uuidSchema 
} from "../_shared/validation.ts";

const VERSION = "1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-api-key, x-debug',
};

// Input schema for sensor assignment
const assignmentRequestSchema = z.object({
  org_id: uuidSchema,
  sensor_id: uuidSchema,
  site_id: uuidSchema.nullable().optional(),
  unit_id: uuidSchema.nullable().optional(),
});

type AssignmentRequest = z.infer<typeof assignmentRequestSchema>;

function generateRequestId(): string {
  return crypto.randomUUID();
}

function log(requestId: string, level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const prefix = `[update-sensor-assignment][${requestId}]`;
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

  // Only accept POST
  if (req.method !== 'POST') {
    log(requestId, 'warn', 'Method not allowed', { method: req.method });
    return structuredErrorResponse(
      405,
      'METHOD_NOT_ALLOWED',
      'Only POST method is accepted',
      requestId,
      corsHeaders,
      { hint: 'Use POST method with JSON body' }
    );
  }

  // Authenticate with Project 2 API key
  const authResult = validateProject2SyncApiKey(req);
  
  if (!authResult.valid) {
    log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Authentication failed', { error: authResult.error });
    
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

  // Parse request body
  let body: AssignmentRequest;
  try {
    const rawBody = await req.json();
    const parsed = assignmentRequestSchema.safeParse(rawBody);
    
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      
      log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Invalid request body', { issues });
      
      return structuredErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid request body',
        requestId,
        corsHeaders,
        {
          hint: 'Ensure org_id and sensor_id are valid UUIDs, and site_id/unit_id are valid UUIDs or null',
          details: { validation_errors: issues }
        }
      );
    }
    
    body = parsed.data;
  } catch (error) {
    log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Failed to parse JSON body', { error: String(error) });
    return structuredErrorResponse(
      400,
      'INVALID_JSON',
      'Failed to parse request body as JSON',
      requestId,
      corsHeaders,
      { hint: 'Ensure request body is valid JSON' }
    );
  }

  const { org_id, sensor_id, site_id, unit_id } = body;
  
  log(requestId, 'info', 'ASSIGNMENT_INBOUND_REQUEST', {
    org_id,
    sensor_id,
    requested_site_id: site_id ?? null,
    requested_unit_id: unit_id ?? null,
  });

  // Use service role key for database operations
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Validate organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, deleted_at')
      .eq('id', org_id)
      .single();

    if (orgError || !org) {
      log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Organization not found', { org_id });
      return structuredErrorResponse(
        404,
        'ORG_NOT_FOUND',
        'Organization not found',
        requestId,
        corsHeaders,
        { 
          hint: 'Verify the organization ID is correct',
          details: { org_id }
        }
      );
    }

    if (org.deleted_at) {
      log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Organization is deleted', { org_id });
      return structuredErrorResponse(
        400,
        'ORG_DELETED',
        'Organization has been deleted',
        requestId,
        corsHeaders,
        { 
          hint: 'Cannot assign sensors to deleted organizations',
          details: { org_id }
        }
      );
    }

    // 2. Validate sensor exists and belongs to org
    const { data: sensor, error: sensorError } = await supabase
      .from('lora_sensors')
      .select('id, name, organization_id, site_id, unit_id')
      .eq('id', sensor_id)
      .single();

    if (sensorError || !sensor) {
      log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Sensor not found', { sensor_id });
      return structuredErrorResponse(
        404,
        'SENSOR_NOT_FOUND',
        'Sensor not found',
        requestId,
        corsHeaders,
        { 
          hint: 'Verify the sensor ID is correct',
          details: { sensor_id }
        }
      );
    }

    if (sensor.organization_id !== org_id) {
      log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Sensor does not belong to org', { 
        sensor_id, 
        sensor_org: sensor.organization_id, 
        requested_org: org_id 
      });
      return structuredErrorResponse(
        400,
        'SENSOR_ORG_MISMATCH',
        'Sensor does not belong to the specified organization',
        requestId,
        corsHeaders,
        { 
          hint: 'Ensure the sensor and organization IDs match',
          details: { sensor_id, org_id }
        }
      );
    }

    // Resolve final site_id and unit_id
    let resolvedSiteId: string | null = site_id ?? null;
    let resolvedUnitId: string | null = unit_id ?? null;
    let siteAutoResolved = false;
    let unitCleared = false;

    // 3. If site_id provided, validate it belongs to org
    if (resolvedSiteId) {
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('id, name, organization_id, deleted_at')
        .eq('id', resolvedSiteId)
        .single();

      if (siteError || !site) {
        log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Site not found', { site_id: resolvedSiteId });
        return structuredErrorResponse(
          404,
          'SITE_NOT_FOUND',
          'Site not found',
          requestId,
          corsHeaders,
          { 
            hint: 'Verify the site ID is correct',
            details: { site_id: resolvedSiteId }
          }
        );
      }

      if (site.organization_id !== org_id) {
        log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Site does not belong to org', { 
          site_id: resolvedSiteId, 
          site_org: site.organization_id, 
          org_id 
        });
        return structuredErrorResponse(
          400,
          'SITE_ORG_MISMATCH',
          'Site does not belong to the specified organization',
          requestId,
          corsHeaders,
          { 
            hint: 'Ensure the site belongs to the same organization as the sensor',
            details: { site_id: resolvedSiteId, org_id }
          }
        );
      }

      if (site.deleted_at) {
        log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Site is deleted', { site_id: resolvedSiteId });
        return structuredErrorResponse(
          400,
          'SITE_DELETED',
          'Cannot assign sensor to a deleted site',
          requestId,
          corsHeaders,
          { 
            hint: 'Select an active site',
            details: { site_id: resolvedSiteId }
          }
        );
      }
    }

    // 4. If unit_id provided, validate and derive/verify site
    if (resolvedUnitId) {
      const { data: unit, error: unitError } = await supabase
        .from('units')
        .select(`
          id, name, area_id, deleted_at,
          areas!inner (
            id, site_id, deleted_at,
            sites!inner (
              id, organization_id, deleted_at
            )
          )
        `)
        .eq('id', resolvedUnitId)
        .single();

      if (unitError || !unit) {
        log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Unit not found', { unit_id: resolvedUnitId });
        return structuredErrorResponse(
          404,
          'UNIT_NOT_FOUND',
          'Unit not found',
          requestId,
          corsHeaders,
          { 
            hint: 'Verify the unit ID is correct',
            details: { unit_id: resolvedUnitId }
          }
        );
      }

      // Type assertion for nested data
      const areas = unit.areas as unknown as { 
        id: string; 
        site_id: string; 
        deleted_at: string | null;
        sites: { id: string; organization_id: string; deleted_at: string | null };
      };
      const unitSiteId = areas.site_id;
      const unitOrgId = areas.sites.organization_id;

      if (unitOrgId !== org_id) {
        log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Unit does not belong to org', { 
          unit_id: resolvedUnitId, 
          unit_org: unitOrgId, 
          org_id 
        });
        return structuredErrorResponse(
          400,
          'UNIT_ORG_MISMATCH',
          'Unit does not belong to the specified organization',
          requestId,
          corsHeaders,
          { 
            hint: 'Ensure the unit belongs to the same organization',
            details: { unit_id: resolvedUnitId, org_id }
          }
        );
      }

      if (unit.deleted_at || areas.deleted_at || areas.sites.deleted_at) {
        log(requestId, 'warn', 'ASSIGNMENT_VALIDATION_FAIL: Unit or parent is deleted', { unit_id: resolvedUnitId });
        return structuredErrorResponse(
          400,
          'UNIT_DELETED',
          'Cannot assign sensor to a deleted unit or unit with deleted parent',
          requestId,
          corsHeaders,
          { 
            hint: 'Select an active unit with active parent area and site',
            details: { unit_id: resolvedUnitId }
          }
        );
      }

      // If site_id was also provided, verify it matches unit's actual site
      if (resolvedSiteId && resolvedSiteId !== unitSiteId) {
        log(requestId, 'info', 'Site/unit mismatch - using unit\'s actual site', {
          provided_site_id: resolvedSiteId,
          unit_site_id: unitSiteId
        });
        // Auto-correct to unit's actual site
        resolvedSiteId = unitSiteId;
        siteAutoResolved = true;
      } else if (!resolvedSiteId) {
        // Derive site from unit
        resolvedSiteId = unitSiteId;
        siteAutoResolved = true;
      }
    } else if (resolvedSiteId && sensor.unit_id) {
      // Site is changing and unit_id was not provided but sensor currently has a unit
      // Check if the current unit belongs to the new site
      const { data: currentUnit } = await supabase
        .from('units')
        .select(`
          id, 
          areas!inner (site_id)
        `)
        .eq('id', sensor.unit_id)
        .single();

      if (currentUnit) {
        const currentUnitSiteId = (currentUnit.areas as unknown as { site_id: string }).site_id;
        if (currentUnitSiteId !== resolvedSiteId) {
          // Current unit is on a different site than the new site, clear unit_id
          resolvedUnitId = null;
          unitCleared = true;
          log(requestId, 'info', 'Clearing unit_id due to site change', {
            previous_unit_id: sensor.unit_id,
            previous_site_id: currentUnitSiteId,
            new_site_id: resolvedSiteId
          });
        }
      }
    }

    log(requestId, 'info', 'ASSIGNMENT_VALIDATION_OK', {
      sensor_id,
      resolved_site_id: resolvedSiteId,
      resolved_unit_id: resolvedUnitId,
      site_auto_resolved: siteAutoResolved,
      unit_cleared: unitCleared
    });

    // 5. Update the sensor record
    const { data: updatedSensor, error: updateError } = await supabase
      .from('lora_sensors')
      .update({
        site_id: resolvedSiteId,
        unit_id: resolvedUnitId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sensor_id)
      .select('id, name, site_id, unit_id, updated_at')
      .single();

    if (updateError) {
      log(requestId, 'error', 'ASSIGNMENT_DB_UPDATE_FAIL', {
        error_message: updateError.message,
        error_code: updateError.code,
      });
      return structuredErrorResponse(
        500,
        'DB_UPDATE_FAILED',
        'Failed to update sensor assignment',
        requestId,
        corsHeaders,
        {
          hint: 'An internal error occurred while updating the database',
          details: {
            error_code: updateError.code,
            error_message: updateError.message
          }
        }
      );
    }

    const durationMs = Date.now() - startTime;
    log(requestId, 'info', 'ASSIGNMENT_DB_UPDATE_OK', {
      sensor_id,
      site_id: updatedSensor?.site_id,
      unit_id: updatedSensor?.unit_id,
      duration_ms: durationMs,
    });

    // Return success response
    return new Response(
      JSON.stringify({
        ok: true,
        sensor_id: updatedSensor?.id,
        sensor_name: updatedSensor?.name,
        site_id: updatedSensor?.site_id,
        unit_id: updatedSensor?.unit_id,
        updated_at: updatedSensor?.updated_at,
        request_id: requestId,
        _meta: {
          site_auto_resolved: siteAutoResolved,
          unit_cleared: unitCleared,
          duration_ms: durationMs,
          version: VERSION,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    log(requestId, 'error', 'ASSIGNMENT_DB_UPDATE_FAIL: Unexpected error', { 
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
