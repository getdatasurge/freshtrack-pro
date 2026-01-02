import { supabase } from '@/integrations/supabase/client';
import { 
  HealthCheckResult, 
  SystemHealth, 
  EdgeFunctionInfo,
  computeOverallStatus, 
  computeSummary 
} from './types';
import { EDGE_FUNCTIONS } from './edgeFunctionList';

/**
 * Check a single edge function's health
 */
export async function checkEdgeFunctionHealth(
  fn: EdgeFunctionInfo
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const id = `edge_${fn.name}`;

  // Handle skipped functions
  if (fn.checkMethod === 'skip') {
    return {
      id,
      name: fn.name,
      category: 'edge_function',
      status: 'healthy',
      checkedAt: new Date(),
      skipped: true,
      skipReason: fn.skipReason || 'Cannot be tested directly',
      details: { description: fn.description },
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(fn.name, {
      method: 'GET',
    });

    const latencyMs = Date.now() - startTime;

    if (error) {
      // Extract error details
      let errorMessage = error.message || 'Unknown error';
      const errorContext = (error as unknown as { context?: { status?: number } })?.context;
      if (errorContext?.status) {
        errorMessage = `HTTP ${errorContext.status}: ${errorMessage}`;
      }

      return {
        id,
        name: fn.name,
        category: 'edge_function',
        status: 'unhealthy',
        latencyMs,
        checkedAt: new Date(),
        error: errorMessage,
        details: { description: fn.description, critical: fn.critical },
      };
    }

    // Check for warning hints in response
    const responseData = data as Record<string, unknown>;
    if (responseData?.hint || responseData?.warning) {
      return {
        id,
        name: fn.name,
        category: 'edge_function',
        status: 'degraded',
        latencyMs,
        checkedAt: new Date(),
        error: (responseData.hint || responseData.warning) as string,
        details: { ...responseData, description: fn.description },
      };
    }

    return {
      id,
      name: fn.name,
      category: 'edge_function',
      status: 'healthy',
      latencyMs,
      checkedAt: new Date(),
      details: { ...responseData, description: fn.description },
    };
  } catch (err) {
    return {
      id,
      name: fn.name,
      category: 'edge_function',
      status: 'unhealthy',
      latencyMs: Date.now() - startTime,
      checkedAt: new Date(),
      error: err instanceof Error ? err.message : 'Unknown error',
      details: { description: fn.description, critical: fn.critical },
    };
  }
}

/**
 * Check database connectivity and latency
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // Test 1: Basic connectivity with SELECT 1
  const connectivityStart = Date.now();
  try {
    const { error } = await supabase.rpc('check_slug_available', { p_slug: '__health_check__' });
    const latencyMs = Date.now() - connectivityStart;

    if (error) {
      results.push({
        id: 'db_connectivity',
        name: 'Database Connectivity',
        category: 'database',
        status: 'unhealthy',
        latencyMs,
        checkedAt: new Date(),
        error: error.message,
      });
    } else {
      results.push({
        id: 'db_connectivity',
        name: 'Database Connectivity',
        category: 'database',
        status: latencyMs > 500 ? 'degraded' : 'healthy',
        latencyMs,
        checkedAt: new Date(),
        details: latencyMs > 500 ? { warning: 'High latency detected' } : undefined,
      });
    }
  } catch (err) {
    results.push({
      id: 'db_connectivity',
      name: 'Database Connectivity',
      category: 'database',
      status: 'unhealthy',
      latencyMs: Date.now() - connectivityStart,
      checkedAt: new Date(),
      error: err instanceof Error ? err.message : 'Connection failed',
    });
  }

  // Test 2: Query organizations table (tests RLS and table access)
  const queryStart = Date.now();
  try {
    const { error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    const latencyMs = Date.now() - queryStart;

    if (error) {
      results.push({
        id: 'db_query',
        name: 'Database Query',
        category: 'database',
        status: 'unhealthy',
        latencyMs,
        checkedAt: new Date(),
        error: error.message,
      });
    } else {
      results.push({
        id: 'db_query',
        name: 'Database Query',
        category: 'database',
        status: latencyMs > 300 ? 'degraded' : 'healthy',
        latencyMs,
        checkedAt: new Date(),
      });
    }
  } catch (err) {
    results.push({
      id: 'db_query',
      name: 'Database Query',
      category: 'database',
      status: 'unhealthy',
      latencyMs: Date.now() - queryStart,
      checkedAt: new Date(),
      error: err instanceof Error ? err.message : 'Query failed',
    });
  }

  return results;
}

/**
 * Check TTN connection status (requires orgId)
 */
export async function checkTTNHealth(orgId: string | null): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  if (!orgId) {
    results.push({
      id: 'ttn_config',
      name: 'TTN Configuration',
      category: 'ttn',
      status: 'unknown',
      checkedAt: new Date(),
      skipped: true,
      skipReason: 'No organization context',
    });
    return results;
  }

  // Check TTN connection settings
  const configStart = Date.now();
  try {
    const { data: ttnConnection, error } = await supabase
      .from('ttn_connections')
      .select('is_enabled, provisioning_status, ttn_region, ttn_application_id, updated_at')
      .eq('organization_id', orgId)
      .maybeSingle();

    const latencyMs = Date.now() - configStart;

    if (error) {
      results.push({
        id: 'ttn_config',
        name: 'TTN Configuration',
        category: 'ttn',
        status: 'unhealthy',
        latencyMs,
        checkedAt: new Date(),
        error: error.message,
      });
    } else if (!ttnConnection) {
      results.push({
        id: 'ttn_config',
        name: 'TTN Configuration',
        category: 'ttn',
        status: 'unknown',
        latencyMs,
        checkedAt: new Date(),
        details: { message: 'TTN not configured for this organization' },
      });
    } else {
      const isConfigured = ttnConnection.is_enabled && 
        ttnConnection.provisioning_status === 'complete' &&
        ttnConnection.ttn_application_id;

      results.push({
        id: 'ttn_config',
        name: 'TTN Configuration',
        category: 'ttn',
        status: isConfigured ? 'healthy' : 'degraded',
        latencyMs,
        checkedAt: new Date(),
        details: {
          enabled: ttnConnection.is_enabled,
          status: ttnConnection.provisioning_status,
          region: ttnConnection.ttn_region,
          applicationId: ttnConnection.ttn_application_id,
        },
        error: !isConfigured ? 'TTN not fully configured' : undefined,
      });
    }
  } catch (err) {
    results.push({
      id: 'ttn_config',
      name: 'TTN Configuration',
      category: 'ttn',
      status: 'unhealthy',
      latencyMs: Date.now() - configStart,
      checkedAt: new Date(),
      error: err instanceof Error ? err.message : 'Failed to check TTN config',
    });
  }

  return results;
}

