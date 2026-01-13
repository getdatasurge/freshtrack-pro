/**
 * Dashboard Layout Widgets
 * 
 * All widget components for the customizable dashboard.
 */

// Core widgets
export { TemperatureChartWidget } from "./TemperatureChartWidget";
export { CurrentTempWidget } from "./CurrentTempWidget";
export { DeviceStatusWidget } from "./DeviceStatusWidget";
export { TempLimitsWidget } from "./TempLimitsWidget";
export { ReadingsCountWidget } from "./ReadingsCountWidget";
export { AlertsBannerWidget } from "./AlertsBannerWidget";

// Wrapper widgets for existing unit components
export { DeviceReadinessWidget } from "./DeviceReadinessWidget";
export { LastKnownGoodWidget } from "./LastKnownGoodWidget";
export { ConnectedSensorsWidget } from "./ConnectedSensorsWidget";
export { BatteryHealthWidget } from "./BatteryHealthWidget";

// Site-specific widgets
export { SiteOverviewWidget } from "./SiteOverviewWidget";
export { UnitsStatusGridWidget } from "./UnitsStatusGridWidget";
export { SiteAlertsSummaryWidget } from "./SiteAlertsSummaryWidget";
export { ComplianceSummaryWidget } from "./ComplianceSummaryWidget";
