/**
 * Unit Comparison Widget
 * 
 * Allows selecting 2-4 units to compare key metrics side-by-side.
 * Persists selection in widget preferences.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BarChart3, Plus, X, Check, Thermometer, Clock, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import type { WidgetProps } from "../types";

interface ComparisonUnit {
  id: string;
  name: string;
  last_temp_reading: number | null;
  temp_limit_high: number;
  temp_limit_low: number | null;
  last_reading_at: string | null;
  area_name?: string;
}

const MAX_COMPARE_UNITS = 4;

export function UnitComparisonWidget({ site, preferences, onPreferencesChange }: WidgetProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  
  // Get selected unit IDs from preferences
  const selectedIds: string[] = useMemo(() => {
    return (preferences?.settings?.selectedUnitIds as string[]) ?? [];
  }, [preferences]);

  // Fetch all units for the site
  const { data: allUnits, isLoading: unitsLoading } = useQuery({
    queryKey: ["site-units-comparison", site?.id],
    queryFn: async () => {
      if (!site?.id) return [];

      const { data: areas } = await supabase
        .from("areas")
        .select("id, name")
        .eq("site_id", site.id)
        .is("deleted_at", null);

      if (!areas || areas.length === 0) return [];

      const areaIds = areas.map((a) => a.id);
      const areaMap = Object.fromEntries(areas.map((a) => [a.id, a.name]));

      const { data: unitsData, error } = await supabase
        .from("units")
        .select("id, name, area_id, last_temp_reading, temp_limit_high, temp_limit_low, last_reading_at")
        .in("area_id", areaIds)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      
      return (unitsData ?? []).map((u) => ({
        ...u,
        area_name: areaMap[u.area_id!] || "",
      }));
    },
    enabled: !!site?.id,
    staleTime: 60000,
  });

  // Get selected units with full data
  const selectedUnits = useMemo(() => {
    if (!allUnits) return [];
    return selectedIds
      .map((id) => allUnits.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => u !== undefined);
  }, [allUnits, selectedIds]);

  // Units available to add
  const availableUnits = useMemo(() => {
    if (!allUnits) return [];
    return allUnits.filter((u) => !selectedIds.includes(u.id));
  }, [allUnits, selectedIds]);

  // Handle adding a unit
  const handleAddUnit = (unitId: string) => {
    if (selectedIds.length >= MAX_COMPARE_UNITS) return;
    const newIds = [...selectedIds, unitId];
    onPreferencesChange?.({
      ...preferences,
      settings: { ...preferences?.settings, selectedUnitIds: newIds },
    });
    setSelectorOpen(false);
  };

  // Handle removing a unit
  const handleRemoveUnit = (unitId: string) => {
    const newIds = selectedIds.filter((id) => id !== unitId);
    onPreferencesChange?.({
      ...preferences,
      settings: { ...preferences?.settings, selectedUnitIds: newIds },
    });
  };

  // Get status for a unit
  const getUnitStatus = (unit: ComparisonUnit) => {
    const now = Date.now();
    const offlineThresholdMs = 2 * 60 * 60 * 1000;
    const lastReadingTime = unit.last_reading_at ? new Date(unit.last_reading_at).getTime() : 0;
    const isOffline = !unit.last_reading_at || (now - lastReadingTime > offlineThresholdMs);

    if (isOffline) return { label: "Offline", color: "bg-gray-500", icon: WifiOff };
    
    if (unit.last_temp_reading !== null) {
      const temp = unit.last_temp_reading;
      const high = unit.temp_limit_high;
      const low = unit.temp_limit_low ?? -Infinity;
      
      if (temp > high || temp < low) {
        return { label: "Critical", color: "bg-red-500", icon: AlertTriangle };
      }
      if (temp > high - 2 || temp < low + 2) {
        return { label: "Warning", color: "bg-yellow-500", icon: AlertTriangle };
      }
    }
    
    return { label: "OK", color: "bg-green-500", icon: Wifi };
  };

  if (unitsLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Unit Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Unit Comparison
          </CardTitle>
          {selectedIds.length < MAX_COMPARE_UNITS && availableUnits.length > 0 && (
            <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Unit
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search units..." />
                  <CommandList>
                    <CommandEmpty>No units found.</CommandEmpty>
                    <CommandGroup>
                      {availableUnits.map((unit) => (
                        <CommandItem
                          key={unit.id}
                          value={unit.name}
                          onSelect={() => handleAddUnit(unit.id)}
                        >
                          <Check className="mr-2 h-4 w-4 opacity-0" />
                          <div className="flex flex-col">
                            <span>{unit.name}</span>
                            {unit.area_name && (
                              <span className="text-xs text-muted-foreground">{unit.area_name}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {selectedUnits.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No units selected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add up to {MAX_COMPARE_UNITS} units to compare
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-2 gap-3 pr-4">
              {selectedUnits.map((unit) => {
                const status = getUnitStatus(unit);
                const StatusIcon = status.icon;
                
                return (
                  <div 
                    key={unit.id}
                    className="p-3 rounded-lg border bg-card relative group"
                  >
                    <button
                      onClick={() => handleRemoveUnit(unit.id)}
                      className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    
                    <div className="flex items-start justify-between mb-2">
                      <div className="pr-4">
                        <p className="text-sm font-medium truncate">{unit.name}</p>
                        {unit.area_name && (
                          <p className="text-xs text-muted-foreground truncate">{unit.area_name}</p>
                        )}
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${status.color} text-white text-xs shrink-0`}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Thermometer className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {unit.last_temp_reading !== null 
                            ? `${unit.last_temp_reading.toFixed(1)}°` 
                            : "—"
                          }
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({unit.temp_limit_low ?? "—"}° to {unit.temp_limit_high}°)
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {unit.last_reading_at 
                          ? formatDistanceToNow(new Date(unit.last_reading_at), { addSuffix: true })
                          : "Never"
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
