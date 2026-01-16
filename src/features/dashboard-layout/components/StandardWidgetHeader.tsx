/**
 * Standard Widget Header
 * 
 * Renders a consistent header for all dashboard widgets with:
 * - Icon and title
 * - Category badge (Sensor, Gateway, System, Calculated, Manual, External)
 * - Status badge (Healthy, Stale, Error, Not Configured, Loading, No Data)
 * - Last updated timestamp
 */

import { formatDistanceToNow } from "date-fns";
import { Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";
import type { WidgetStateInfo, WidgetDataCategory } from "../types/widgetState";
import { STATUS_BADGE_CONFIG, CATEGORY_BADGE_CONFIG } from "../types/widgetState";
import { cn } from "@/lib/utils";

interface StandardWidgetHeaderProps {
  widgetId: string;
  state: WidgetStateInfo;
  className?: string;
  /** Override the default category from registry */
  categoryOverride?: WidgetDataCategory;
  /** Hide the category badge */
  hideCategory?: boolean;
  /** Hide the status badge */
  hideStatus?: boolean;
  /** Hide the last updated timestamp */
  hideTimestamp?: boolean;
}

export function StandardWidgetHeader({
  widgetId,
  state,
  className,
  categoryOverride,
  hideCategory = false,
  hideStatus = false,
  hideTimestamp = false,
}: StandardWidgetHeaderProps) {
  const widget = WIDGET_REGISTRY[widgetId];
  
  if (!widget) {
    console.warn(`[StandardWidgetHeader] Unknown widget: ${widgetId}`);
    return null;
  }

  const Icon = widget.icon;
  const category = categoryOverride ?? widget.dataCategory;
  const categoryConfig = category ? CATEGORY_BADGE_CONFIG[category] : null;
  const statusConfig = STATUS_BADGE_CONFIG[state.status];

  const formattedTime = state.lastUpdated
    ? formatDistanceToNow(state.lastUpdated, { addSuffix: true })
    : null;

  return (
    <div className={cn("flex flex-col gap-1.5 pb-2 border-b border-border/50", className)}>
      {/* Top row: Icon, Title, Badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {Icon && (
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <span className="text-sm font-medium truncate">{widget.name}</span>
          
          {/* Category Badge */}
          {!hideCategory && categoryConfig && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-4 font-normal border-0",
                    categoryConfig.bgColor,
                    categoryConfig.textColor
                  )}
                >
                  {categoryConfig.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Data source: {getCategoryDescription(category)}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Status Badge */}
        {!hideStatus && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0 h-4 font-normal flex-shrink-0",
                  statusConfig.bgColor,
                  statusConfig.textColor,
                  statusConfig.borderColor,
                  state.status === "loading" && "animate-pulse"
                )}
              >
                {state.status === "loading" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  statusConfig.label
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              {state.message}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Bottom row: Last Updated */}
      {!hideTimestamp && formattedTime && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Updated {formattedTime}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Get human-readable description for a data category.
 */
function getCategoryDescription(category: WidgetDataCategory | undefined): string {
  switch (category) {
    case "sensor":
      return "LoRa sensor readings";
    case "gateway":
      return "LoRa gateway metrics";
    case "system":
      return "System-generated events";
    case "calculated":
      return "Computed from other data";
    case "manual":
      return "User-entered data";
    case "external":
      return "External API (weather, etc.)";
    default:
      return "Unknown source";
  }
}
