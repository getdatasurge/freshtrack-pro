/**
 * Entity Dashboard Component
 * 
 * Main dashboard wrapper for unit/site customizable layouts.
 * Renders the customizable grid layout for both units and sites.
 */

import { useMemo, useState, useCallback } from "react";
import { subHours, subDays, parseISO } from "date-fns";
import { Undo2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayoutManager } from "../hooks/useLayoutManager";
import { useAutoSave } from "../hooks/useAutoSave";
import { LayoutSelector } from "./LayoutSelector";
import { LayoutManager } from "./LayoutManager";
import { CustomizeToggle } from "./CustomizeToggle";
import { GridCanvas } from "./GridCanvas";
import { HiddenWidgetsPanel } from "./HiddenWidgetsPanel";
import { TimelineControls } from "./TimelineControls";
import { AddWidgetModal } from "./AddWidgetModal";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";
import type { TimelineState, WidgetPosition } from "../types";
import type { EntityType } from "../hooks/useEntityLayoutStorage";

export interface EntityDashboardProps {
  entityType: EntityType;
  entityId: string;
  organizationId: string;
  unit?: {
    id: string;
    name: string;
    unit_type: string;
    temp_limit_high: number;
    temp_limit_low: number | null;
    last_temp_reading: number | null;
    last_reading_at: string | null;
  };
  sensor?: {
    id: string;
    name: string;
    last_seen_at: string | null;
    battery_level: number | null;
    signal_strength: number | null;
    status: string;
    sensor_type: string;
  };
  readings?: Array<{
    id: string;
    temperature: number;
    humidity: number | null;
    recorded_at: string;
  }>;
  derivedStatus?: {
    isOnline: boolean;
    statusLabel: string;
    statusColor: string;
    statusBgColor: string;
  };
  alerts?: Array<{
    id: string;
    type: string;
    severity: "critical" | "warning" | "info";
    title: string;
    message: string;
    clearCondition: string;
  }>;
  onLogTemp?: () => void;
  loraSensors?: Array<{
    id: string;
    name: string;
    battery_level: number | null;
    signal_strength: number | null;
    last_seen_at: string | null;
    status: string;
  }>;
  lastKnownGood?: {
    temp: number | null;
    at: string | null;
    source: "sensor" | "manual" | null;
  };
  site?: { id: string; name: string; organization_id: string };
  areas?: Array<{ id: string; name: string; unitsCount: number }>;
  totalUnits?: number;
}

