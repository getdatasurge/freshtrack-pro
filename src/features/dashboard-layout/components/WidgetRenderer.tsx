import { AlertTriangle } from "lucide-react";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";

// Widget component imports - these will be created or mapped later
// For now, we'll use placeholder components that can be replaced

interface WidgetRendererProps {
  widgetId: string;
  props: Record<string, unknown>;
}

// Placeholder component for widgets not yet implemented
function PlaceholderWidget({ widgetId }: { widgetId: string }) {
  const widgetDef = WIDGET_REGISTRY[widgetId];
  const Icon = widgetDef?.icon;

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
      {Icon ? <Icon className="h-8 w-8 mb-2 opacity-50" /> : null}
      <p className="text-sm font-medium">{widgetDef?.name || widgetId}</p>
      <p className="text-xs opacity-75">{widgetDef?.description}</p>
    </div>
  );
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

  // For now, render placeholders. In Phase 7, we'll connect these to actual widget components
  // by either:
  // 1. Adding a `component` property to WIDGET_REGISTRY entries
  // 2. Or mapping widgetId to imported components here
  
  switch (widgetId) {
    case "temperature_chart":
      // Will render TemperatureChartWidget with props.readings, props.timelineState, etc.
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "current_temp":
      // Will render CurrentTempWidget with props.unit, props.derivedStatus
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "device_status":
      // Will render DeviceStatusWidget with props.derivedStatus
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "alerts_banner":
      // Will render AlertsBannerWidget with props.unitId
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "temp_limits":
      // Will render TempLimitsWidget with props.unit
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "readings_count":
      // Will render ReadingsCountWidget with props.count
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "device_readiness":
      // Will render DeviceReadinessCard component
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "last_known_good":
      // Will render LastKnownGoodCard component
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "connected_sensors":
      // Will render UnitSensorsCard component
      return <PlaceholderWidget widgetId={widgetId} />;
    
    case "battery_health":
      // Will render BatteryHealthCard component
      return <PlaceholderWidget widgetId={widgetId} />;
    
    default:
      return <PlaceholderWidget widgetId={widgetId} />;
  }
}
