/**
 * Centralized Query Key Factory
 * 
 * Single source of truth for all React Query cache keys.
 * Uses hierarchical structure for efficient prefix-based invalidation.
 * 
 * Pattern: [scope, scopeId, resource, ...params]
 * Examples:
 *   - ['org', 'abc-123', 'sites']
 *   - ['unit', 'xyz-456', 'readings', '24h']
 */

// Type-safe query key builder
export const qk = {
  /**
   * Organization-scoped queries
   * All data that belongs to an organization
   */
  org: (orgId: string | null) => ({
    // Base key for all org data - use for broad invalidation
    all: ['org', orgId] as const,
    
    // Navigation & hierarchy
    sites: () => ['org', orgId, 'sites'] as const,
    navTree: () => ['org', orgId, 'nav-tree'] as const,
    
    // Sensors & devices
    loraSensors: () => ['org', orgId, 'lora-sensors'] as const,
    gateways: () => ['org', orgId, 'gateways'] as const,
    devices: () => ['org', orgId, 'devices'] as const,
    
    // Alert configuration
    alertRules: () => ['org', orgId, 'alert-rules'] as const,
    notificationPolicies: () => ['org', orgId, 'notification-policies'] as const,
    notificationSettings: () => ['org', orgId, 'notification-settings'] as const,
    escalationContacts: () => ['org', orgId, 'escalation-contacts'] as const,
    escalationPolicies: () => ['org', orgId, 'escalation-policies'] as const,
    
    // Dashboard & layouts
    layouts: () => ['org', orgId, 'layouts'] as const,
    dashboardLayouts: () => ['org', orgId, 'dashboard-layouts'] as const,
    
    // Events & audit
    eventLogs: () => ['org', orgId, 'event-logs'] as const,
    alerts: () => ['org', orgId, 'alerts'] as const,
    
    // Reports
    reports: () => ['org', orgId, 'reports'] as const,
    complianceReports: () => ['org', orgId, 'compliance-reports'] as const,
    
    // Organization details
    profile: () => ['org', orgId, 'profile'] as const,
    branding: () => ['org', orgId, 'branding'] as const,
    
    // TTN / provisioning
    ttnSettings: () => ['org', orgId, 'ttn-settings'] as const,
    ttnJobs: () => ['org', orgId, 'ttn-jobs'] as const,
    provisioning: () => ['org', orgId, 'provisioning'] as const,
    
    // Health & status
    healthCheck: () => ['org', orgId, 'health-check'] as const,
    pipelineStatus: () => ['org', orgId, 'pipeline-status'] as const,
  }),

  /**
   * Unit-scoped queries
   * All data specific to a single unit
   */
  unit: (unitId: string | null) => ({
    // Base key for all unit data
    all: ['unit', unitId] as const,
    
    // Core unit data
    header: () => ['unit', unitId, 'header'] as const,
    status: () => ['unit', unitId, 'status'] as const,
    
    // Sensor readings
    readings: (range?: string) => ['unit', unitId, 'readings', range ?? 'default'] as const,
    temperatureReadings: (range?: string) => ['unit', unitId, 'temperature-readings', range ?? 'default'] as const,
    
    // Door events
    doorEvents: () => ['unit', unitId, 'door-events'] as const,
    
    // Sensors linked to unit
    loraSensors: () => ['unit', unitId, 'lora-sensors'] as const,
    
    // Alert rules & overrides
    alertRules: () => ['unit', unitId, 'alert-rules'] as const,
    alertRulesOverride: () => ['unit', unitId, 'alert-rules-override'] as const,
    
    // Notification policies
    notificationPolicies: (alertType?: string) => 
      ['unit', unitId, 'notification-policies', alertType ?? 'all'] as const,
    
    // Manual logs
    manualLogs: () => ['unit', unitId, 'manual-logs'] as const,
    
    // Layouts (for unit dashboard)
    layouts: () => ['unit', unitId, 'layouts'] as const,
  }),

  /**
   * Site-scoped queries
   */
  site: (siteId: string | null) => ({
    all: ['site', siteId] as const,
    details: () => ['site', siteId, 'details'] as const,
    units: () => ['site', siteId, 'units'] as const,
    areas: () => ['site', siteId, 'areas'] as const,
    alertRules: () => ['site', siteId, 'alert-rules'] as const,
    layouts: () => ['site', siteId, 'layouts'] as const,
    weather: (lat?: number, lon?: number) => ['site', siteId, 'weather', lat, lon] as const,
    hubs: () => ['site', siteId, 'hubs'] as const,
  }),

  /**
   * Sensor-specific queries (by sensor ID or dev_eui)
   */
  sensor: (sensorId: string | null) => ({
    all: ['sensor', sensorId] as const,
    details: () => ['sensor', sensorId, 'details'] as const,
  }),
  
  /**
   * Lookup by dev_eui (separate from sensor ID lookups)
   */
  sensorByEui: (devEui: string | null) => 
    ['sensor', 'by-eui', devEui] as const,

  /**
   * Entity layouts (generic for unit/site dashboards)
   */
  entityLayouts: (entityType: 'unit' | 'site', entityId: string | null, orgId?: string | null) =>
    ['entity-layouts', entityType, entityId, orgId] as const,

  /**
   * User-specific queries (not org-scoped)
   */
  user: (userId: string | null) => ({
    all: ['user', userId] as const,
    profile: () => ['user', userId, 'profile'] as const,
    role: () => ['user', userId, 'role'] as const,
    preferences: () => ['user', userId, 'preferences'] as const,
  }),
} as const;

/**
 * Query key type helpers for type-safe usage
 */
export type OrgQueryKey = ReturnType<typeof qk.org>;
export type UnitQueryKey = ReturnType<typeof qk.unit>;
export type SiteQueryKey = ReturnType<typeof qk.site>;
export type SensorQueryKey = ReturnType<typeof qk.sensor>;
