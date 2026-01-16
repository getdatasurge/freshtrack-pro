/**
 * Widget Registry
 * 
 * Defines all available widgets for unit and site dashboards with their
 * size constraints, categories, and capabilities.
 */

import {
  LineChart,
  Thermometer,
  Activity,
  AlertTriangle,
  Gauge,
  Hash,
  CheckCircle2,
  ShieldCheck,
  Radio,
  Battery,
  Building2,
  Grid,
  ClipboardCheck,
  // New icons for additional widgets
  TrendingUp,
  TrendingDown,
  DoorOpen,
  Droplets,
  ClipboardList,
  History,
  Signal,
  Zap,
  Clock,
  Target,
  Wrench,
  CloudSun,
  BarChart3,
  Users,
  ListChecks,
  Calendar,
  Timer,
  LayoutGrid,
  PieChart,
  Server,
  MessageSquare,
} from "lucide-react";
import type { WidgetDefinition, EntityType } from "../types";

/**
 * Complete registry of all dashboard widgets.
 * 
 * Widget Categories:
 * - monitoring: Real-time data display (chart, current temp)
 * - alerts: Alert-related widgets (banner, thresholds)
 * - device: Device/sensor status widgets
 * - compliance: Compliance and logging widgets
 * - utility: Quick actions and tools
 */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  // =========================================================================
  // UNIT WIDGETS - MANDATORY (cannot be hidden)
  // =========================================================================
  
  temperature_chart: {
    id: "temperature_chart",
    name: "Temperature History",
    description: "Interactive chart showing temperature readings over time with zoom and comparison features.",
    mandatory: true,
    minW: 4,
    minH: 4,
    maxW: 12,
    maxH: 12,
    defaultW: 8,
    defaultH: 6,
    category: "monitoring",
    icon: LineChart,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: ["temperature"],
    optionalCapabilities: ["humidity"],
  },
  
  current_temp: {
    id: "current_temp",
    name: "Current Temperature",
    description: "Displays the current temperature reading with status indicator.",
    mandatory: true,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "monitoring",
    icon: Thermometer,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: ["temperature"],
  },
  
  device_status: {
    id: "device_status",
    name: "Device Status",
    description: "Shows the current device connection status and health.",
    mandatory: true,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "device",
    icon: Activity,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: [],
  },
  
  // =========================================================================
  // UNIT WIDGETS - OPTIONAL (can be hidden in custom layouts)
  // =========================================================================
  
  alerts_banner: {
    id: "alerts_banner",
    name: "Active Alerts",
    description: "Banner showing any active alerts for this unit.",
    mandatory: false,
    minW: 6,
    minH: 1,
    maxW: 12,
    maxH: 3,
    defaultW: 12,
    defaultH: 2,
    category: "alerts",
    icon: AlertTriangle,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  temp_limits: {
    id: "temp_limits",
    name: "Temperature Limits",
    description: "Displays configured temperature thresholds (high/low alarm and warning limits).",
    mandatory: false,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "alerts",
    icon: Gauge,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  readings_count: {
    id: "readings_count",
    name: "Readings Count",
    description: "Shows the number of readings received in the selected time period.",
    mandatory: false,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "monitoring",
    icon: Hash,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  device_readiness: {
    id: "device_readiness",
    name: "Device Readiness",
    description: "Checklist showing device configuration and connectivity status.",
    mandatory: false,
    minW: 3,
    minH: 3,
    maxW: 8,
    maxH: 6,
    defaultW: 4,
    defaultH: 4,
    category: "device",
    icon: CheckCircle2,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  last_known_good: {
    id: "last_known_good",
    name: "Last Known Good",
    description: "Shows the last time temperature was within safe limits.",
    mandatory: false,
    minW: 3,
    minH: 3,
    maxW: 8,
    maxH: 6,
    defaultW: 4,
    defaultH: 4,
    category: "compliance",
    icon: ShieldCheck,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  connected_sensors: {
    id: "connected_sensors",
    name: "Connected Sensors",
    description: "List of sensors assigned to this unit with their status.",
    mandatory: false,
    minW: 4,
    minH: 2,
    maxW: 12,
    maxH: 6,
    defaultW: 6,
    defaultH: 3,
    category: "device",
    icon: Radio,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: [],
  },
  
  battery_health: {
    id: "battery_health",
    name: "Battery Health",
    description: "Battery level and health forecast for connected sensors.",
    mandatory: false,
    minW: 4,
    minH: 2,
    maxW: 12,
    maxH: 6,
    defaultW: 6,
    defaultH: 3,
    category: "device",
    icon: Battery,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: ["battery"],
  },

  // =========================================================================
  // NEW UNIT WIDGETS - OPTIONAL (added via Add Widget)
  // =========================================================================
  
  temperature_statistics: {
    id: "temperature_statistics",
    name: "Temperature Statistics",
    description: "Min, max, and average temperature for the selected period with visual indicators.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "monitoring",
    icon: BarChart3,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "calculated",
    requiredCapabilities: ["temperature"],
  },
  
  temperature_trend: {
    id: "temperature_trend",
    name: "Temperature Trend",
    description: "Rising, falling, or stable trend with rate of change indicator.",
    mandatory: false,
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "monitoring",
    icon: TrendingUp,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "calculated",
    requiredCapabilities: ["temperature"],
  },
  
  temperature_excursion: {
    id: "temperature_excursion",
    name: "Temperature Excursions",
    description: "Count and duration of out-of-range events with high/low breakdown.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 5,
    defaultW: 4,
    defaultH: 3,
    category: "compliance",
    icon: TrendingDown,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "calculated",
    requiredCapabilities: ["temperature"],
  },
  
  door_activity: {
    id: "door_activity",
    name: "Door Activity",
    description: "Timeline of door open/close events with duration statistics.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 6,
    defaultW: 6,
    defaultH: 4,
    category: "monitoring",
    icon: DoorOpen,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: ["door"],
    optionalCapabilities: ["battery"],
    requiredDataSource: {
      type: "sensor",
      sensorTypes: ["door"],
      message: "Requires a door/contact sensor to display activity",
    },
  },
  
  humidity_chart: {
    id: "humidity_chart",
    name: "Humidity Chart",
    description: "Humidity readings over time (requires humidity sensor).",
    mandatory: false,
    minW: 4,
    minH: 4,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "monitoring",
    icon: Droplets,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: ["humidity"],
    optionalCapabilities: ["temperature"],
    requiredDataSource: {
      type: "sensor",
      sensorTypes: ["humidity"],
      message: "Requires a sensor that reports humidity",
    },
  },
  
  manual_log_status: {
    id: "manual_log_status",
    name: "Manual Log Status",
    description: "Next log due, overdue indicator, streak counter, and compliance percentage.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 5,
    defaultW: 4,
    defaultH: 3,
    category: "compliance",
    icon: ClipboardList,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "manual",
    requiredCapabilities: [],
    requiredDataSource: {
      type: "manual_log",
      message: "Works best with manual temperature logging enabled",
    },
  },
  
  alert_history: {
    id: "alert_history",
    name: "Alert History",
    description: "Past alerts with resolution times, MTTR, and pattern analysis.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "alerts",
    icon: History,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  sensor_signal_trend: {
    id: "sensor_signal_trend",
    name: "Sensor Signal Trend",
    description: "Signal strength history chart showing connectivity patterns.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 6,
    defaultW: 6,
    defaultH: 4,
    category: "device",
    icon: Signal,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "sensor",
    requiredCapabilities: [],
    optionalCapabilities: ["battery"],
  },
  
  quick_actions: {
    id: "quick_actions",
    name: "Quick Actions",
    description: "Buttons for logging temp, acknowledging alerts, snoozing, and adding notes.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 4,
    defaultW: 4,
    defaultH: 2,
    category: "utility",
    icon: Zap,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  event_timeline: {
    id: "event_timeline",
    name: "Event Timeline",
    description: "Unified timeline of alerts, readings, manual logs, and door events.",
    mandatory: false,
    minW: 4,
    minH: 4,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 5,
    category: "monitoring",
    icon: Clock,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  unit_compliance_score: {
    id: "unit_compliance_score",
    name: "Compliance Score",
    description: "Overall compliance percentage with breakdown by readings, logs, and alert response.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 5,
    defaultW: 4,
    defaultH: 3,
    category: "compliance",
    icon: Target,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  maintenance_forecast: {
    id: "maintenance_forecast",
    name: "Maintenance Forecast",
    description: "Estimated battery replacement date, health score, and preventive alerts.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 5,
    defaultW: 4,
    defaultH: 3,
    category: "device",
    icon: Wrench,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "calculated",
    requiredCapabilities: ["battery"],
  },
  
  temperature_vs_external: {
    id: "temperature_vs_external",
    name: "Temp vs External",
    description: "Compare internal temperature with ambient/external conditions.",
    mandatory: false,
    minW: 4,
    minH: 4,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "monitoring",
    icon: CloudSun,
    supportsTimeline: true,
    entityTypes: ["unit"],
    dataCategory: "external",
    requiredCapabilities: ["temperature"],
    requiredDataSource: {
      type: "weather",
      message: "Requires site location to fetch external weather data",
    },
  },
  
  annotations: {
    id: "annotations",
    name: "Annotations",
    description: "View and add notes, comments, and shift handoff information.",
    mandatory: false,
    minW: 3,
    minH: 3,
    maxW: 8,
    maxH: 6,
    defaultW: 4,
    defaultH: 4,
    category: "utility",
    icon: MessageSquare,
    supportsTimeline: false,
    entityTypes: ["unit"],
    dataCategory: "manual",
    requiredCapabilities: [],
  },
  
  // =========================================================================
  // SITE WIDGETS - MANDATORY
  // =========================================================================
  
  site_overview: {
    id: "site_overview",
    name: "Site Overview",
    description: "Summary stats for the entire site - areas, units, and sensors.",
    mandatory: true,
    minW: 6,
    minH: 2,
    maxW: 12,
    maxH: 4,
    defaultW: 12,
    defaultH: 3,
    category: "monitoring",
    icon: Building2,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  units_status_grid: {
    id: "units_status_grid",
    name: "Units Status Grid",
    description: "Grid showing all units and their current status.",
    mandatory: true,
    minW: 4,
    minH: 4,
    maxW: 12,
    maxH: 12,
    defaultW: 8,
    defaultH: 6,
    category: "monitoring",
    icon: Grid,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "sensor",
    requiredCapabilities: [],
  },
  
  // =========================================================================
  // SITE WIDGETS - OPTIONAL (existing)
  // =========================================================================
  
  site_alerts_summary: {
    id: "site_alerts_summary",
    name: "Site Alerts Summary",
    description: "Aggregated alerts across all units in this site.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 6,
    defaultW: 4,
    defaultH: 3,
    category: "alerts",
    icon: AlertTriangle,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  compliance_summary: {
    id: "compliance_summary",
    name: "Compliance Summary",
    description: "HACCP compliance status for the site.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 8,
    maxH: 6,
    defaultW: 4,
    defaultH: 3,
    category: "compliance",
    icon: ClipboardCheck,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },

  // =========================================================================
  // NEW SITE WIDGETS - OPTIONAL (added via Add Widget)
  // =========================================================================
  
  temperature_heatmap: {
    id: "temperature_heatmap",
    name: "Temperature Heatmap",
    description: "Heatmap grid showing all units' temperature status at a glance.",
    mandatory: false,
    minW: 6,
    minH: 4,
    maxW: 12,
    maxH: 10,
    defaultW: 8,
    defaultH: 6,
    category: "monitoring",
    icon: LayoutGrid,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "sensor",
    requiredCapabilities: [],
  },
  
  alerts_trend: {
    id: "alerts_trend",
    name: "Alerts Trend",
    description: "Alert count trends over time by severity (critical, warning, info).",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "alerts",
    icon: BarChart3,
    supportsTimeline: true,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  compliance_scoreboard: {
    id: "compliance_scoreboard",
    name: "Compliance Scoreboard",
    description: "Units ranked by compliance score with progress indicators.",
    mandatory: false,
    minW: 4,
    minH: 4,
    maxW: 12,
    maxH: 10,
    defaultW: 6,
    defaultH: 5,
    category: "compliance",
    icon: Target,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  area_breakdown: {
    id: "area_breakdown",
    name: "Area Breakdown",
    description: "Stats grouped by area: unit count, alerts, and average temperatures.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "monitoring",
    icon: Users,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  recent_events_feed: {
    id: "recent_events_feed",
    name: "Recent Events Feed",
    description: "Real-time stream of latest events across all units.",
    mandatory: false,
    minW: 3,
    minH: 4,
    maxW: 8,
    maxH: 10,
    defaultW: 4,
    defaultH: 5,
    category: "monitoring",
    icon: ListChecks,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  unit_comparison: {
    id: "unit_comparison",
    name: "Unit Comparison",
    description: "Compare key metrics for 2-4 selected units side by side.",
    mandatory: false,
    minW: 6,
    minH: 4,
    maxW: 12,
    maxH: 8,
    defaultW: 8,
    defaultH: 5,
    category: "monitoring",
    icon: BarChart3,
    supportsTimeline: true,
    entityTypes: ["site"],
    dataCategory: "sensor",
    requiredCapabilities: [],
  },
  
  problem_units: {
    id: "problem_units",
    name: "Problem Units",
    description: "List of units that are offline, alerting, or non-compliant.",
    mandatory: false,
    minW: 3,
    minH: 3,
    maxW: 8,
    maxH: 8,
    defaultW: 4,
    defaultH: 4,
    category: "alerts",
    icon: AlertTriangle,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "system",
    requiredCapabilities: [],
  },
  
  manual_log_overview: {
    id: "manual_log_overview",
    name: "Manual Log Overview",
    description: "Manual log compliance status across all units.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "compliance",
    icon: ClipboardList,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "manual",
    requiredCapabilities: [],
  },
  
  site_activity_graph: {
    id: "site_activity_graph",
    name: "Site Activity Graph",
    description: "Sparklines per unit showing reading frequency and activity.",
    mandatory: false,
    minW: 6,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 8,
    defaultH: 4,
    category: "monitoring",
    icon: Activity,
    supportsTimeline: true,
    entityTypes: ["site"],
    dataCategory: "sensor",
    requiredCapabilities: [],
  },
  
  external_weather: {
    id: "external_weather",
    name: "External Weather",
    description: "Current external temperature and humidity for the site location.",
    mandatory: false,
    minW: 3,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 4,
    defaultH: 3,
    category: "utility",
    icon: CloudSun,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "external",
    requiredCapabilities: [],
    requiredDataSource: {
      type: "weather",
      message: "Requires site location to be configured for weather data",
    },
  },
  
  maintenance_calendar: {
    id: "maintenance_calendar",
    name: "Maintenance Calendar",
    description: "Upcoming battery replacements, calibrations, and scheduled maintenance.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "device",
    icon: Calendar,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  downtime_tracker: {
    id: "downtime_tracker",
    name: "Downtime Tracker",
    description: "Visualize offline periods with totals and patterns.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 6,
    defaultH: 4,
    category: "device",
    icon: Timer,
    supportsTimeline: true,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  quick_stats_cards: {
    id: "quick_stats_cards",
    name: "Quick Stats Cards",
    description: "Customizable KPI cards: avg temp, readings today, alerts resolved, etc.",
    mandatory: false,
    minW: 6,
    minH: 2,
    maxW: 12,
    maxH: 4,
    defaultW: 8,
    defaultH: 2,
    category: "monitoring",
    icon: LayoutGrid,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  unit_type_distribution: {
    id: "unit_type_distribution",
    name: "Unit Type Distribution",
    description: "Pie chart breakdown of unit types (refrigerator, freezer, etc.).",
    mandatory: false,
    minW: 3,
    minH: 3,
    maxW: 6,
    maxH: 6,
    defaultW: 4,
    defaultH: 3,
    category: "monitoring",
    icon: PieChart,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "calculated",
    requiredCapabilities: [],
  },
  
  gateway_health: {
    id: "gateway_health",
    name: "Gateway Health",
    description: "Status of all gateways with connected device counts.",
    mandatory: false,
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 6,
    defaultW: 6,
    defaultH: 4,
    category: "device",
    icon: Server,
    supportsTimeline: false,
    entityTypes: ["site"],
    dataCategory: "gateway",
    requiredCapabilities: [],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all widget definitions as an array.
 */
export function getAllWidgets(): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY);
}

/**
 * Get widgets available for a specific entity type.
 */
export function getWidgetsForEntity(entityType: EntityType): WidgetDefinition[] {
  return getAllWidgets().filter(w => 
    !w.entityTypes || w.entityTypes.includes(entityType)
  );
}

/**
 * Get only mandatory widgets.
 */
export function getMandatoryWidgets(entityType?: EntityType): WidgetDefinition[] {
  const widgets = entityType ? getWidgetsForEntity(entityType) : getAllWidgets();
  return widgets.filter(w => w.mandatory);
}

/**
 * Get only optional widgets.
 */
export function getOptionalWidgets(entityType?: EntityType): WidgetDefinition[] {
  const widgets = entityType ? getWidgetsForEntity(entityType) : getAllWidgets();
  return widgets.filter(w => !w.mandatory);
}

/**
 * Get widgets by category.
 */
export function getWidgetsByCategory(
  category: WidgetDefinition["category"],
  entityType?: EntityType
): WidgetDefinition[] {
  const widgets = entityType ? getWidgetsForEntity(entityType) : getAllWidgets();
  return widgets.filter(w => w.category === category);
}

/**
 * Get widgets that support timeline controls.
 */
export function getTimelineWidgets(entityType?: EntityType): WidgetDefinition[] {
  const widgets = entityType ? getWidgetsForEntity(entityType) : getAllWidgets();
  return widgets.filter(w => w.supportsTimeline);
}

/**
 * Check if a widget can be hidden (only non-mandatory widgets).
 */
export function canHideWidget(widgetId: string): boolean {
  const widget = WIDGET_REGISTRY[widgetId];
  return widget ? !widget.mandatory : false;
}

/**
 * Validate that all mandatory widgets are present in a layout.
 */
export function validateMandatoryWidgets(
  visibleWidgetIds: string[],
  entityType?: EntityType
): {
  valid: boolean;
  missingWidgets: string[];
} {
  const mandatory = getMandatoryWidgets(entityType);
  const missingWidgets = mandatory
    .filter(w => !visibleWidgetIds.includes(w.id))
    .map(w => w.id);
  
  return {
    valid: missingWidgets.length === 0,
    missingWidgets,
  };
}

/**
 * Get widget IDs in display order (mandatory first, then by category).
 */
export function getWidgetIdsInOrder(entityType?: EntityType): string[] {
  const mandatory = getMandatoryWidgets(entityType).map(w => w.id);
  const optional = getOptionalWidgets(entityType).map(w => w.id);
  return [...mandatory, ...optional];
}