/**
 * Run all health checks in parallel
 */
export async function runAllHealthChecks(orgId: string | null): Promise<SystemHealth> {
  const startTime = new Date();

  // Run all checks in parallel
  const [edgeFunctionResults, databaseResults, ttnResults] = await Promise.all([
    Promise.all(EDGE_FUNCTIONS.map(fn => checkEdgeFunctionHealth(fn))),
    checkDatabaseHealth(),
    checkTTNHealth(orgId),
  ]);

  const allChecks = [...edgeFunctionResults, ...databaseResults, ...ttnResults];

  return {
    overall: computeOverallStatus(allChecks),
    lastCheckedAt: startTime,
    checks: allChecks,
    summary: computeSummary(allChecks),
  };
}

/**
 * Run quick health check (critical functions only)
 */
export async function runQuickHealthCheck(orgId: string | null): Promise<SystemHealth> {
  const startTime = new Date();

  const criticalFunctions = EDGE_FUNCTIONS.filter(f => f.critical);

  const [edgeFunctionResults, databaseResults] = await Promise.all([
    Promise.all(criticalFunctions.map(fn => checkEdgeFunctionHealth(fn))),
    checkDatabaseHealth(),
  ]);

  const allChecks = [...edgeFunctionResults, ...databaseResults];

  return {
    overall: computeOverallStatus(allChecks),
    lastCheckedAt: startTime,
    checks: allChecks,
    summary: computeSummary(allChecks),
  };
}
