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

// New Unit widgets
export { TemperatureStatisticsWidget } from "./TemperatureStatisticsWidget";
export { TemperatureTrendWidget } from "./TemperatureTrendWidget";
export { TemperatureExcursionWidget } from "./TemperatureExcursionWidget";
export { DoorActivityWidget } from "./DoorActivityWidget";
export { HumidityChartWidget } from "./HumidityChartWidget";
export { ManualLogStatusWidget } from "./ManualLogStatusWidget";
export { AlertHistoryWidget } from "./AlertHistoryWidget";
export { SensorSignalTrendWidget } from "./SensorSignalTrendWidget";
export { QuickActionsWidget } from "./QuickActionsWidget";
export { EventTimelineWidget } from "./EventTimelineWidget";
export { UnitComplianceScoreWidget } from "./UnitComplianceScoreWidget";
export { MaintenanceForecastWidget } from "./MaintenanceForecastWidget";
export { TemperatureVsExternalWidget } from "./TemperatureVsExternalWidget";
export { AnnotationsWidget } from "./AnnotationsWidget";

// New Site widgets
export { TemperatureHeatmapWidget } from "./TemperatureHeatmapWidget";
export { AlertsTrendWidget } from "./AlertsTrendWidget";
export { ComplianceScoreboardWidget } from "./ComplianceScoreboardWidget";
export { AreaBreakdownWidget } from "./AreaBreakdownWidget";
export { RecentEventsFeedWidget } from "./RecentEventsFeedWidget";
export { UnitComparisonWidget } from "./UnitComparisonWidget";
export { ProblemUnitsWidget } from "./ProblemUnitsWidget";
export { ManualLogOverviewWidget } from "./ManualLogOverviewWidget";
export { SiteActivityGraphWidget } from "./SiteActivityGraphWidget";
export { ExternalWeatherWidget } from "./ExternalWeatherWidget";
export { MaintenanceCalendarWidget } from "./MaintenanceCalendarWidget";
export { DowntimeTrackerWidget } from "./DowntimeTrackerWidget";
export { QuickStatsCardsWidget } from "./QuickStatsCardsWidget";
export { UnitTypeDistributionWidget } from "./UnitTypeDistributionWidget";
export { GatewayHealthWidget } from "./GatewayHealthWidget";
