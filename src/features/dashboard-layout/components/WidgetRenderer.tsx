import { AlertTriangle } from "lucide-react";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";
import type { WidgetProps } from "../types";

// Widget imports
import { TemperatureChartWidget } from "../widgets/TemperatureChartWidget";
import { CurrentTempWidget } from "../widgets/CurrentTempWidget";
import { DeviceStatusWidget } from "../widgets/DeviceStatusWidget";
import { TempLimitsWidget } from "../widgets/TempLimitsWidget";
import { ReadingsCountWidget } from "../widgets/ReadingsCountWidget";
import { AlertsBannerWidget } from "../widgets/AlertsBannerWidget";
import { DeviceReadinessWidget } from "../widgets/DeviceReadinessWidget";
import { LastKnownGoodWidget } from "../widgets/LastKnownGoodWidget";
import { ConnectedSensorsWidget } from "../widgets/ConnectedSensorsWidget";
import { BatteryHealthWidget } from "../widgets/BatteryHealthWidget";
import { SiteOverviewWidget } from "../widgets/SiteOverviewWidget";
import { UnitsStatusGridWidget } from "../widgets/UnitsStatusGridWidget";
import { SiteAlertsSummaryWidget } from "../widgets/SiteAlertsSummaryWidget";
import { ComplianceSummaryWidget } from "../widgets/ComplianceSummaryWidget";

// New Unit widgets
import { TemperatureStatisticsWidget } from "../widgets/TemperatureStatisticsWidget";
import { TemperatureTrendWidget } from "../widgets/TemperatureTrendWidget";
import { TemperatureExcursionWidget } from "../widgets/TemperatureExcursionWidget";
import { DoorActivityWidget } from "../widgets/DoorActivityWidget";
import { HumidityChartWidget } from "../widgets/HumidityChartWidget";
import { ManualLogStatusWidget } from "../widgets/ManualLogStatusWidget";
import { AlertHistoryWidget } from "../widgets/AlertHistoryWidget";
import { SensorSignalTrendWidget } from "../widgets/SensorSignalTrendWidget";
import { QuickActionsWidget } from "../widgets/QuickActionsWidget";
import { EventTimelineWidget } from "../widgets/EventTimelineWidget";
import { UnitComplianceScoreWidget } from "../widgets/UnitComplianceScoreWidget";
import { MaintenanceForecastWidget } from "../widgets/MaintenanceForecastWidget";
import { TemperatureVsExternalWidget } from "../widgets/TemperatureVsExternalWidget";
import { AnnotationsWidget } from "../widgets/AnnotationsWidget";

// New Site widgets
import { TemperatureHeatmapWidget } from "../widgets/TemperatureHeatmapWidget";
import { AlertsTrendWidget } from "../widgets/AlertsTrendWidget";
import { ComplianceScoreboardWidget } from "../widgets/ComplianceScoreboardWidget";
import { AreaBreakdownWidget } from "../widgets/AreaBreakdownWidget";
import { RecentEventsFeedWidget } from "../widgets/RecentEventsFeedWidget";
import { UnitComparisonWidget } from "../widgets/UnitComparisonWidget";
import { ProblemUnitsWidget } from "../widgets/ProblemUnitsWidget";
import { ManualLogOverviewWidget } from "../widgets/ManualLogOverviewWidget";
import { SiteActivityGraphWidget } from "../widgets/SiteActivityGraphWidget";
import { ExternalWeatherWidget } from "../widgets/ExternalWeatherWidget";
import { MaintenanceCalendarWidget } from "../widgets/MaintenanceCalendarWidget";
import { DowntimeTrackerWidget } from "../widgets/DowntimeTrackerWidget";
import { QuickStatsCardsWidget } from "../widgets/QuickStatsCardsWidget";
import { UnitTypeDistributionWidget } from "../widgets/UnitTypeDistributionWidget";
import { GatewayHealthWidget } from "../widgets/GatewayHealthWidget";

interface WidgetRendererProps {
  widgetId: string;
  props: WidgetProps;
}

// Unknown widget fallback
function UnknownWidget({ widgetId }: { widgetId: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center text-destructive">
      <AlertTriangle className="h-8 w-8 mb-2" />
      <p className="text-sm font-medium">Unknown Widget</p>
      <p className="text-xs opacity-75">ID: {widgetId}</p>
    </div>
  );
}

