/**
 * Pipeline Health Service
 * 
 * Provides health checking for the data pipeline from sensor to database.
 * Each layer (sensor, gateway, TTN, decoder, webhook, database) can be checked
 * independently or as a complete pipeline.
 */

import { differenceInMinutes, differenceInHours } from "date-fns";

/**
 * Layers in the data pipeline.
 */
export type PipelineLayer = 
  | 'sensor' 
  | 'gateway' 
  | 'ttn' 
  | 'decoder' 
  | 'webhook' 
  | 'database'
  | 'external_api';

/**
 * Status of a single layer check.
 */
export type LayerStatus = 'healthy' | 'degraded' | 'failed' | 'unknown' | 'not_applicable';

/**
 * Result of checking a single pipeline layer.
 */
export interface PipelineCheckResult {
  /** Which layer was checked */
  layer: PipelineLayer;
  /** Current status */
  status: LayerStatus;
  /** Latency of the check in ms (if applicable) */
  latencyMs?: number;
  /** Last successful operation timestamp */
  lastSuccess?: Date;
  /** Error message (if failed or degraded) */
  error?: string;
  /** Technical details for admin/debug view */
  technicalDetails?: string;
  /** Human-readable message */
  message: string;
}

/**
 * Complete pipeline health report.
 */
export interface PipelineHealthReport {
  /** Entity context */
  unitId?: string;
  sensorId?: string;
  gatewayId?: string;
  /** Overall pipeline status */
  overallStatus: LayerStatus;
  /** First failing layer (if any) */
  failingLayer?: PipelineLayer;
  /** Individual layer checks */
  checks: PipelineCheckResult[];
  /** User-friendly summary message */
  userMessage: string;
  /** Technical summary for admins */
  adminDetails?: string;
  /** Timestamp of this report */
  checkedAt: Date;
}

/**
 * Thresholds for layer health (in minutes).
 */
const LAYER_THRESHOLDS = {
  sensor: {
    stale: 60,    // 1 hour
    failed: 1440, // 24 hours
  },
  gateway: {
    stale: 30,    // 30 minutes
    failed: 240,  // 4 hours
  },
  ttn: {
    stale: 15,    // 15 minutes
    failed: 60,   // 1 hour
  },
  decoder: {
    stale: 30,
    failed: 60,
  },
  webhook: {
    stale: 10,    // 10 minutes
    failed: 30,   // 30 minutes
  },
  database: {
    stale: 5,     // 5 minutes
    failed: 15,   // 15 minutes
  },
  external_api: {
    stale: 120,   // 2 hours
    failed: 360,  // 6 hours
  },
};

/**
 * Check sensor layer health.
 */
export function checkSensorHealth(sensor: {
  last_seen_at?: string | null;
  battery_level?: number | null;
  signal_strength?: number | null;
  status?: string;
} | null): PipelineCheckResult {
  if (!sensor) {
    return {
      layer: 'sensor',
      status: 'not_applicable',
      message: 'No sensor assigned',
    };
  }

  const lastSeen = sensor.last_seen_at ? new Date(sensor.last_seen_at) : null;
  
  if (!lastSeen) {
    return {
      layer: 'sensor',
      status: 'unknown',
      message: 'Sensor has never reported',
      technicalDetails: 'last_seen_at is null',
    };
  }

  const minutesAgo = differenceInMinutes(new Date(), lastSeen);
  const thresholds = LAYER_THRESHOLDS.sensor;

  if (minutesAgo >= thresholds.failed) {
    const hoursAgo = differenceInHours(new Date(), lastSeen);
    return {
      layer: 'sensor',
      status: 'failed',
      lastSuccess: lastSeen,
      message: `Sensor offline for ${hoursAgo} hours`,
      error: 'No uplinks received',
      technicalDetails: `last_seen_at: ${lastSeen.toISOString()}, status: ${sensor.status}`,
    };
  }

  if (minutesAgo >= thresholds.stale) {
    return {
      layer: 'sensor',
      status: 'degraded',
      lastSuccess: lastSeen,
      message: `No readings for ${minutesAgo} minutes`,
      technicalDetails: `last_seen_at: ${lastSeen.toISOString()}`,
    };
  }

  // Check battery
  const batteryWarning = sensor.battery_level !== null && sensor.battery_level < 20;
  const signalWarning = sensor.signal_strength !== null && sensor.signal_strength < -110;

  if (batteryWarning || signalWarning) {
    return {
      layer: 'sensor',
      status: 'degraded',
      lastSuccess: lastSeen,
      message: batteryWarning ? 'Low battery' : 'Weak signal',
      technicalDetails: `battery: ${sensor.battery_level}%, signal: ${sensor.signal_strength}dBm`,
    };
  }

  return {
    layer: 'sensor',
    status: 'healthy',
    lastSuccess: lastSeen,
    message: 'Sensor online',
    technicalDetails: `Last seen ${minutesAgo}m ago, battery: ${sensor.battery_level}%`,
  };
}

