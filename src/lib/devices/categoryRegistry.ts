/**
 * Category Registry
 * Defines all device categories with their icons, colors, and metadata
 */

import {
  Radar,
  Thermometer,
  Droplets,
  Gauge,
  DoorClosed,
  MapPin,
  Cloud,
  Layers,
  HelpCircle,
} from "lucide-react";
import type { CategoryDefinition, DeviceCategory } from "./types";

// ============================================================================
// Category Registry
// ============================================================================

export const CATEGORY_REGISTRY: Record<DeviceCategory, CategoryDefinition> = {
  motion: {
    label: "Motion Sensor",
    icon: Radar,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "PIR or motion detection sensors",
  },
  temperature: {
    label: "Temperature",
    icon: Thermometer,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "Temperature and humidity monitoring",
  },
  leak: {
    label: "Leak Detection",
    icon: Droplets,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Water leak and level sensors",
  },
  metering: {
    label: "Metering",
    icon: Gauge,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "Pulse counters and utility meters",
  },
  door: {
    label: "Door/Contact",
    icon: DoorClosed,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Door sensors and contact switches",
  },
  gps: {
    label: "GPS/Location",
    icon: MapPin,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    description: "GPS trackers and location devices",
  },
  air_quality: {
    label: "Air Quality",
    icon: Cloud,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    description: "CO₂ and air quality sensors",
  },
  multi_sensor: {
    label: "Multi-Sensor",
    icon: Layers,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    description: "Combination sensors",
  },
  unknown: {
    label: "Unknown",
    icon: HelpCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    description: "Unrecognized device type",
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get category definition by category key
 */
export function getCategoryDefinition(category: DeviceCategory): CategoryDefinition {
  return CATEGORY_REGISTRY[category] ?? CATEGORY_REGISTRY.unknown;
}

/**
 * Get all categories as an array for rendering
 */
export function getAllCategories(): Array<{ key: DeviceCategory; definition: CategoryDefinition }> {
  return Object.entries(CATEGORY_REGISTRY).map(([key, definition]) => ({
    key: key as DeviceCategory,
    definition,
  }));
}

/**
 * Get categories grouped for picker UI (excludes 'unknown')
 */
export function getSelectableCategories(): Array<{ key: DeviceCategory; definition: CategoryDefinition }> {
  return getAllCategories().filter(({ key }) => key !== "unknown");
}