export function WidgetRenderer({ widgetId, props }: WidgetRendererProps) {
  const DEV = import.meta.env.DEV;
  const widgetDef = WIDGET_REGISTRY[widgetId];

  // STEP 5: Per-widget debug logging
  DEV && console.log('[WidgetRender]', {
    widget: widgetId,
    entityId: props.entityId,
    organizationId: props.organizationId,
    siteId: props.siteId,
    hasUnit: !!props.unit,
    hasSensor: !!props.sensor,
    hasReadings: (props.readings?.length ?? 0) > 0,
  });

  if (!widgetDef) {
    return <UnknownWidget widgetId={widgetId} />;
  }

  switch (widgetId) {
    // ===== Existing Unit widgets =====
    case "temperature_chart":
      return (
        <TemperatureChartWidget
          readings={props.readings || []}
          comparisonReadings={props.comparisonReadings}
          tempLimitHigh={props.unit?.temp_limit_high ?? 40}
          tempLimitLow={props.unit?.temp_limit_low ?? null}
          timelineState={props.timelineState!}
        />
      );
    
    case "current_temp":
      return (
        <CurrentTempWidget
          temperature={props.unit?.last_temp_reading ?? null}
          tempLimitHigh={props.unit?.temp_limit_high ?? 40}
          tempLimitLow={props.unit?.temp_limit_low ?? null}
          lastReadingAt={props.unit?.last_reading_at ?? null}
          derivedStatus={props.derivedStatus || { isOnline: false, statusLabel: "Unknown", statusColor: "text-muted-foreground", statusBgColor: "bg-muted" }}
        />
      );
    
    case "device_status":
      return (
        <DeviceStatusWidget
          derivedStatus={props.derivedStatus || { statusLabel: "Unknown", statusColor: "text-muted-foreground", statusBgColor: "bg-muted" }}
          unitType={props.unit?.unit_type ?? "refrigerator"}
        />
      );
    
    case "alerts_banner":
      return (
        <AlertsBannerWidget
          alerts={props.alerts || []}
          onLogTemp={props.onLogTemp || (() => {})}
        />
      );
    
    case "temp_limits":
      return (
        <TempLimitsWidget
          tempLimitHigh={props.unit?.temp_limit_high ?? 40}
          tempLimitLow={props.unit?.temp_limit_low ?? null}
        />
      );
    
    case "readings_count":
      return <ReadingsCountWidget count={props.readings?.length ?? 0} />;
    
    case "device_readiness":
      return <DeviceReadinessWidget {...props} />;
    
    case "last_known_good":
      return <LastKnownGoodWidget {...props} />;
    
    case "connected_sensors":
      return <ConnectedSensorsWidget {...props} />;
    
    case "battery_health":
      return <BatteryHealthWidget {...props} />;

    // ===== Existing Site widgets =====
    case "site_overview":
      return <SiteOverviewWidget {...props} />;
    
    case "units_status_grid":
      return <UnitsStatusGridWidget {...props} />;
    
    case "site_alerts_summary":
      return <SiteAlertsSummaryWidget {...props} />;
    
    case "compliance_summary":
      return <ComplianceSummaryWidget {...props} />;

    // ===== New Unit widgets =====
    case "temperature_statistics":
      return <TemperatureStatisticsWidget {...props} />;

    case "temperature_trend":
      return <TemperatureTrendWidget {...props} />;

    case "temperature_excursion":
      return <TemperatureExcursionWidget {...props} />;

    case "door_activity":
      return <DoorActivityWidget {...props} />;

    case "humidity_chart":
      return <HumidityChartWidget {...props} />;

    case "manual_log_status":
      return <ManualLogStatusWidget {...props} />;

    case "alert_history":
      return <AlertHistoryWidget {...props} />;

    case "sensor_signal_trend":
      return <SensorSignalTrendWidget {...props} />;

    case "quick_actions":
      return <QuickActionsWidget {...props} />;

    case "event_timeline":
      return <EventTimelineWidget {...props} />;

    case "unit_compliance_score":
      return <UnitComplianceScoreWidget {...props} />;

    case "maintenance_forecast":
      return <MaintenanceForecastWidget {...props} />;

    case "temperature_vs_external":
      return <TemperatureVsExternalWidget {...props} />;

    case "annotations":
      return <AnnotationsWidget {...props} />;

    // ===== New Site widgets =====
    case "temperature_heatmap":
      return <TemperatureHeatmapWidget {...props} />;

    case "alerts_trend":
      return <AlertsTrendWidget {...props} />;

    case "compliance_scoreboard":
      return <ComplianceScoreboardWidget {...props} />;

    case "area_breakdown":
      return <AreaBreakdownWidget {...props} />;

    case "recent_events_feed":
      return <RecentEventsFeedWidget {...props} />;

    case "unit_comparison":
      return <UnitComparisonWidget {...props} />;

    case "problem_units":
      return <ProblemUnitsWidget {...props} />;

    case "manual_log_overview":
      return <ManualLogOverviewWidget {...props} />;

    case "site_activity_graph":
      return <SiteActivityGraphWidget {...props} />;

    case "external_weather":
      return <ExternalWeatherWidget {...props} />;

    case "maintenance_calendar":
      return <MaintenanceCalendarWidget {...props} />;

    case "downtime_tracker":
      return <DowntimeTrackerWidget {...props} />;

    case "quick_stats_cards":
      return <QuickStatsCardsWidget {...props} />;

    case "unit_type_distribution":
      return <UnitTypeDistributionWidget {...props} />;

    case "gateway_health":
      return <GatewayHealthWidget {...props} />;

    default:
      return <UnknownWidget widgetId={widgetId} />;
  }
}