/**
 * Check gateway layer health.
 */
export function checkGatewayHealth(gateway: {
  last_seen_at?: string | null;
  status?: string;
} | null): PipelineCheckResult {
  if (!gateway) {
    return {
      layer: 'gateway',
      status: 'not_applicable',
      message: 'No gateway assigned to site',
    };
  }

  const lastSeen = gateway.last_seen_at ? new Date(gateway.last_seen_at) : null;

  if (!lastSeen) {
    return {
      layer: 'gateway',
      status: 'unknown',
      message: 'Gateway has never connected',
      technicalDetails: 'last_seen_at is null',
    };
  }

  const minutesAgo = differenceInMinutes(new Date(), lastSeen);
  const thresholds = LAYER_THRESHOLDS.gateway;

  if (minutesAgo >= thresholds.failed) {
    return {
      layer: 'gateway',
      status: 'failed',
      lastSuccess: lastSeen,
      message: 'Gateway offline',
      error: 'No heartbeat received',
      technicalDetails: `last_seen_at: ${lastSeen.toISOString()}, status: ${gateway.status}`,
    };
  }

  if (minutesAgo >= thresholds.stale) {
    return {
      layer: 'gateway',
      status: 'degraded',
      lastSuccess: lastSeen,
      message: 'Gateway connection delayed',
      technicalDetails: `Last heartbeat ${minutesAgo}m ago`,
    };
  }

  return {
    layer: 'gateway',
    status: 'healthy',
    lastSuccess: lastSeen,
    message: 'Gateway connected',
    technicalDetails: `Last seen ${minutesAgo}m ago`,
  };
}

/**
 * Check database ingestion health based on recent readings.
 */
export function checkDatabaseHealth(lastReading: {
  created_at?: string;
  recorded_at?: string;
} | null): PipelineCheckResult {
  if (!lastReading) {
    return {
      layer: 'database',
      status: 'unknown',
      message: 'No readings stored',
    };
  }

  const storedAt = lastReading.created_at ? new Date(lastReading.created_at) : null;

  if (!storedAt) {
    return {
      layer: 'database',
      status: 'unknown',
      message: 'No timestamp on readings',
    };
  }

  const minutesAgo = differenceInMinutes(new Date(), storedAt);
  const thresholds = LAYER_THRESHOLDS.database;

  if (minutesAgo >= thresholds.failed) {
    return {
      layer: 'database',
      status: 'failed',
      lastSuccess: storedAt,
      message: 'Database ingestion stopped',
      error: 'No new readings in database',
      technicalDetails: `Last insert: ${storedAt.toISOString()}`,
    };
  }

  if (minutesAgo >= thresholds.stale) {
    return {
      layer: 'database',
      status: 'degraded',
      lastSuccess: storedAt,
      message: 'Database ingestion delayed',
      technicalDetails: `Last insert ${minutesAgo}m ago`,
    };
  }

  return {
    layer: 'database',
    status: 'healthy',
    lastSuccess: storedAt,
    message: 'Database receiving data',
  };
}

/**
 * Check external API health (e.g., weather API).
 */
