import * as React from 'react';

export type AppTarget = 'customer' | 'admin';

export interface WidgetRegistryEntry {
  id: string;
  name: string;
  description: string;
  component: React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>;
  defaultSize: { cols: number; rows: number };
  minSize: { cols: number; rows: number };
  maxSize: { cols: number; rows: number };
  applicableSensorKinds: string[];
  requiresProps: string[];
  category: 'sensor' | 'compliance' | 'system' | 'overview';
  /** Which app this widget is available in */
  appTarget: AppTarget[];
}

export const widgetRegistry: WidgetRegistryEntry[] = [
  // ---- Customer + Admin widgets ----
  {
    id: 'temperature',
    name: 'Temperature',
    description: 'Current temperature with sparkline and alarm bounds',
    component: React.lazy(() => import('../widgets/TemperatureWidget').then((m) => ({ default: m.TemperatureWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 2 },
    applicableSensorKinds: ['temp', 'combo', 'co2'],
    requiresProps: ['sensorId', 'unitId'],
    category: 'sensor',
    appTarget: ['customer', 'admin'],
  },
  {
    id: 'humidity',
    name: 'Humidity',
    description: 'Current humidity with sparkline',
    component: React.lazy(() => import('../widgets/HumidityWidget').then((m) => ({ default: m.HumidityWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 2 },
    applicableSensorKinds: ['temp', 'combo', 'co2'],
    requiresProps: ['sensorId', 'unitId'],
    category: 'sensor',
    appTarget: ['customer', 'admin'],
  },
  {
    id: 'door',
    name: 'Door Sensor',
    description: 'Door open/closed state with history timeline',
    component: React.lazy(() => import('../widgets/DoorSensorWidget').then((m) => ({ default: m.DoorSensorWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 2 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 3 },
    applicableSensorKinds: ['door', 'combo'],
    requiresProps: ['sensorId', 'unitId'],
    category: 'sensor',
    appTarget: ['customer', 'admin'],
  },
  {
    id: 'battery',
    name: 'Battery',
    description: 'Battery percentage from voltage + chemistry curves',
    component: React.lazy(() => import('../widgets/BatteryWidget').then((m) => ({ default: m.BatteryWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 1, rows: 1 },
    applicableSensorKinds: ['*'],
    requiresProps: ['sensorId'],
    category: 'system',
    appTarget: ['customer', 'admin'],
  },
  {
    id: 'alerts',
    name: 'Active Alerts',
    description: 'Active alerts sorted by severity',
    component: React.lazy(() => import('../widgets/AlertsWidget').then((m) => ({ default: m.AlertsWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 2 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 3, rows: 3 },
    applicableSensorKinds: ['*'],
    requiresProps: [],
    category: 'overview',
    appTarget: ['customer', 'admin'],
  },
  {
    id: 'compliance-score',
    name: 'Compliance Score',
    description: 'Time-in-range percentage with donut chart',
    component: React.lazy(() => import('../widgets/ComplianceScoreWidget').then((m) => ({ default: m.ComplianceScoreWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 2 },
    applicableSensorKinds: ['*'],
    requiresProps: [],
    category: 'compliance',
    appTarget: ['customer', 'admin'],
  },

  // ---- Admin-only widgets ----
  {
    id: 'signal-strength',
    name: 'Signal Strength',
    description: 'RSSI/SNR signal quality bars',
    component: React.lazy(() => import('../widgets/SignalStrengthWidget').then((m) => ({ default: m.SignalStrengthWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 1 },
    applicableSensorKinds: ['*'],
    requiresProps: ['sensorId'],
    category: 'system',
    appTarget: ['admin'],
  },
  {
    id: 'device-readiness',
    name: 'Device Readiness',
    description: 'Composite health score: battery + signal + uplink',
    component: React.lazy(() => import('../widgets/DeviceReadinessWidget').then((m) => ({ default: m.DeviceReadinessWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 2 },
    applicableSensorKinds: ['*'],
    requiresProps: ['sensorId'],
    category: 'system',
    appTarget: ['admin'],
  },
  {
    id: 'uplink-history',
    name: 'Uplink History',
    description: 'Uplink frequency bar chart, expected vs actual',
    component: React.lazy(() => import('../widgets/UplinkHistoryWidget').then((m) => ({ default: m.UplinkHistoryWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 2, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 3, rows: 2 },
    applicableSensorKinds: ['*'],
    requiresProps: ['sensorId'],
    category: 'system',
    appTarget: ['admin'],
  },
  {
    id: 'sensor-settings',
    name: 'Sensor Settings',
    description: 'Sensor configuration summary',
    component: React.lazy(() => import('../widgets/SensorSettingsWidget').then((m) => ({ default: m.SensorSettingsWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 1 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 2 },
    applicableSensorKinds: ['*'],
    requiresProps: ['sensorId'],
    category: 'system',
    appTarget: ['admin'],
  },
  {
    id: 'battery-detail',
    name: 'Battery Detail',
    description: 'Extended battery info with chemistry, voltage trend, estimated life',
    component: React.lazy(() => import('../widgets/BatteryDetailWidget').then((m) => ({ default: m.BatteryDetailWidget as React.ComponentType<Record<string, unknown>> }))),
    defaultSize: { cols: 1, rows: 2 },
    minSize: { cols: 1, rows: 1 },
    maxSize: { cols: 2, rows: 2 },
    applicableSensorKinds: ['*'],
    requiresProps: ['sensorId'],
    category: 'system',
    appTarget: ['admin'],
  },
];

export function getWidget(id: string): WidgetRegistryEntry | undefined {
  return widgetRegistry.find((w) => w.id === id);
}

export function getWidgetsForSensorKind(kind: string): WidgetRegistryEntry[] {
  return widgetRegistry.filter(
    (w) => w.applicableSensorKinds.includes('*') || w.applicableSensorKinds.includes(kind),
  );
}

/** Get widgets available in the customer app */
export function getCustomerWidgets(): WidgetRegistryEntry[] {
  return widgetRegistry.filter((w) => w.appTarget.includes('customer'));
}

/** Get widgets available in the admin app */
export function getAdminWidgets(): WidgetRegistryEntry[] {
  return widgetRegistry.filter((w) => w.appTarget.includes('admin'));
}

/** Get widgets for a sensor kind, filtered by app target */
export function getWidgetsForApp(kind: string, target: AppTarget): WidgetRegistryEntry[] {
  return widgetRegistry.filter(
    (w) =>
      w.appTarget.includes(target) &&
      (w.applicableSensorKinds.includes('*') || w.applicableSensorKinds.includes(kind)),
  );
}
