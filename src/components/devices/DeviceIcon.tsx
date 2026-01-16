/**
 * DeviceIcon Component
 * Registry-driven icon rendering for devices
 */

import { cn } from "@/lib/utils";
import { getDeviceDefinition, getCategoryDefinition } from "@/lib/devices";
import type { DeviceCategory } from "@/lib/devices";

type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface DeviceIconProps {
  /** Device model identifier */
  model?: string | null;
  /** Override category (used when model is unknown) */
  category?: DeviceCategory;
  /** Device status for styling */
  status?: string;
  /** Icon size */
  size?: IconSize;
  /** Additional CSS classes */
  className?: string;
  /** Use category icon instead of model icon */
  useCategoryIcon?: boolean;
}

const sizeClasses: Record<IconSize, string> = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

const statusOpacity: Record<string, string> = {
  active: "",
  offline: "opacity-50",
  pending: "opacity-75",
  joining: "opacity-75 animate-pulse",
  fault: "",
};

export function DeviceIcon({
  model,
  category,
  status,
  size = "md",
  className,
  useCategoryIcon = false,
}: DeviceIconProps) {
  // Get device definition from registry
  const definition = getDeviceDefinition(model);
  
  // Determine which icon to use
  const Icon = useCategoryIcon ? definition.categoryIcon : definition.modelIcon;
  
  // Get category color (use override category if provided)
  const effectiveCategory = category ?? definition.category;
  const categoryDef = getCategoryDefinition(effectiveCategory);
  
  // Build class list
  const statusClass = status ? statusOpacity[status] ?? "" : "";
  
  return (
    <Icon
      className={cn(
        sizeClasses[size],
        categoryDef.color,
        statusClass,
        className
      )}
    />
  );
}

/**
 * CategoryIcon Component
 * Renders category icon directly (for category pickers, etc.)
 */
interface CategoryIconProps {
  category: DeviceCategory;
  size?: IconSize;
  className?: string;
}

export function CategoryIcon({ category, size = "md", className }: CategoryIconProps) {
  const categoryDef = getCategoryDefinition(category);
  const Icon = categoryDef.icon;
  
  return (
    <Icon className={cn(sizeClasses[size], categoryDef.color, className)} />
  );
}
