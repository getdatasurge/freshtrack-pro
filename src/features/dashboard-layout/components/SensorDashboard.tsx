/**
 * Sensor Dashboard Component
 * 
 * Main dashboard wrapper for sensor-scoped customizable layouts.
 * Renders either the default static layout or a customizable grid layout.
 */

import { useMemo, useState, useCallback } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayoutManager } from "../hooks/useLayoutManager";
import { useAutoSave } from "../hooks/useAutoSave";
import { LayoutSelector } from "./LayoutSelector";
import { LayoutManager } from "./LayoutManager";
import { CustomizeToggle } from "./CustomizeToggle";
import { GridCanvas } from "./GridCanvas";
import { HiddenWidgetsPanel } from "./HiddenWidgetsPanel";
import { TimelineControls } from "./TimelineControls";
import type { TimelineState, WidgetPosition } from "../types";

// Props passed to widgets
export interface SensorDashboardProps {
  /** Primary sensor for this dashboard */
  sensor: {
    id: string;
    name: string;
    last_seen_at: string | null;
    battery_level: number | null;
    signal_strength: number | null;
    status: string;
    sensor_type: string;
  };
  /** Parent unit */
  unit: {
    id: string;
    name: string;
    unit_type: string;
    temp_limit_high: number;
    temp_limit_low: number | null;
    last_temp_reading: number | null;
    last_reading_at: string | null;
  };
  /** Organization ID for layout scoping */
  organizationId: string;
  /** Sensor readings for chart */
  readings: Array<{
    id: string;
    temperature: number;
    humidity: number | null;
    recorded_at: string;
  }>;
  /** Derived status from parent */
  derivedStatus: {
    isOnline: boolean;
    statusLabel: string;
    statusColor: string;
    statusBgColor: string;
  };
  /** Active alerts for the unit */
  alerts: Array<{
    id: string;
    type: string;
    severity: "critical" | "warning" | "info";
    title: string;
    message: string;
    clearCondition: string;
  }>;
  /** Callback when log temp is requested */
  onLogTemp: () => void;
  /** All LoRa sensors for the unit */
  loraSensors: Array<{
    id: string;
    name: string;
    battery_level: number | null;
    signal_strength: number | null;
    last_seen_at: string | null;
    status: string;
  }>;
  /** Last known good reading */
  lastKnownGood: {
    temp: number | null;
    at: string | null;
    source: "sensor" | "manual" | null;
  };
  /** Child components to render in static mode */
  children?: React.ReactNode;
}

