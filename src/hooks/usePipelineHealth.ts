/**
 * usePipelineHealth Hook
 * 
 * React hook for checking the health of the data pipeline
 * from sensor to database.
 */

import { useMemo } from "react";
import {
  checkSensorHealth,
  checkGatewayHealth,
  checkDatabaseHealth,
  buildPipelineReport,
  type PipelineHealthReport,
  type PipelineLayer,
} from "@/lib/pipeline/pipelineHealth";
import type { WidgetProps } from "@/features/dashboard-layout/types";

interface UsePipelineHealthOptions {
  /** Widget props containing entity data */
  props: WidgetProps;
  /** Additional context about last data fetch */
  lastFetchTime?: Date | null;
  /** Error from last data fetch */
  fetchError?: Error | null;
}

interface UsePipelineHealthResult {
  /** Complete pipeline health report */
  report: PipelineHealthReport;
  /** Is the pipeline healthy overall? */
  isHealthy: boolean;
  /** First failing layer (if any) */
  failingLayer: PipelineLayer | undefined;
  /** User-friendly message about pipeline health */
  userMessage: string;
  /** Technical details for debugging */
  technicalDetails: string | undefined;
}

/**
 * Hook to check pipeline health based on widget props.
 */
export function usePipelineHealth(options: UsePipelineHealthOptions): UsePipelineHealthResult {
  const { props, lastFetchTime, fetchError } = options;

  return useMemo(() => {
    const { sensor, device, site, readings, loraSensors } = props;

    // Build list of checks based on available data
    const checks = [];

    // Check sensor health
    const sensorData = sensor ?? loraSensors?.[0];
    if (sensorData) {
      checks.push(checkSensorHealth({
        last_seen_at: sensorData.last_seen_at,
        battery_level: sensorData.battery_level,
        signal_strength: sensorData.signal_strength,
        status: sensorData.status,
      }));
    } else if (device) {
      checks.push(checkSensorHealth({
        last_seen_at: device.last_seen_at,
        battery_level: device.battery_level,
        signal_strength: device.signal_strength,
        status: device.status,
      }));
    } else {
      checks.push(checkSensorHealth(null));
    }

    // Check gateway health (via site gateways if available)
    // Note: This is a simplified check - in production you'd query gateway data
    const gatewayStatus = site && readings && readings.length > 0 
      ? { last_seen_at: readings[0]?.recorded_at, status: 'online' }
      : null;
    checks.push(checkGatewayHealth(gatewayStatus));

    // Check database ingestion health
    const lastReading = readings && readings.length > 0 
      ? { created_at: readings[0]?.recorded_at }
      : null;
    checks.push(checkDatabaseHealth(lastReading));

    // Build the report
    const report = buildPipelineReport(checks, {
      unitId: props.unit?.id,
      sensorId: sensor?.id ?? loraSensors?.[0]?.id,
    });

    // If there was a fetch error, include it
    if (fetchError) {
      report.adminDetails = `Fetch error: ${fetchError.message}\n${report.adminDetails ?? ''}`;
    }

    return {
      report,
      isHealthy: report.overallStatus === 'healthy',
      failingLayer: report.failingLayer,
      userMessage: report.userMessage,
      technicalDetails: report.adminDetails,
    };
  }, [props, lastFetchTime, fetchError]);
}

/**
 * Get a simplified health indicator for use in widget headers.
 */
export function useSimplePipelineStatus(props: WidgetProps): {
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  message: string;
} {
  const { report } = usePipelineHealth({ props });

  return {
    status: report.overallStatus === 'not_applicable' ? 'unknown' : report.overallStatus,
    message: report.userMessage,
  };
}
