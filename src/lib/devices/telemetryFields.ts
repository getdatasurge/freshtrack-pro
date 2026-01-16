/**
 * Telemetry Field Definitions
 * Reusable field definitions for device telemetry
 */

import type { TelemetryFieldDefinition } from "./types";

// ============================================================================
// Formatters
// ============================================================================

export const formatTemperature = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(1)}°C`;
};

export const formatHumidity = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return `${Math.round(value)}%`;
};

export const formatBattery = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return `${Math.round(value)}%`;
};

export const formatSignal = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return `${value} dBm`;
};

export const formatBoolean = (value: unknown): string => {
  if (typeof value !== "boolean") return "—";
  return value ? "Yes" : "No";
};

export const formatDoorState = (value: unknown): string => {
  if (typeof value !== "boolean") return "—";
  return value ? "Open" : "Closed";
};

export const formatMotion = (value: unknown): string => {
  if (typeof value !== "boolean") return "—";
  return value ? "Detected" : "Clear";
};

export const formatLeak = (value: unknown): string => {
  if (typeof value !== "boolean") return "—";
  return value ? "Leak Detected" : "Dry";
};

export const formatCO2 = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return `${Math.round(value)} ppm`;
};

export const formatDistance = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(1)} mm`;
};

export const formatCoordinate = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return value.toFixed(6);
};

export const formatSpeed = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(1)} km/h`;
};

export const formatCount = (value: unknown): string => {
  if (typeof value !== "number") return "—";
  return value.toLocaleString();
};

// ============================================================================
// Common Field Definitions
// ============================================================================

export const TEMPERATURE_FIELD: TelemetryFieldDefinition = {
  key: "temperature",
  label: "Temperature",
  unit: "°C",
  formatter: formatTemperature,
  emptyValue: "—",
  type: "number",
  priority: 1,
};

export const HUMIDITY_FIELD: TelemetryFieldDefinition = {
  key: "humidity",
  label: "Humidity",
  unit: "%",
  formatter: formatHumidity,
  emptyValue: "—",
  type: "number",
  priority: 2,
};

export const BATTERY_FIELD: TelemetryFieldDefinition = {
  key: "battery",
  label: "Battery",
  unit: "%",
  formatter: formatBattery,
  emptyValue: "—",
  type: "number",
  priority: 10,
};

export const RSSI_FIELD: TelemetryFieldDefinition = {
  key: "rssi",
  label: "RSSI",
  unit: "dBm",
  formatter: formatSignal,
  emptyValue: "—",
  type: "number",
  priority: 11,
};

export const SNR_FIELD: TelemetryFieldDefinition = {
  key: "snr",
  label: "SNR",
  unit: "dB",
  formatter: (v) => (typeof v === "number" ? `${v.toFixed(1)} dB` : "—"),
  emptyValue: "—",
  type: "number",
  priority: 12,
};

export const MOTION_FIELD: TelemetryFieldDefinition = {
  key: "motion",
  label: "Motion",
  unit: "",
  formatter: formatMotion,
  emptyValue: "—",
  type: "boolean",
  priority: 1,
};

export const DOOR_OPEN_FIELD: TelemetryFieldDefinition = {
  key: "doorOpen",
  label: "Door",
  unit: "",
  formatter: formatDoorState,
  emptyValue: "—",
  type: "boolean",
  priority: 1,
};

export const TAMPER_FIELD: TelemetryFieldDefinition = {
  key: "tamper",
  label: "Tamper",
  unit: "",
  formatter: formatBoolean,
  emptyValue: "—",
  type: "boolean",
  priority: 5,
};

export const LEAK_DETECTED_FIELD: TelemetryFieldDefinition = {
  key: "leakDetected",
  label: "Leak Status",
  unit: "",
  formatter: formatLeak,
  emptyValue: "—",
  type: "boolean",
  priority: 1,
};

export const WATER_LEVEL_FIELD: TelemetryFieldDefinition = {
  key: "waterLevel",
  label: "Water Level",
  unit: "mm",
  formatter: formatDistance,
  emptyValue: "—",
  type: "number",
  priority: 1,
};

export const DISTANCE_FIELD: TelemetryFieldDefinition = {
  key: "distance",
  label: "Distance",
  unit: "mm",
  formatter: formatDistance,
  emptyValue: "—",
  type: "number",
  priority: 2,
};

export const CO2_FIELD: TelemetryFieldDefinition = {
  key: "co2",
  label: "CO₂",
  unit: "ppm",
  formatter: formatCO2,
  emptyValue: "—",
  type: "number",
  priority: 1,
};

export const VOC_FIELD: TelemetryFieldDefinition = {
  key: "voc",
  label: "VOC",
  unit: "ppb",
  formatter: (v) => (typeof v === "number" ? `${Math.round(v)} ppb` : "—"),
  emptyValue: "—",
  type: "number",
  priority: 4,
};

export const LATITUDE_FIELD: TelemetryFieldDefinition = {
  key: "lat",
  label: "Latitude",
  unit: "°",
  formatter: formatCoordinate,
  emptyValue: "—",
  type: "number",
  priority: 1,
};

export const LONGITUDE_FIELD: TelemetryFieldDefinition = {
  key: "lng",
  label: "Longitude",
  unit: "°",
  formatter: formatCoordinate,
  emptyValue: "—",
  type: "number",
  priority: 2,
};

export const SPEED_FIELD: TelemetryFieldDefinition = {
  key: "speed",
  label: "Speed",
  unit: "km/h",
  formatter: formatSpeed,
  emptyValue: "—",
  type: "number",
  priority: 3,
};

export const PULSE_COUNT_FIELD: TelemetryFieldDefinition = {
  key: "pulseCount",
  label: "Pulse Count",
  unit: "",
  formatter: formatCount,
  emptyValue: "—",
  type: "number",
  priority: 1,
};

export const FLOW_RATE_FIELD: TelemetryFieldDefinition = {
  key: "flowRate",
  label: "Flow Rate",
  unit: "L/min",
  formatter: (v) => (typeof v === "number" ? `${v.toFixed(2)} L/min` : "—"),
  emptyValue: "—",
  type: "number",
  priority: 2,
};

export const LAST_PULSE_FIELD: TelemetryFieldDefinition = {
  key: "lastPulseAt",
  label: "Last Pulse",
  unit: "",
  formatter: (v) => (typeof v === "string" ? new Date(v).toLocaleString() : "—"),
  emptyValue: "—",
  type: "datetime",
  priority: 3,
};
