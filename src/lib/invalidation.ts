/**
 * Centralized Cache Invalidation
 * 
 * Context-aware invalidation functions that use the query key factory.
 * Call these from mutations instead of manually constructing query keys.
 */

import { QueryClient } from "@tanstack/react-query";
import { qk } from "./queryKeys";

/**
 * Invalidate ALL caches for an organization.
 * Use when switching impersonation or after major org changes.
 */
export async function invalidateOrg(
  queryClient: QueryClient,
  orgId: string | null,
  reason?: string
): Promise<void> {
  if (!orgId) return;

  // Invalidate all queries starting with ['org', orgId]
  await queryClient.invalidateQueries({
    queryKey: ['org', orgId],
    exact: false,
  });
}

/**
 * Invalidate ALL org-scoped caches (for impersonation switch).
 * More aggressive: clears by prefix pattern regardless of orgId.
 */
export async function invalidateAllOrgData(
  queryClient: QueryClient,
  reason?: string
): Promise<void> {
  // Use predicate to match all org/unit/site scoped queries
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return key === 'org' || key === 'unit' || key === 'site' || key === 'sensor';
    },
  });
}

/**
 * Invalidate all caches for a specific unit.
 * Use after sensor assignment, alert rule changes, or readings updates.
 */
export async function invalidateUnit(
  queryClient: QueryClient,
  unitId: string,
  options?: {
    includeNavTree?: boolean;
    includeOrgSensors?: boolean;
    orgId?: string | null;
  }
): Promise<void> {
  if (!unitId) return;
  
  const promises: Promise<void>[] = [
    // All unit-specific queries
    queryClient.invalidateQueries({ queryKey: qk.unit(unitId).all }),
  ];
  
  // Also invalidate legacy query keys during migration
  promises.push(
    queryClient.invalidateQueries({ queryKey: ['lora-sensors-by-unit', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['door-events', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['alert-rules', 'unit', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['alert-rules', 'unit-override', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['unit-alert-rules', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['unit-alert-rules-override', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['notification-policies', 'unit', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['notification-policies', 'effective', unitId] }),
  );
  
  // Optionally refresh nav tree (for sensor count changes)
  if (options?.includeNavTree && options?.orgId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.org(options.orgId).navTree() }),
      // Legacy nav tree keys
      queryClient.invalidateQueries({ queryKey: ['nav-tree'] }),
      queryClient.invalidateQueries({ queryKey: ['navTree'] }),
    );
  }
  
  // Optionally refresh org sensor list
  if (options?.includeOrgSensors && options?.orgId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.org(options.orgId).loraSensors() }),
      // Legacy key
      queryClient.invalidateQueries({ queryKey: ['lora-sensors'] }),
    );
  }
  
  await Promise.all(promises);
}

/**
 * Invalidate layout-related caches for an entity.
 */
export async function invalidateLayouts(
  queryClient: QueryClient,
  entityType: 'unit' | 'site',
  entityId: string,
  orgId?: string | null
): Promise<void> {
  const promises: Promise<void>[] = [
    // New key pattern
    queryClient.invalidateQueries({ 
      queryKey: qk.entityLayouts(entityType, entityId, orgId) 
    }),
    // Legacy key pattern (used by useEntityLayoutStorage)
    queryClient.invalidateQueries({ 
      queryKey: ['entity-layouts', entityType, entityId] 
    }),
  ];
  
  // Also invalidate nav tree to update layout dropdown
  if (orgId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.org(orgId).navTree() }),
      queryClient.invalidateQueries({ queryKey: ['nav-tree'] }),
    );
  }
  
  await Promise.all(promises);
}

/**
 * Invalidate sensor-related caches after assignment or provisioning changes.
 */
export async function invalidateSensorAssignment(
  queryClient: QueryClient,
  sensorId: string,
  orgId: string,
  unitId?: string | null,
  previousUnitId?: string | null
): Promise<void> {
  const promises: Promise<void>[] = [
    // Org-level sensor list
    queryClient.invalidateQueries({ queryKey: qk.org(orgId).loraSensors() }),
    // Legacy key
    queryClient.invalidateQueries({ queryKey: ['lora-sensors'] }),
    
    // Sensor-specific
    queryClient.invalidateQueries({ queryKey: qk.sensor(sensorId).all }),
  ];
  
  // Invalidate new unit's sensor list
  if (unitId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.unit(unitId).loraSensors() }),
      queryClient.invalidateQueries({ queryKey: ['lora-sensors-by-unit', unitId] }),
    );
  }
  
  // Invalidate previous unit's sensor list (if reassigning)
  if (previousUnitId && previousUnitId !== unitId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.unit(previousUnitId).loraSensors() }),
      queryClient.invalidateQueries({ queryKey: ['lora-sensors-by-unit', previousUnitId] }),
    );
  }
  
  // Nav tree for sensor counts
  promises.push(
    queryClient.invalidateQueries({ queryKey: qk.org(orgId).navTree() }),
    queryClient.invalidateQueries({ queryKey: ['nav-tree'] }),
  );
  
  await Promise.all(promises);
}

/**
 * Invalidate alert rule caches (org, site, or unit level).
 */
export async function invalidateAlertRules(
  queryClient: QueryClient,
  scope: { orgId?: string; siteId?: string; unitId?: string }
): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (scope.orgId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.org(scope.orgId).alertRules() }),
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
    );
  }
  
  if (scope.siteId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.site(scope.siteId).alertRules() }),
    );
  }
  
  if (scope.unitId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.unit(scope.unitId).alertRules() }),
      queryClient.invalidateQueries({ queryKey: qk.unit(scope.unitId).alertRulesOverride() }),
    );
  }
  
  await Promise.all(promises);
}

/**
 * Invalidate escalation contacts cache.
 */
export async function invalidateEscalationContacts(
  queryClient: QueryClient,
  orgId: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.org(orgId).escalationContacts() }),
    // Legacy key (no org scoping)
    queryClient.invalidateQueries({ queryKey: ['escalation-contacts'] }),
  ]);
}

/**
 * Invalidate notification policies cache.
 */
export async function invalidateNotificationPolicies(
  queryClient: QueryClient,
  scope: { orgId?: string; siteId?: string; unitId?: string }
): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (scope.orgId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.org(scope.orgId).notificationPolicies() }),
    );
  }
  
  if (scope.unitId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.unit(scope.unitId).notificationPolicies() }),
      // Legacy keys
      queryClient.invalidateQueries({ queryKey: ['notification-policies', 'unit', scope.unitId] }),
      queryClient.invalidateQueries({ queryKey: ['notification-policies', 'effective', scope.unitId] }),
    );
  }
  
  // Always invalidate legacy catch-all
  promises.push(
    queryClient.invalidateQueries({ queryKey: ['notification-policies'] }),
  );
  
  await Promise.all(promises);
}

/**
 * Invalidate gateway caches.
 */
export async function invalidateGateways(
  queryClient: QueryClient,
  orgId: string,
  siteId?: string
): Promise<void> {
  const promises: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: qk.org(orgId).gateways() }),
    queryClient.invalidateQueries({ queryKey: ['gateways'] }),
    // Invalidate all site-scoped gateway queries so the widget refreshes
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return key[0] === 'site' && key[2] === 'gateways';
      },
    }),
  ];

  if (siteId) {
    promises.push(
      queryClient.invalidateQueries({ queryKey: qk.site(siteId).hubs() }),
      queryClient.invalidateQueries({ queryKey: qk.site(siteId).gateways() }),
    );
  }

  await Promise.all(promises);
}
