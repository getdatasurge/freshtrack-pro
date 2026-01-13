/**
 * Dashboard Layout Widgets
 * 
 * All widget components for the customizable dashboard.
 */

export { TemperatureChartWidget } from "./TemperatureChartWidget";
export { CurrentTempWidget } from "./CurrentTempWidget";
export { DeviceStatusWidget } from "./DeviceStatusWidget";
export { TempLimitsWidget } from "./TempLimitsWidget";
export { ReadingsCountWidget } from "./ReadingsCountWidget";
export { AlertsBannerWidget } from "./AlertsBannerWidget";

// Re-export existing component widgets from src/components/unit
// These are wrapped directly in WidgetRenderer
export { default as DeviceReadinessCard } from "@/components/unit/DeviceReadinessCard";
export { default as LastKnownGoodCard } from "@/components/unit/LastKnownGoodCard";
export { default as UnitSensorsCard } from "@/components/unit/UnitSensorsCard";
export { default as BatteryHealthCard } from "@/components/unit/BatteryHealthCard";
