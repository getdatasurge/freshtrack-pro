/**
 * Widget State Types
 * 
 * Defines the state, health, and metadata types for dashboard widgets.
 * Used to ensure every widget communicates its data source, status, and any issues.
 */

import type { LucideIcon } from "lucide-react";
import type { WidgetDataCategory } from "../types";

// Re-export for convenience
export type { WidgetDataCategory } from "../types";

/**
 * Health status of a widget's data.
 * Determines the color coding and messaging shown to users.
 */
export type WidgetHealthStatus =
  | "healthy"           // Green - data flowing normally
  | "degraded"          // Yellow-Orange - partial data, some issues
  | "stale"             // Yellow - no recent data but not an error
  | "error"             // Red - expected data missing or failed to load
  | "no_data"           // Grey - zero data points available
  | "misconfigured"     // Orange - widget config is invalid
  | "permission_denied" // Red - user lacks access
  | "not_configured"    // Grey - feature not set up (no sensor, not enabled)
  | "loading"           // Loading state
  | "empty";            // No data in selected range (not an error condition)

/**
 * Pipeline layer where an issue was detected.
 */
export type FailingLayer = 
  | 'sensor' 
  | 'gateway' 
  | 'ttn' 
  | 'decoder' 
  | 'webhook' 
  | 'database'
  | 'external_api';

/**
 * Complete state information for a widget.
 * Used by StandardWidgetHeader and WidgetEmptyState to render consistent UI.
 */
export interface WidgetStateInfo {
  /** Current health status */
  status: WidgetHealthStatus;
  
  /** User-friendly message describing the current state */
  message: string;
  
  /** Explanation of why this state occurred (shown in empty/error states) */
  rootCause?: string;
  
  /** Suggested action for the user to resolve the issue */
  action?: WidgetStateAction;
  
  /** When the widget data was last updated */
  lastUpdated?: Date | null;
  
  /** Which pipeline layer is causing the issue (for diagnostics) */
  failingLayer?: FailingLayer;
  
  /** Technical details (only shown to admins in debug mode) */
  technicalDetails?: string;
}

/**
 * Action that can be taken to resolve a widget issue.
 */
export interface WidgetStateAction {
  /** Button/link text */
  label: string;
  
  /** Navigation destination (if link) */
  href?: string;
  
  /** Click handler (if button) */
  onClick?: () => void;
  
  /** Optional icon for the action button */
  icon?: LucideIcon;
}

/**
 * Configuration for status badge styling.
 */
export interface StatusBadgeConfig {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon?: LucideIcon;
}

/**
 * Configuration for category badge styling.
 */
export interface CategoryBadgeConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

/**
 * Status badge configurations mapped by health status.
 */
export const STATUS_BADGE_CONFIG: Record<WidgetHealthStatus, Omit<StatusBadgeConfig, "icon">> = {
  healthy: {
    label: "Healthy",
    bgColor: "bg-safe/20",
    textColor: "text-safe",
    borderColor: "border-safe/30",
  },
  degraded: {
    label: "Degraded",
    bgColor: "bg-warning/20",
    textColor: "text-warning",
    borderColor: "border-warning/30",
  },
  stale: {
    label: "Stale",
    bgColor: "bg-warning/20",
    textColor: "text-warning",
    borderColor: "border-warning/30",
  },
  error: {
    label: "Error",
    bgColor: "bg-alarm/20",
    textColor: "text-alarm",
    borderColor: "border-alarm/30",
  },
  no_data: {
    label: "No Data",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-muted",
  },
  misconfigured: {
    label: "Misconfigured",
    bgColor: "bg-warning/20",
    textColor: "text-warning",
    borderColor: "border-warning/30",
  },
  permission_denied: {
    label: "Access Denied",
    bgColor: "bg-alarm/20",
    textColor: "text-alarm",
    borderColor: "border-alarm/30",
  },
  not_configured: {
    label: "Not Configured",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-muted",
  },
  loading: {
    label: "Loading",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-transparent",
  },
  empty: {
    label: "No Data",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-muted",
  },
};

/**
 * Category badge configurations mapped by data category.
 */
export const CATEGORY_BADGE_CONFIG: Record<WidgetDataCategory, CategoryBadgeConfig> = {
  sensor: {
    label: "Sensor",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  gateway: {
    label: "Gateway",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  system: {
    label: "System",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-600 dark:text-slate-400",
  },
  calculated: {
    label: "Calculated",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  manual: {
    label: "Manual",
    bgColor: "bg-green-500/10",
    textColor: "text-green-600 dark:text-green-400",
  },
  external: {
    label: "External",
    bgColor: "bg-sky-500/10",
    textColor: "text-sky-600 dark:text-sky-400",
  },
};
