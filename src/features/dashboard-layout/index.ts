/**
 * Dashboard Layout Feature Module
 *
 * Provides customizable drag-and-drop layouts for unit/site dashboards.
 */

// Types
export * from "./types";

// Constants (consumed by useQuickCreateEntityLayout)
export {
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_TIMELINE_STATE,
} from "./constants/defaultLayout";

// Components (consumed by UnitDetail, SiteDetail)
export { EntityDashboard } from "./components/EntityDashboard";
