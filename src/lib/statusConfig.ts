/**
 * Unified unit status configuration - SINGLE SOURCE OF TRUTH
 * 
 * All unit status display configuration should import from here.
 * Do NOT create local copies of this config in pages/components.
 */

/**
 * Unit status display configuration
 * Maps unit status enum values to display properties
 */
export const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string; priority: number }> = {
  ok: { color: "text-safe", bgColor: "bg-safe/10", label: "OK", priority: 7 },
  excursion: { color: "text-excursion", bgColor: "bg-excursion/10", label: "Excursion", priority: 2 },
  alarm_active: { color: "text-alarm", bgColor: "bg-alarm/10", label: "ALARM", priority: 1 },
  monitoring_interrupted: { color: "text-warning", bgColor: "bg-warning/10", label: "Interrupted", priority: 3 },
  manual_required: { color: "text-warning", bgColor: "bg-warning/10", label: "Manual Required", priority: 4 },
  restoring: { color: "text-accent", bgColor: "bg-accent/10", label: "Restoring", priority: 6 },
  offline: { color: "text-muted-foreground", bgColor: "bg-muted", label: "Offline", priority: 5 },
};

/**
 * Get status config with fallback
 */
export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.offline;
}

/**
 * Compare two statuses by priority (lower = more severe)
 */
export function compareStatusPriority(a: string, b: string): number {
  const aPriority = STATUS_CONFIG[a]?.priority ?? 99;
  const bPriority = STATUS_CONFIG[b]?.priority ?? 99;
  return aPriority - bPriority;
}