function computeDateRange(state: TimelineState): { from: Date; to: Date } {
  const now = new Date();
  switch (state.range) {
    case "1h": return { from: subHours(now, 1), to: now };
    case "6h": return { from: subHours(now, 6), to: now };
    case "24h": return { from: subHours(now, 24), to: now };
    case "7d": return { from: subDays(now, 7), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
    case "custom":
      if (state.customFrom && state.customTo) {
        return { from: parseISO(state.customFrom), to: parseISO(state.customTo) };
      }
      return { from: subHours(now, 24), to: now };
    default: return { from: subHours(now, 24), to: now };
  }
}

export function EntityDashboard({
  entityType,
  entityId,
  organizationId,
  unit,
  sensor,
  readings = [],
  derivedStatus,
  alerts = [],
  onLogTemp,
  loraSensors = [],
  lastKnownGood,
  site,
  areas = [],
  totalUnits = 0,
}: EntityDashboardProps) {
  const { state, actions } = useLayoutManager(entityType, entityId, organizationId);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  
  const autoSave = useAutoSave(
    state.activeLayout,
    async () => { await actions.saveLayout(); },
    { enabled: !state.activeLayout.isDefault && !state.activeLayout.isImmutable, debounceMs: 2000 }
  );

  const dateRange = useMemo(() => computeDateRange(state.activeLayout.timelineState), [state.activeLayout.timelineState]);

  const handleUndo = useCallback(() => {
    const previousConfig = autoSave.undo();
    if (previousConfig) actions.updatePositions(previousConfig.widgets);
  }, [autoSave, actions]);

  const widgetProps = useMemo(() => {
    const allProps = {
      timelineState: state.activeLayout.timelineState,
      entityType,
      entityId,
      organizationId,
      sensor,
      unit,
      readings,
      derivedStatus,
      alerts,
      onLogTemp: onLogTemp || (() => {}),
      loraSensors,
      lastKnownGood,
      tempLimitHigh: unit?.temp_limit_high,
      tempLimitLow: unit?.temp_limit_low,
      temperature: unit?.last_temp_reading,
      lastReadingAt: unit?.last_reading_at,
      unitType: unit?.unit_type,
      count: readings.length,
      site,
      areas,
      totalUnits,
    };
    const result: Record<string, Record<string, unknown>> = {};
    state.activeLayout.config.widgets.forEach((w) => {
      result[w.i] = allProps as unknown as Record<string, unknown>;
    });
    return result;
  }, [entityType, entityId, organizationId, sensor, unit, readings, derivedStatus, alerts, onLogTemp, loraSensors, lastKnownGood, site, areas, totalUnits, state.activeLayout.timelineState, state.activeLayout.config.widgets]);

  const handleLayoutChange = useCallback((layout: WidgetPosition[]) => actions.updatePositions(layout), [actions]);
  const handleRestoreWidget = useCallback((widgetId: string) => actions.toggleWidgetVisibility(widgetId), [actions]);
  const handleRestoreAllWidgets = useCallback(() => {
    (state.activeLayout.config.hiddenWidgets || []).forEach(id => actions.toggleWidgetVisibility(id));
  }, [actions, state.activeLayout.config.hiddenWidgets]);

  const handleAddWidget = useCallback((widgetId: string) => {
    const maxY = state.activeLayout.config.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
    const widgetDef = WIDGET_REGISTRY[widgetId];
    if (!widgetDef) return;
    const newWidget: WidgetPosition = { i: widgetId, x: 0, y: maxY, w: widgetDef.defaultW, h: widgetDef.defaultH, minW: widgetDef.minW, minH: widgetDef.minH, maxW: widgetDef.maxW, maxH: widgetDef.maxH };
    const currentWidgets = state.activeLayout.config.widgets.filter(w => w.i !== widgetId);
    actions.updatePositions([...currentWidgets, newWidget]);
    if (state.activeLayout.config.hiddenWidgets?.includes(widgetId)) actions.toggleWidgetVisibility(widgetId);
    setAddWidgetOpen(false);
  }, [actions, state.activeLayout.config]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <LayoutSelector activeLayoutId={state.activeLayout.id} availableLayouts={state.availableLayouts} onSelect={actions.selectLayout} isDirty={state.isDirty} canCreateNew={state.canCreateNew} onCreateNew={() => actions.createNewLayout(`Layout ${state.layoutCount + 1}`)} layoutCount={state.layoutCount} />
        <div className="flex items-center gap-2">
          {autoSave.canUndo && <Button variant="ghost" size="sm" onClick={handleUndo} className="text-muted-foreground"><Undo2 className="w-4 h-4 mr-1" />Undo</Button>}
          {state.isCustomizing && !state.activeLayout.isDefault && <Button variant="outline" size="sm" onClick={() => setAddWidgetOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Widget</Button>}
          <CustomizeToggle isCustomizing={state.isCustomizing} onToggle={actions.setIsCustomizing} disabled={false} isDirty={state.isDirty} />
          <LayoutManager activeLayout={state.activeLayout} isDirty={state.isDirty} isSaving={state.isSaving || autoSave.isSaving} canCreateNew={state.canCreateNew} onSave={() => actions.saveLayout()} onRename={actions.renameLayout} onDelete={actions.deleteLayout} onSetDefault={actions.setAsUserDefault} onRevert={actions.revertToDefault} onDiscard={actions.discardChanges} onCreateFromDefault={actions.createNewLayout} />
        </div>
      </div>
      <TimelineControls state={state.activeLayout.timelineState} onChange={actions.updateTimelineState} isDefaultLayout={state.activeLayout.isDefault} dateRange={dateRange} isComparing={!!state.activeLayout.timelineState.compare} />
      {state.isCustomizing && <HiddenWidgetsPanel hiddenWidgetIds={state.activeLayout.config.hiddenWidgets || []} onRestore={handleRestoreWidget} onRestoreAll={handleRestoreAllWidgets} />}
      <GridCanvas layout={state.activeLayout.config} isCustomizing={state.isCustomizing} onLayoutChange={handleLayoutChange} widgetProps={widgetProps} onHideWidget={actions.toggleWidgetVisibility} />
      <AddWidgetModal open={addWidgetOpen} onOpenChange={setAddWidgetOpen} entityType={entityType} visibleWidgetIds={state.activeLayout.config.widgets.map(w => w.i)} hiddenWidgetIds={state.activeLayout.config.hiddenWidgets || []} onAddWidget={handleAddWidget} />
    </div>
  );
}