export function checkExternalApiHealth(lastFetch: Date | null, error?: string): PipelineCheckResult {
  if (!lastFetch) {
    return {
      layer: 'external_api',
      status: 'unknown',
      message: 'External data never fetched',
    };
  }

  if (error) {
    return {
      layer: 'external_api',
      status: 'failed',
      lastSuccess: lastFetch,
      message: 'External API error',
      error,
      technicalDetails: `Error: ${error}`,
    };
  }

  const minutesAgo = differenceInMinutes(new Date(), lastFetch);
  const thresholds = LAYER_THRESHOLDS.external_api;

  if (minutesAgo >= thresholds.failed) {
    return {
      layer: 'external_api',
      status: 'failed',
      lastSuccess: lastFetch,
      message: 'External data outdated',
    };
  }

  if (minutesAgo >= thresholds.stale) {
    return {
      layer: 'external_api',
      status: 'degraded',
      lastSuccess: lastFetch,
      message: 'External data may be stale',
    };
  }

  return {
    layer: 'external_api',
    status: 'healthy',
    lastSuccess: lastFetch,
    message: 'External API connected',
  };
}

/**
 * Compute overall status from individual checks.
 */
export function computeOverallStatus(checks: PipelineCheckResult[]): LayerStatus {
  const activeChecks = checks.filter(c => c.status !== 'not_applicable');
  
  if (activeChecks.length === 0) return 'unknown';
  
  const hasFailed = activeChecks.some(c => c.status === 'failed');
  const hasDegraded = activeChecks.some(c => c.status === 'degraded');
  const hasUnknown = activeChecks.some(c => c.status === 'unknown');
  const allHealthy = activeChecks.every(c => c.status === 'healthy');
  
  if (hasFailed) return 'failed';
  if (hasDegraded) return 'degraded';
  if (allHealthy) return 'healthy';
  if (hasUnknown) return 'unknown';
  
  return 'unknown';
}

/**
 * Find the first failing layer in the pipeline.
 */
export function findFailingLayer(checks: PipelineCheckResult[]): PipelineLayer | undefined {
  // Order of layers in the pipeline
  const layerOrder: PipelineLayer[] = ['sensor', 'gateway', 'ttn', 'decoder', 'webhook', 'database'];
  
  for (const layer of layerOrder) {
    const check = checks.find(c => c.layer === layer);
    if (check && (check.status === 'failed' || check.status === 'degraded')) {
      return layer;
    }
  }
  
  // Check external API separately
  const externalCheck = checks.find(c => c.layer === 'external_api');
  if (externalCheck && (externalCheck.status === 'failed' || externalCheck.status === 'degraded')) {
    return 'external_api';
  }
  
  return undefined;
}

/**
 * Generate a user-friendly message from pipeline health.
 */
export function generateUserMessage(report: { overallStatus: LayerStatus; failingLayer?: PipelineLayer }): string {
  if (report.overallStatus === 'healthy') {
    return 'All systems operational';
  }
  
  if (!report.failingLayer) {
    return report.overallStatus === 'unknown' ? 'Unable to determine system status' : 'System experiencing issues';
  }
  
  const layerMessages: Record<PipelineLayer, string> = {
    sensor: 'Sensor may be offline or out of range',
    gateway: 'Network gateway may be offline',
    ttn: 'LoRaWAN network may be experiencing issues',
    decoder: 'Data processing issue detected',
    webhook: 'Data delivery may be delayed',
    database: 'Data storage issue detected',
    external_api: 'External service unavailable',
  };
  
  return layerMessages[report.failingLayer] || 'System experiencing issues';
}

/**
 * Build a complete pipeline health report.
 */
export function buildPipelineReport(checks: PipelineCheckResult[], context?: {
  unitId?: string;
  sensorId?: string;
  gatewayId?: string;
}): PipelineHealthReport {
  const overallStatus = computeOverallStatus(checks);
  const failingLayer = findFailingLayer(checks);
  
  return {
    unitId: context?.unitId,
    sensorId: context?.sensorId,
    gatewayId: context?.gatewayId,
    overallStatus,
    failingLayer,
    checks,
    userMessage: generateUserMessage({ overallStatus, failingLayer }),
    adminDetails: checks
      .filter(c => c.technicalDetails)
      .map(c => `[${c.layer}] ${c.technicalDetails}`)
      .join('\n'),
    checkedAt: new Date(),
  };
}
