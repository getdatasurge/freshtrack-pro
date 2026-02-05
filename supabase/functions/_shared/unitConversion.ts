/**
 * Unit Conversion Utilities
 *
 * Provides temperature unit conversion functions for use in edge functions.
 *
 * IMPORTANT: This module defines the canonical storage unit and provides
 * conversions between sensor native units, storage units, and display units.
 *
 * Architecture:
 * - Sensor Native Unit: The unit reported by the sensor decoder (usually °C for LoRaWAN)
 * - Storage Unit: The canonical unit stored in the database (°F - Fahrenheit)
 * - Display Unit: The unit shown to users based on org preference (°F or °C)
 *
 * All temperatures in the database should be in the STORAGE_UNIT (°F).
 * Conversions happen at:
 * - Ingestion: sensor native → storage
 * - Alarm evaluation: all values in storage unit (no conversion needed)
 * - Display/Notifications: storage → display (based on org preference)
 */

export type TemperatureUnit = 'C' | 'F';
export type SystemUnitsPreference = 'imperial' | 'metric';

/**
 * The canonical storage unit for all temperatures in the database.
 * All sensor readings and thresholds are stored in this unit.
 */
export const STORAGE_UNIT: TemperatureUnit = 'F';

/**
 * Default sensor native unit for LoRaWAN sensors.
 * Most LoRaWAN temperature sensors report in Celsius.
 */
export const DEFAULT_SENSOR_NATIVE_UNIT: TemperatureUnit = 'C';

/**
 * Convert temperature between units
 *
 * @param value - The temperature value to convert
 * @param fromUnit - The source unit ('C' or 'F')
 * @param toUnit - The target unit ('C' or 'F')
 * @returns The converted temperature value
 *
 * @example
 * convertTemp(20, 'C', 'F') // Returns 68
 * convertTemp(68, 'F', 'C') // Returns 20
 */
export function convertTemp(
  value: number,
  fromUnit: TemperatureUnit,
  toUnit: TemperatureUnit
): number {
  if (fromUnit === toUnit) return value;

  if (fromUnit === 'C' && toUnit === 'F') {
    // Celsius to Fahrenheit: F = (C × 9/5) + 32
    return (value * 9 / 5) + 32;
  }

  if (fromUnit === 'F' && toUnit === 'C') {
    // Fahrenheit to Celsius: C = (F - 32) × 5/9
    return (value - 32) * 5 / 9;
  }

  // Should never reach here, but return original value as fallback
  return value;
}

/**
 * Convert temperature from sensor native unit to storage unit
 *
 * @param value - The temperature value from the sensor
 * @param sensorNativeUnit - The unit reported by the sensor (defaults to 'C')
 * @returns Temperature in storage unit (°F)
 */
export function sensorToStorage(
  value: number,
  sensorNativeUnit: TemperatureUnit = DEFAULT_SENSOR_NATIVE_UNIT
): number {
  return convertTemp(value, sensorNativeUnit, STORAGE_UNIT);
}

/**
 * Convert temperature from storage unit to sensor native unit
 * Used when we need to compare storage values with sensor thresholds
 *
 * @param value - The temperature value from storage (in °F)
 * @param sensorNativeUnit - The target sensor native unit (defaults to 'C')
 * @returns Temperature in sensor native unit
 */
export function storageToSensorNative(
  value: number,
  sensorNativeUnit: TemperatureUnit = DEFAULT_SENSOR_NATIVE_UNIT
): number {
  return convertTemp(value, STORAGE_UNIT, sensorNativeUnit);
}

/**
 * Convert temperature from storage unit to display unit based on system preference
 *
 * @param value - The temperature value from storage (in °F)
 * @param systemUnits - The organization's display preference
 * @returns Temperature in display unit
 */
export function storageToDisplay(
  value: number,
  systemUnits: SystemUnitsPreference
): number {
  const displayUnit: TemperatureUnit = systemUnits === 'metric' ? 'C' : 'F';
  return convertTemp(value, STORAGE_UNIT, displayUnit);
}

/**
 * Convert temperature from display unit to storage unit
 * Used when user enters a temperature value that needs to be stored
 *
 * @param value - The temperature value entered by the user
 * @param systemUnits - The organization's display preference
 * @returns Temperature in storage unit (°F)
 */
export function displayToStorage(
  value: number,
  systemUnits: SystemUnitsPreference
): number {
  const displayUnit: TemperatureUnit = systemUnits === 'metric' ? 'C' : 'F';
  return convertTemp(value, displayUnit, STORAGE_UNIT);
}

