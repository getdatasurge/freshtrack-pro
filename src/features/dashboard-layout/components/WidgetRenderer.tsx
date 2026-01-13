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
  const widgetDef = WIDGET_REGISTRY[widgetId];

  if (!widgetDef) {
    return <UnknownWidget widgetId={widgetId} />;
  }

  // Unit widgets
  switch (widgetId) {
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
    
    // Site widgets
    case "site_overview":
      return <SiteOverviewWidget {...props} />;
    
    case "units_status_grid":
      return <UnitsStatusGridWidget {...props} />;
    
    case "site_alerts_summary":
      return <SiteAlertsSummaryWidget {...props} />;
    
    case "compliance_summary":
      return <ComplianceSummaryWidget {...props} />;
    
    default:
      return <UnknownWidget widgetId={widgetId} />;
  }
}
