/**
 * Widget Empty State
 * 
 * Standardized empty/error state component for widgets.
 * Displays status-colored icon, message, root cause, and action button.
 * 
 * No widget may render as a blank container - this ensures every state is communicated.
 */

import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CircleOff,
  HelpCircle,
  Info,
  Loader2,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WidgetStateInfo, WidgetHealthStatus } from "../types/widgetState";
import { cn } from "@/lib/utils";

interface WidgetEmptyStateProps {
  state: WidgetStateInfo;
  /** Override the default icon for this status */
  icon?: LucideIcon;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for smaller widgets */
  compact?: boolean;
}

/**
 * Get the default icon for a health status.
 */
function getStatusIcon(status: WidgetHealthStatus): LucideIcon {
  switch (status) {
    case "healthy":
      return Info;
    case "stale":
    case "partial_payload":
    case "out_of_order":
      return AlertTriangle;
    case "error":
    case "offline":
    case "decoder_error":
    case "schema_failed":
      return AlertCircle;
    case "mismatch":
      return AlertTriangle;
    case "not_configured":
    case "misconfigured":
      return Settings;
    case "loading":
      return Loader2;
    case "empty":
    case "no_data":
      return CircleOff;
    default:
      return HelpCircle;
  }
}

/**
 * Get styling classes for a health status.
 */
function getStatusStyles(status: WidgetHealthStatus): {
  iconBg: string;
  iconColor: string;
  textColor: string;
} {
  switch (status) {
    case "healthy":
      return {
        iconBg: "bg-safe/10",
        iconColor: "text-safe",
        textColor: "text-foreground",
      };
    case "stale":
    case "partial_payload":
    case "mismatch":
    case "out_of_order":
      return {
        iconBg: "bg-warning/10",
        iconColor: "text-warning",
        textColor: "text-warning",
      };
    case "error":
    case "decoder_error":
    case "schema_failed":
      return {
        iconBg: "bg-alarm/10",
        iconColor: "text-alarm",
        textColor: "text-alarm",
      };
    case "offline":
      return {
        iconBg: "bg-offline/10",
        iconColor: "text-offline",
        textColor: "text-offline",
      };
    case "not_configured":
    case "misconfigured":
      return {
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        textColor: "text-muted-foreground",
      };
    case "loading":
      return {
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        textColor: "text-muted-foreground",
      };
    case "empty":
    case "no_data":
      return {
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        textColor: "text-muted-foreground",
      };
    default:
      return {
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        textColor: "text-muted-foreground",
      };
  }
}

export function WidgetEmptyState({
  state,
  icon,
  className,
  compact = false,
}: WidgetEmptyStateProps) {
  const Icon = icon ?? getStatusIcon(state.status);
  const styles = getStatusStyles(state.status);
  const ActionIcon = state.action?.icon;

  if (state.status === "loading") {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center h-full py-4",
        className
      )}>
        <div className={cn("rounded-full p-2", styles.iconBg)}>
          <Loader2 className={cn("w-5 h-5 animate-spin", styles.iconColor)} />
        </div>
        <p className={cn("text-xs mt-2", styles.textColor)}>
          {state.message || "Loading..."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full text-center",
        compact ? "py-3 px-2 gap-1.5" : "py-6 px-4 gap-2",
        className
      )}
    >
      {/* Status Icon */}
      <div className={cn(
        "rounded-full flex items-center justify-center",
        styles.iconBg,
        compact ? "p-1.5" : "p-2.5"
      )}>
        <Icon className={cn(
          styles.iconColor,
          compact ? "w-4 h-4" : "w-5 h-5"
        )} />
      </div>

      {/* State Message */}
      <p className={cn(
        "font-medium",
        styles.textColor,
        compact ? "text-xs" : "text-sm"
      )}>
        {state.message}
      </p>

      {/* Root Cause */}
      {state.rootCause && !compact && (
        <p className="text-xs text-muted-foreground max-w-[200px]">
          {state.rootCause}
        </p>
      )}

      {/* Action Button */}
      {state.action && (
        state.action.href ? (
          <Button
            asChild
            variant="outline"
            size={compact ? "sm" : "default"}
            className={cn("mt-1", compact && "h-7 text-xs px-2")}
          >
            <Link to={state.action.href}>
              {ActionIcon && <ActionIcon className="w-3.5 h-3.5 mr-1.5" />}
              {state.action.label}
            </Link>
          </Button>
        ) : state.action.onClick ? (
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={state.action.onClick}
            className={cn("mt-1", compact && "h-7 text-xs px-2")}
          >
            {ActionIcon && <ActionIcon className="w-3.5 h-3.5 mr-1.5" />}
            {state.action.label}
          </Button>
        ) : null
      )}
    </div>
  );
}
