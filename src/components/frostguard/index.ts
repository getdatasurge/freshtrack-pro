// ============================================================================
// FrostGuard Design System — Layer 2 Barrel Export
// Import: import { StatusBadge, TemperatureWidget, ... } from '@/components/frostguard';
// ============================================================================

// Domain Tokens
export { computeUnitStatus, statusToVariant, statusLabel, type UnitStatusResult } from './tokens/statusLogic';
export { sensorColors, getSensorColor, type SensorKind } from './tokens/sensorColors';
export { ALARM_DEFAULTS, getAlarmDefaults, type AlarmThresholds } from './tokens/alarmDefaults';

// Primitives
export { StatusBadge, type StatusBadgeProps } from './primitives/StatusBadge';
export { SensorIcon, type SensorIconProps } from './primitives/SensorIcon';
export { TrendIndicator, type TrendIndicatorProps } from './primitives/TrendIndicator';
export { TimeAgo, type TimeAgoProps } from './primitives/TimeAgo';
export { MetricDisplay, type MetricDisplayProps } from './primitives/MetricDisplay';

// Widgets
export { WidgetContainer, type WidgetContainerProps } from './widgets/WidgetContainer';
export { TemperatureWidget, type TemperatureWidgetProps } from './widgets/TemperatureWidget';
export { HumidityWidget, type HumidityWidgetProps } from './widgets/HumidityWidget';
export { DoorSensorWidget, type DoorSensorWidgetProps } from './widgets/DoorSensorWidget';
export { BatteryWidget, type BatteryWidgetProps } from './widgets/BatteryWidget';
export { SignalStrengthWidget, type SignalStrengthWidgetProps } from './widgets/SignalStrengthWidget';
export { AlertsWidget, type AlertsWidgetProps } from './widgets/AlertsWidget';
export { DeviceReadinessWidget, type DeviceReadinessWidgetProps } from './widgets/DeviceReadinessWidget';
export { UplinkHistoryWidget, type UplinkHistoryWidgetProps } from './widgets/UplinkHistoryWidget';
export { ComplianceScoreWidget, type ComplianceScoreWidgetProps } from './widgets/ComplianceScoreWidget';
export { SensorSettingsWidget, type SensorSettingsWidgetProps } from './widgets/SensorSettingsWidget';

// Cards
export { UnitSummaryCard, type UnitSummaryCardProps } from './cards/UnitSummaryCard';
export { SensorCard, type SensorCardProps } from './cards/SensorCard';
export { AlertCard, type AlertCardProps } from './cards/AlertCard';

// Layouts
export { WidgetGrid, type WidgetGridProps, type WidgetGridItem } from './layouts/WidgetGrid';
export { DashboardShell, type DashboardShellProps } from './layouts/DashboardShell';

// Registry
export { widgetRegistry, getWidget, getWidgetsForSensorKind, type WidgetRegistryEntry } from './registry/widgetRegistry';
export { DEFAULT_WIDGET_LAYOUTS, getDefaultWidgets } from './registry/widgetDefaults';
