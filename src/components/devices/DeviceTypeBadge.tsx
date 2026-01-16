/**
 * DeviceTypeBadge Component
 * Shows device model/category with optional mismatch warning
 */

import { AlertTriangle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getDeviceDefinition, getCategoryDefinition } from "@/lib/devices";
import type { DeviceCategory } from "@/lib/devices";

interface DeviceTypeBadgeProps {
  /** Device model identifier */
  model?: string | null;
  /** Whether there's a type mismatch */
  hasMismatch?: boolean;
  /** Mismatch reason for tooltip */
  mismatchReason?: string;
  /** Show as unknown device */
  isUnknown?: boolean;
  /** Show category instead of model name */
  showCategory?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "default";
}

export function DeviceTypeBadge({
  model,
  hasMismatch = false,
  mismatchReason,
  isUnknown = false,
  showCategory = false,
  className,
  size = "default",
}: DeviceTypeBadgeProps) {
  const definition = getDeviceDefinition(model);
  const categoryDef = getCategoryDefinition(definition.category);
  
  const displayText = showCategory 
    ? categoryDef.label 
    : (isUnknown || definition.category === "unknown")
      ? "Unknown"
      : definition.displayName;
  
  const isUnknownDevice = isUnknown || definition.category === "unknown";
  
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Badge
        variant="outline"
        className={cn(
          "font-normal",
          categoryDef.bgColor,
          size === "sm" && "text-xs px-1.5 py-0"
        )}
      >
        {isUnknownDevice && (
          <HelpCircle className="w-3 h-3 mr-1 text-muted-foreground" />
        )}
        {displayText}
      </Badge>
      
      {hasMismatch && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertTriangle className="w-3.5 h-3.5 text-warning cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">Type Mismatch</p>
            <p className="text-xs text-muted-foreground">
              {mismatchReason ?? "Device type doesn't match expected category"}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * CategoryBadge Component
 * Shows just the category as a colored badge
 */
interface CategoryBadgeProps {
  category: DeviceCategory;
  className?: string;
  size?: "sm" | "default";
}

export function CategoryBadge({ category, className, size = "default" }: CategoryBadgeProps) {
  const categoryDef = getCategoryDefinition(category);
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        categoryDef.bgColor,
        categoryDef.color,
        size === "sm" && "text-xs px-1.5 py-0",
        className
      )}
    >
      {categoryDef.label}
    </Badge>
  );
}
