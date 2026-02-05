/**
 * UnitsContext
 *
 * Provides organization-wide temperature units preference (imperial/metric).
 * All temperatures are stored in Fahrenheit (canonical) and converted for display.
 *
 * Usage:
 *   const { units, formatTemp, toDisplayTemp, fromDisplayTemp } = useUnits();
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity';
import { toast } from 'sonner';

export type UnitsPreference = 'imperial' | 'metric';

interface FormatTempOptions {
  /** Number of decimal places (default: 1) */
  decimals?: number;
  /** Include unit symbol (default: true) */
  showUnit?: boolean;
}

interface UnitsContextValue {
  /** Current units preference */
  units: UnitsPreference;
  /** Whether units are still loading */
  isLoading: boolean;
  /** Update the units preference (persists to DB) */
  setUnits: (units: UnitsPreference) => Promise<void>;
  /** Convert a temperature from canonical (°F) to display units */
  toDisplayTemp: (fahrenheit: number | null) => number | null;
  /** Convert a temperature from display units back to canonical (°F) */
  fromDisplayTemp: (displayValue: number | null) => number | null;
  /** Format a temperature value (in canonical °F) for display */
  formatTemp: (fahrenheit: number | null, options?: FormatTempOptions) => string;
  /** Format a temperature rate (°/hour) - used for trends */
  formatTempRate: (ratePerHour: number) => string;
  /** Get the unit symbol based on current preference */
  unitSymbol: string;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

const STORAGE_KEY = 'frostguard_units_preference';

/**
 * Convert Fahrenheit to Celsius
 */
function fahrenheitToCelsius(f: number): number {
  return (f - 32) * 5 / 9;
}

/**
 * Convert Celsius to Fahrenheit
 */
function celsiusToFahrenheit(c: number): number {
  return (c * 9 / 5) + 32;
}

export function UnitsProvider({ children }: { children: ReactNode }) {
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();

  // Initialize from localStorage for fast first paint
  const [units, setUnitsState] = useState<UnitsPreference>(() => {
    if (typeof window === 'undefined') return 'imperial';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'metric' || stored === 'imperial') return stored;
    return 'imperial';
  });

  const [isLoading, setIsLoading] = useState(true);

  // Load units preference from organization when org ID is available
  useEffect(() => {
    if (!isInitialized || !effectiveOrgId) {
      return;
    }

    const loadUnitsPreference = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('units_preference')
          .eq('id', effectiveOrgId)
          .maybeSingle();

        if (error) {
          console.error('[UnitsContext] Error loading units preference:', error);
          return;
        }

        if (data?.units_preference) {
          const pref = data.units_preference as UnitsPreference;
          if (pref === 'imperial' || pref === 'metric') {
            setUnitsState(pref);
            localStorage.setItem(STORAGE_KEY, pref);
          }
        }
      } catch (err) {
        console.error('[UnitsContext] Failed to load units preference:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUnitsPreference();
  }, [effectiveOrgId, isInitialized]);

  // Update units preference (persists to DB)
  const setUnits = useCallback(async (newUnits: UnitsPreference) => {
    if (!effectiveOrgId) {
      toast.error('Unable to save preference - no organization found');
      return;
    }

    // Optimistic update
    const previousUnits = units;
    setUnitsState(newUnits);
    localStorage.setItem(STORAGE_KEY, newUnits);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ units_preference: newUnits })
        .eq('id', effectiveOrgId);

      if (error) {
        // Rollback on error
        setUnitsState(previousUnits);
        localStorage.setItem(STORAGE_KEY, previousUnits);
        console.error('[UnitsContext] Failed to save units preference:', error);
        toast.error('Failed to save units preference');
        return;
      }

      toast.success(`Temperature units set to ${newUnits === 'imperial' ? 'Fahrenheit (°F)' : 'Celsius (°C)'}`);
    } catch (err) {
      // Rollback on error
      setUnitsState(previousUnits);
      localStorage.setItem(STORAGE_KEY, previousUnits);
      console.error('[UnitsContext] Failed to save units preference:', err);
      toast.error('Failed to save units preference');
    }
  }, [effectiveOrgId, units]);

  // Convert from canonical (°F) to display units
  const toDisplayTemp = useCallback((fahrenheit: number | null): number | null => {
    if (fahrenheit === null || fahrenheit === undefined) return null;
    if (units === 'imperial') return fahrenheit;
    return fahrenheitToCelsius(fahrenheit);
  }, [units]);

  // Convert from display units back to canonical (°F)
  const fromDisplayTemp = useCallback((displayValue: number | null): number | null => {
    if (displayValue === null || displayValue === undefined) return null;
    if (units === 'imperial') return displayValue;
    return celsiusToFahrenheit(displayValue);
  }, [units]);

  // Format a temperature for display
  const formatTemp = useCallback((fahrenheit: number | null, options?: FormatTempOptions): string => {
    const { decimals = 1, showUnit = true } = options || {};

    if (fahrenheit === null || fahrenheit === undefined) {
      return showUnit ? '--°' : '--';
    }

    const displayValue = units === 'imperial' ? fahrenheit : fahrenheitToCelsius(fahrenheit);
    const formatted = displayValue.toFixed(decimals);

    if (!showUnit) return formatted;
    return units === 'imperial' ? `${formatted}°F` : `${formatted}°C`;
  }, [units]);

  // Format temperature rate (for trends)
  const formatTempRate = useCallback((ratePerHour: number): string => {
    // Rate is already in the canonical unit (°F/hour)
    // For metric, we need to convert the rate as well
    const displayRate = units === 'imperial' ? ratePerHour : ratePerHour * 5 / 9;
    return `${Math.abs(displayRate).toFixed(1)}°/hour`;
  }, [units]);

  // Get the current unit symbol
  const unitSymbol = useMemo(() => {
    return units === 'imperial' ? '°F' : '°C';
  }, [units]);

  const contextValue: UnitsContextValue = useMemo(() => ({
    units,
    isLoading,
    setUnits,
    toDisplayTemp,
    fromDisplayTemp,
    formatTemp,
    formatTempRate,
    unitSymbol,
  }), [units, isLoading, setUnits, toDisplayTemp, fromDisplayTemp, formatTemp, formatTempRate, unitSymbol]);

  return (
    <UnitsContext.Provider value={contextValue}>
      {children}
    </UnitsContext.Provider>
  );
}

/**
 * Hook to access units context.
 * Must be used within a UnitsProvider.
 */
export function useUnits(): UnitsContextValue {
  const context = useContext(UnitsContext);
  if (!context) {
    throw new Error('useUnits must be used within a UnitsProvider');
  }
  return context;
}

/**
 * Safe version of useUnits that returns defaults if used outside the provider.
 * Use this for components that may render before providers are mounted.
 */
export function useUnitsSafe(): UnitsContextValue {
  const context = useContext(UnitsContext);

  // Return default imperial context if not within provider
  if (!context) {
    return {
      units: 'imperial',
      isLoading: false,
      setUnits: async () => {},
      toDisplayTemp: (f) => f,
      fromDisplayTemp: (d) => d,
      formatTemp: (f, opts) => {
        if (f === null || f === undefined) return opts?.showUnit !== false ? '--°' : '--';
        const formatted = f.toFixed(opts?.decimals ?? 1);
        return opts?.showUnit !== false ? `${formatted}°F` : formatted;
      },
      formatTempRate: (r) => `${Math.abs(r).toFixed(1)}°/hour`,
      unitSymbol: '°F',
    };
  }

  return context;
}
