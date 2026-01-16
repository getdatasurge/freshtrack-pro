/**
 * Widget Health Metrics
 * 
 * Observability counters and event tracking for widget health states.
 * Tracks failures per org for diagnostics and alerting.
 */

import type { WidgetHealthStatus, FailingLayer } from "@/features/dashboard-layout/types/widgetState";
import { supabase } from "@/integrations/supabase/client";

/**
 * Widget health change event
 */
export interface WidgetHealthEvent {
  eventType: "widget_health_change";
  widgetId: string;
  entityId: string;
  entityType: "unit" | "site";
  orgId: string;
  previousStatus: WidgetHealthStatus | null;
  currentStatus: WidgetHealthStatus;
  failingLayer: FailingLayer | null;
  payloadType: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Health counter state per org
 */
interface OrgHealthCounters {
  counters: Record<WidgetHealthStatus, number>;
  lastFlush: Date;
  events: WidgetHealthEvent[];
}

// In-memory counters - periodically flushed to database
const healthCountersMap = new Map<string, OrgHealthCounters>();

// Flush interval (5 minutes)
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

// Max events to buffer before flush
const MAX_BUFFERED_EVENTS = 50;

/**
 * Initialize counters for an org
 */
function initOrgCounters(orgId: string): OrgHealthCounters {
  const counters: Record<WidgetHealthStatus, number> = {
    healthy: 0,
    degraded: 0,
    stale: 0,
    error: 0,
    no_data: 0,
    misconfigured: 0,
    permission_denied: 0,
    not_configured: 0,
    loading: 0,
    empty: 0,
    offline: 0,
    mismatch: 0,
    decoder_error: 0,
    schema_failed: 0,
    partial_payload: 0,
    out_of_order: 0,
  };
  
  return {
    counters,
    lastFlush: new Date(),
    events: [],
  };
}

/**
 * Get or create counters for an org
 */
function getOrgCounters(orgId: string): OrgHealthCounters {
  if (!healthCountersMap.has(orgId)) {
    healthCountersMap.set(orgId, initOrgCounters(orgId));
  }
  return healthCountersMap.get(orgId)!;
}

/**
 * Track a widget health status change
 */
export function trackHealthChange(event: Omit<WidgetHealthEvent, "eventType" | "timestamp">): void {
  const fullEvent: WidgetHealthEvent = {
    ...event,
    eventType: "widget_health_change",
    timestamp: new Date().toISOString(),
  };
  
  const orgCounters = getOrgCounters(event.orgId);
  
  // Update counters
  if (event.previousStatus) {
    orgCounters.counters[event.previousStatus] = Math.max(0, orgCounters.counters[event.previousStatus] - 1);
  }
  orgCounters.counters[event.currentStatus]++;
  
  // Buffer event
  orgCounters.events.push(fullEvent);
  
  // Auto-flush if buffer is full or interval elapsed
  const shouldFlush = 
    orgCounters.events.length >= MAX_BUFFERED_EVENTS ||
    Date.now() - orgCounters.lastFlush.getTime() >= FLUSH_INTERVAL_MS;
    
  if (shouldFlush) {
    void flushHealthMetrics(event.orgId);
  }
}

/**
 * Get current health status distribution for an org
 */
export function getHealthDistribution(orgId: string): Record<WidgetHealthStatus, number> {
  return { ...getOrgCounters(orgId).counters };
}

/**
 * Get buffered events for an org (useful for debugging)
 */
export function getBufferedEvents(orgId: string): WidgetHealthEvent[] {
  return [...getOrgCounters(orgId).events];
}

/**
 * Flush health metrics to database
 */
export async function flushHealthMetrics(orgId: string): Promise<void> {
  const orgCounters = getOrgCounters(orgId);
  const events = [...orgCounters.events];
  
  if (events.length === 0) {
    return;
  }
  
  // Clear buffer
  orgCounters.events = [];
  orgCounters.lastFlush = new Date();
  
  try {
    // Log aggregated status changes to event_logs
    const eventLogs = events.map(event => ({
      organization_id: event.orgId,
      event_type: "widget_health_status_change",
      category: "widget_health",
      severity: getSeverityForStatus(event.currentStatus),
      title: `Widget ${event.widgetId} status: ${event.currentStatus}`,
      unit_id: event.entityType === "unit" ? event.entityId : null,
      site_id: event.entityType === "site" ? event.entityId : null,
      event_data: {
        widgetId: event.widgetId,
        fromStatus: event.previousStatus,
        toStatus: event.currentStatus,
        failingLayer: event.failingLayer,
        payloadType: event.payloadType,
        ...event.metadata,
      },
    }));
    
    // Batch insert
    const { error } = await supabase
      .from("event_logs")
      .insert(eventLogs);
    
    if (error) {
      console.error("[widgetHealthMetrics] Failed to flush events:", error);
      // Re-add events to buffer on failure
      orgCounters.events.unshift(...events);
    }
  } catch (err) {
    console.error("[widgetHealthMetrics] Error flushing metrics:", err);
    // Re-add events to buffer on failure
    orgCounters.events.unshift(...events);
  }
}

/**
 * Map health status to severity level
 */
function getSeverityForStatus(status: WidgetHealthStatus): string {
  switch (status) {
    case "error":
    case "offline":
    case "decoder_error":
    case "schema_failed":
    case "permission_denied":
      return "error";
    case "degraded":
    case "stale":
    case "mismatch":
    case "partial_payload":
    case "misconfigured":
      return "warning";
    case "healthy":
      return "info";
    default:
      return "info";
  }
}

/**
 * Get failure counts by layer
 */
export function getFailuresByLayer(orgId: string): Record<FailingLayer, number> {
  const events = getOrgCounters(orgId).events;
  const layerCounts: Record<FailingLayer, number> = {
    sensor: 0,
    gateway: 0,
    ttn: 0,
    decoder: 0,
    webhook: 0,
    database: 0,
    external_api: 0,
  };
  
  for (const event of events) {
    if (event.failingLayer && event.currentStatus !== "healthy") {
      layerCounts[event.failingLayer]++;
    }
  }
  
  return layerCounts;
}

/**
 * Check if an org has critical issues
 */
export function hasCriticalIssues(orgId: string): boolean {
  const counters = getOrgCounters(orgId).counters;
  return (
    counters.error > 0 ||
    counters.offline > 0 ||
    counters.decoder_error > 0 ||
    counters.schema_failed > 0
  );
}

/**
 * Reset counters for an org (mainly for testing)
 */
export function resetOrgCounters(orgId: string): void {
  healthCountersMap.set(orgId, initOrgCounters(orgId));
}

/**
 * Clear all counters (mainly for testing)
 */
export function clearAllCounters(): void {
  healthCountersMap.clear();
}
