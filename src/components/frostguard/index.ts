// ============================================================================
// FrostGuard Design System — Layer 2 Barrel Export
// Import: import { StatusBadge, TemperatureWidget, ... } from '@/components/frostguard';
// ============================================================================

// Domain Tokens
export { computeUnitStatus, statusToVariant, statusLabel, type UnitStatusResult } from './tokens/statusLogic';
export { sensorColors, getSensorColor, type SensorKind } from './tokens/sensorColors';
export { ALARM_DEFAULTS, getAlarmDefaults, evaluateAlarmSeverity, isInRange, type AlarmThresholds, type AlarmSeverity } from './tokens/alarmDefaults';
export { BATTERY_CURVES, CHEMISTRY_ALIASES, voltageToPercent, batteryVariant, resolveChemistry, getChemistryForSensor, estimateBatteryLife, type VoltageCurve } from './tokens/batteryChemistry';

// Primitives
export { StatusBadge, type StatusBadgeProps } from './primitives/StatusBadge';
export { SensorIcon, type SensorIconProps } from './primitives/SensorIcon';
export { TrendIndicator, type TrendIndicatorProps } from './primitives/TrendIndicator';
export { TimeAgo, type TimeAgoProps } from './primitives/TimeAgo';
export { MetricDisplay, type MetricDisplayProps } from './primitives/MetricDisplay';
export { AlarmBoundLine, type AlarmBoundLineProps } from './primitives/AlarmBoundLine';

// Widgets — Container + Error Boundary
export { WidgetContainer, type WidgetContainerProps } from './widgets/WidgetContainer';
export { WidgetErrorBoundary } from './widgets/WidgetErrorBoundary';
export { TemperatureWidget, type TemperatureWidgetProps } from './widgets/TemperatureWidget';
export { HumidityWidget, type HumidityWidgetProps } from './widgets/HumidityWidget';
export { DoorSensorWidget, type DoorSensorWidgetProps } from './widgets/DoorSensorWidget';
export { BatteryWidget, type BatteryWidgetProps } from './widgets/BatteryWidget';
export { AlertsWidget, type AlertsWidgetProps } from './widgets/AlertsWidget';
export { ComplianceScoreWidget, type ComplianceScoreWidgetProps } from './widgets/ComplianceScoreWidget';

// Widgets — Admin only
export { SignalStrengthWidget, type SignalStrengthWidgetProps } from './widgets/SignalStrengthWidget';
export { DeviceReadinessWidget, type DeviceReadinessWidgetProps } from './widgets/DeviceReadinessWidget';
export { UplinkHistoryWidget, type UplinkHistoryWidgetProps } from './widgets/UplinkHistoryWidget';
export { SensorSettingsWidget, type SensorSettingsWidgetProps } from './widgets/SensorSettingsWidget';
export { BatteryDetailWidget, type BatteryDetailWidgetProps } from './widgets/BatteryDetailWidget';

// Cards
export { UnitSummaryCard, type UnitSummaryCardProps } from './cards/UnitSummaryCard';
export { SensorCard, type SensorCardProps } from './cards/SensorCard';
export { AlertCard, type AlertCardProps } from './cards/AlertCard';

// Layouts — Customer App
export { WidgetGrid, type WidgetGridProps, type WidgetGridItem } from './layouts/WidgetGrid';
export { DashboardShell, type DashboardShellProps } from './layouts/DashboardShell';
export { FixedWidgetLayout, CUSTOMER_LAYOUTS, type FixedWidgetLayoutProps, type FixedLayoutConfig } from './layouts/FixedWidgetLayout';
export { UnitDetailLayout, type UnitDetailLayoutProps } from './layouts/UnitDetailLayout';
export { DashboardLayout, type DashboardLayoutProps, type DashboardUnit, type DashboardStats } from './layouts/DashboardLayout';

// Layouts — Admin App
export { AdminWidgetGrid, type AdminWidgetGridProps } from './layouts/AdminWidgetGrid';
export { WidgetPicker, type WidgetPickerProps } from './layouts/WidgetPicker';
export { WidgetPreview, type WidgetPreviewProps } from './layouts/WidgetPreview';
export { LayoutManager, type LayoutManagerProps, type SavedLayout } from './layouts/LayoutManager';
export { createSupabaseLayoutStore, useLayoutPersistence, type LayoutStore, type UseLayoutPersistenceReturn } from './layouts/LayoutPersistence';

// Registry
export { widgetRegistry, getWidget, getWidgetsForSensorKind, getCustomerWidgets, getAdminWidgets, getWidgetsForApp, type WidgetRegistryEntry, type AppTarget } from './registry/widgetRegistry';
export { DEFAULT_WIDGET_LAYOUTS, getDefaultWidgets } from './registry/widgetDefaults';
export { renderWidget, createPlacement, buildDefaultPlacements, type WidgetPlacement } from './registry/widgetFactory';