export function SensorDashboard({
  sensor,
  unit,
  organizationId,
  readings,
  derivedStatus,
  alerts,
  onLogTemp,
  loraSensors,
  lastKnownGood,
  children,
}: SensorDashboardProps) {
  const { state, actions } = useLayoutManager(sensor.id, organizationId);
  const [newLayoutDialogOpen, setNewLayoutDialogOpen] = useState(false);
  
  // Auto-save hook
  const autoSave = useAutoSave(
    state.activeLayout,
    async () => {
      await actions.saveLayout();
    },
    { enabled: !state.activeLayout.isDefault && !state.activeLayout.isImmutable }
  );

  // Handle undo
  const handleUndo = useCallback(() => {
    const previousConfig = autoSave.undo();
    if (previousConfig) {
      actions.updatePositions(previousConfig.widgets);
    }
  }, [autoSave, actions]);

  // Build widget props for the grid - as Record<string, Record<string, unknown>>
  const widgetProps = useMemo(() => {
    const baseProps = {
      sensor,
      unit,
      readings,
      derivedStatus,
      alerts,
      onLogTemp,
      loraSensors,
      lastKnownGood,
      timelineState: state.activeLayout.timelineState,
      tempLimitHigh: unit.temp_limit_high,
      tempLimitLow: unit.temp_limit_low,
      temperature: unit.last_temp_reading,
      lastReadingAt: unit.last_reading_at,
      unitType: unit.unit_type,
      count: readings.length,
    };

    // Create per-widget props
    const result: Record<string, Record<string, unknown>> = {};
    state.activeLayout.config.widgets.forEach((w) => {
      result[w.i] = baseProps as unknown as Record<string, unknown>;
    });
    return result;
  }, [
    sensor,
    unit,
    readings,
    derivedStatus,
    alerts,
    onLogTemp,
    loraSensors,
    lastKnownGood,
    state.activeLayout.timelineState,
    state.activeLayout.config.widgets,
  ]);

  // Handle position changes from grid
  const handleLayoutChange = useCallback((layout: WidgetPosition[]) => {
    actions.updatePositions(layout);
  }, [actions]);

  // If in default mode and not customizing, render static layout (children)
  if (state.activeLayout.isDefault && !state.isCustomizing) {
    return (
      <div className="space-y-4">
        {/* Layout Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
          <LayoutSelector
            activeLayoutId={state.activeLayout.id}
            availableLayouts={state.availableLayouts}
            onSelect={actions.selectLayout}
            isDirty={state.isDirty}
            canCreateNew={state.canCreateNew}
            onCreateNew={() => setNewLayoutDialogOpen(true)}
            layoutCount={state.layoutCount}
          />
          <div className="flex items-center gap-2">
            <CustomizeToggle
              isCustomizing={state.isCustomizing}
              onToggle={actions.setIsCustomizing}
              disabled={false}
              isDirty={state.isDirty}
            />
          </div>
        </div>
        
        {/* Static Layout Content */}
        {children}
      </div>
    );
  }

  // Custom layout mode or customizing default
  return (
    <div className="space-y-4">
      {/* Layout Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <LayoutSelector
          activeLayoutId={state.activeLayout.id}
          availableLayouts={state.availableLayouts}
          onSelect={actions.selectLayout}
          isDirty={state.isDirty}
          canCreateNew={state.canCreateNew}
          onCreateNew={() => setNewLayoutDialogOpen(true)}
          layoutCount={state.layoutCount}
        />
        <div className="flex items-center gap-2">
          {/* Undo button */}
          {autoSave.canUndo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              className="text-muted-foreground"
            >
              <Undo2 className="w-4 h-4 mr-1" />
              Undo
            </Button>
          )}
          
          <CustomizeToggle
            isCustomizing={state.isCustomizing}
            onToggle={actions.setIsCustomizing}
            disabled={false}
            isDirty={state.isDirty}
          />
          
          <LayoutManager
            activeLayout={state.activeLayout}
            isDirty={state.isDirty}
            isSaving={state.isSaving || autoSave.isSaving}
            canCreateNew={state.canCreateNew}
            onSave={() => actions.saveLayout()}
            onRename={actions.renameLayout}
            onDelete={actions.deleteLayout}
            onSetDefault={actions.setAsUserDefault}
            onRevert={actions.revertToDefault}
            onDiscard={actions.discardChanges}
            onCreateNew={actions.createNewLayout}
            onStartCustomizing={() => actions.setIsCustomizing(true)}
          />
        </div>
      </div>

      {/* Timeline Controls */}
      <TimelineControls
        state={state.activeLayout.timelineState}
        onChange={actions.updateTimelineState}
      />

      {/* Hidden Widgets Panel (only in customize mode) */}
      {state.isCustomizing && (
        <HiddenWidgetsPanel
          hiddenWidgets={state.activeLayout.config.hiddenWidgets}
          onRestoreWidget={actions.toggleWidgetVisibility}
        />
      )}

      {/* Grid Canvas */}
      <GridCanvas
        layout={state.activeLayout.config}
        isCustomizing={state.isCustomizing}
        onLayoutChange={handleLayoutChange}
        widgetProps={widgetProps}
        onHideWidget={actions.toggleWidgetVisibility}
      />
    </div>
  );
}