/**
 * Get the unit symbol for a temperature unit
 *
 * @param unit - The temperature unit
 * @returns The unit symbol (e.g., '°F' or '°C')
 */
export function getUnitSymbol(unit: TemperatureUnit): string {
  return unit === 'F' ? '°F' : '°C';
}

/**
 * Get the display unit symbol based on system preference
 *
 * @param systemUnits - The organization's display preference
 * @returns The unit symbol (e.g., '°F' or '°C')
 */
export function getDisplayUnitSymbol(systemUnits: SystemUnitsPreference): string {
  return systemUnits === 'imperial' ? '°F' : '°C';
}

/**
 * Format a temperature value for display
 *
 * @param storageValue - The temperature value in storage unit (°F)
 * @param systemUnits - The organization's display preference
 * @param options - Formatting options
 * @returns Formatted temperature string (e.g., "68.5°F" or "20.3°C")
 */
export function formatTemp(
  storageValue: number | null | undefined,
  systemUnits: SystemUnitsPreference,
  options: { decimals?: number; showUnit?: boolean } = {}
): string {
  const { decimals = 1, showUnit = true } = options;

  if (storageValue === null || storageValue === undefined) {
    return showUnit ? '--°' : '--';
  }

  const displayValue = storageToDisplay(storageValue, systemUnits);
  const formatted = displayValue.toFixed(decimals);

  if (!showUnit) return formatted;
  return `${formatted}${getDisplayUnitSymbol(systemUnits)}`;
}

/**
 * Format a temperature rate (e.g., °/hour) for display
 *
 * @param ratePerHour - The temperature rate in storage units per hour
 * @param systemUnits - The organization's display preference
 * @returns Formatted rate string (e.g., "2.5°/hour")
 */
export function formatTempRate(
  ratePerHour: number,
  systemUnits: SystemUnitsPreference
): string {
  // For rates, we only convert the magnitude, not offset
  // A 1°F change = 5/9 °C change
  const displayRate = systemUnits === 'metric'
    ? ratePerHour * 5 / 9
    : ratePerHour;
  return `${Math.abs(displayRate).toFixed(1)}°/hour`;
}

/**
 * Create an alarm value record with both native and display values
 * Used for storing alarm events with proper unit documentation
 *
 * @param storageValue - The temperature value in storage unit (°F)
 * @param sensorNativeUnit - The original sensor unit
 * @param systemUnits - The organization's display preference
 * @returns Object with native, storage, and display values
 */
export function createAlarmValueRecord(
  storageValue: number,
  sensorNativeUnit: TemperatureUnit = DEFAULT_SENSOR_NATIVE_UNIT,
  systemUnits: SystemUnitsPreference = 'imperial'
): {
  value_storage: number;
  unit_storage: TemperatureUnit;
  value_native: number;
  unit_native: TemperatureUnit;
  value_display: number;
  unit_display: TemperatureUnit;
} {
  const displayUnit: TemperatureUnit = systemUnits === 'metric' ? 'C' : 'F';

  return {
    value_storage: storageValue,
    unit_storage: STORAGE_UNIT,
    value_native: convertTemp(storageValue, STORAGE_UNIT, sensorNativeUnit),
    unit_native: sensorNativeUnit,
    value_display: convertTemp(storageValue, STORAGE_UNIT, displayUnit),
    unit_display: displayUnit,
  };
}

/**
 * Validate that a temperature value is within reasonable bounds
 *
 * @param value - The temperature value to validate (in storage unit °F)
 * @returns true if the value is within reasonable bounds
 */
export function isReasonableTemperature(value: number): boolean {
  // Reasonable range: -100°F to 500°F (covers most industrial applications)
  return value >= -100 && value <= 500;
}

/**
 * Parse a temperature value that may have a unit suffix
 *
 * @param input - String like "20C", "68F", "20°C", "68°F"
 * @param defaultUnit - Unit to assume if none specified
 * @returns Object with value and unit, or null if parsing failed
 */
export function parseTemperatureWithUnit(
  input: string,
  defaultUnit: TemperatureUnit = 'F'
): { value: number; unit: TemperatureUnit } | null {
  const cleaned = input.trim().toUpperCase();

  // Try to match patterns like "20C", "20°C", "20 C", "20 °C"
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([CF])?$/);

  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit: TemperatureUnit = (match[2] as TemperatureUnit) || defaultUnit;

  if (isNaN(value)) return null;

  return { value, unit };
}
