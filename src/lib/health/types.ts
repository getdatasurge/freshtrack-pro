/**
 * Health Check Types
 * 
 * Defines the structure for system health monitoring across
 * edge functions, database, and external services.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'checking';

export type HealthCategory = 'edge_function' | 'database' | 'ttn' | 'external';

export interface HealthCheckResult {
  id: string;
  name: string;
  category: HealthCategory;
  status: HealthStatus;
  latencyMs?: number;
  checkedAt: Date;
  error?: string;
  details?: Record<string, unknown>;
  skipped?: boolean;
  skipReason?: string;
}

export interface SystemHealth {
  overall: HealthStatus;
  lastCheckedAt: Date;
  checks: HealthCheckResult[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    skipped: number;
  };
}

export interface EdgeFunctionInfo {
  name: string;
  description: string;
  checkMethod: 'GET' | 'POST' | 'skip';
  critical: boolean;
  skipReason?: string;
}

/**
 * Computes overall health status from individual check results
 */
export function computeOverallStatus(checks: HealthCheckResult[]): HealthStatus {
  const activeChecks = checks.filter(c => !c.skipped);
  
  if (activeChecks.length === 0) return 'unknown';
  
  const hasUnhealthy = activeChecks.some(c => c.status === 'unhealthy');
  const hasDegraded = activeChecks.some(c => c.status === 'degraded');
  const allHealthy = activeChecks.every(c => c.status === 'healthy');
  const allChecking = activeChecks.every(c => c.status === 'checking');
  
  if (allChecking) return 'checking';
  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  if (allHealthy) return 'healthy';
  
  return 'unknown';
}

/**
 * Computes summary counts from check results
 */
export function computeSummary(checks: HealthCheckResult[]): SystemHealth['summary'] {
  return {
    healthy: checks.filter(c => c.status === 'healthy').length,
    degraded: checks.filter(c => c.status === 'degraded').length,
    unhealthy: checks.filter(c => c.status === 'unhealthy').length,
    unknown: checks.filter(c => c.status === 'unknown').length,
    skipped: checks.filter(c => c.skipped).length,
  };
}
