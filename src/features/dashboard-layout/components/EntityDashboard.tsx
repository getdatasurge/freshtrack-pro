/**
 * Entity Dashboard Component
 * 
 * Main dashboard wrapper for unit/site customizable layouts.
 * Renders the customizable grid layout for both units and sites.
 */

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { subHours, subDays, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useLayoutManager } from "../hooks/useLayoutManager";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import { useLayoutValidation } from "../hooks/useLayoutValidation";
import { LayoutSelector } from "./LayoutSelector";
import { LayoutManager } from "./LayoutManager";
import { CustomizeToggle } from "./CustomizeToggle";
import { GridCanvas } from "./GridCanvas";
import { HiddenWidgetsPanel } from "./HiddenWidgetsPanel";
import { TimelineControls } from "./TimelineControls";
import { AddWidgetModal } from "./AddWidgetModal";
import { DashboardErrorBoundary } from "./DashboardErrorBoundary";
import { LayoutValidationBanner } from "./LayoutValidationBanner";
import { PreviewModeSelector } from "./PreviewModeSelector";
import { WIDGET_REGISTRY } from "../registry/widgetRegistry";
import { generatePreviewMockProps } from "../utils/previewMockData";
import type { TimelineState, WidgetPosition, PreviewMode } from "../types";
import type { EntityType } from "../hooks/useEntityLayoutStorage";

export interface EntityDashboardProps {
  entityType: EntityType;
  entityId: string;
  organizationId: string;
  siteId?: string;
  userId?: string;
  unit?: {
    id: string;
    name: string;
    unit_type: string;
    temp_limit_high: number;
    temp_limit_low: number | null;
    last_temp_reading: number | null;
    last_reading_at: string | null;
    door_state?: "open" | "closed" | "unknown" | null;
    door_last_changed_at?: string | null;
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
  site?: { 
    id: string; 
    name: string; 
    organization_id: string;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string;
  };
  areas?: Array<{ id: string; name: string; unitsCount: number }>;
  totalUnits?: number;
  /** Callback to refetch site data after location changes */
  onSiteLocationChange?: () => void;
  /** Refresh tick counter - increments on realtime events to trigger widget re-fetches */
  refreshTick?: number;
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
  siteId,
  userId,
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
  onSiteLocationChange,
  refreshTick,
}: EntityDashboardProps) {
  const DEV = import.meta.env.DEV;
  
  // DEV LOG: Confirm when EntityDashboard re-renders with unit changes
  DEV && console.log(
    `[EntityDashboard] render unit door_state=${unit?.door_state} last_reading_at=${unit?.last_reading_at} last_temp_reading=${unit?.last_temp_reading}`
  );

  const { state, actions } = useLayoutManager(entityType, entityId, organizationId, userId);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [recentlyAddedWidgetId, setRecentlyAddedWidgetId] = useState<string | null>(null);
  const [createLayoutPromptOpen, setCreateLayoutPromptOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("live");
  
  // Validation for current layout
  const validation = useLayoutValidation(
    state.activeLayout.config,
    entityType,
    {
      hasSensor: !!sensor,
      sensorType: sensor?.sensor_type,
      hasLocationConfigured: !!(site?.latitude && site?.longitude),
    }
  );
  
  // Derived flags for "Add Widget" CTA on Default layout
  const isDefaultLayout = state.activeLayout.isDefault;
  const hasAnyCustomLayouts = state.layoutCount > 0;
  
  // Measure container width for the grid
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Callback to clear recently added widget ID after handling
  const handleClearRecentlyAdded = useCallback(() => {
    setRecentlyAddedWidgetId(null);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Navigation guard for unsaved changes
  const unsavedGuard = useUnsavedChangesGuard(
    state.isDirty && !state.activeLayout.isDefault,
    async () => { await actions.saveLayout(); },
    actions.discardChanges
  );

  const dateRange = useMemo(() => computeDateRange(state.activeLayout.timelineState), [state.activeLayout.timelineState]);

  const widgetProps = useMemo(() => {
    const allProps = {
      timelineState: state.activeLayout.timelineState,
      entityType,
      entityId,
      organizationId,
      siteId,
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
      recentlyAddedWidgetId,
      onClearRecentlyAdded: handleClearRecentlyAdded,
      onSiteLocationChange,
      refreshTick,
    };

    // STEP 4: EntityDashboard widgetProps debug logging
    DEV && console.log('[EntityDashboard.widgetProps]', {
      entityType,
      entityId,
      organizationId,
      siteId,
      door_state: unit?.door_state,
      door_last_changed_at: unit?.door_last_changed_at,
      readingsCount: readings?.length,
      loraSensorsCount: loraSensors?.length,
    });

    const result: Record<string, Record<string, unknown>> = {};
    state.activeLayout.config.widgets.forEach((w) => {
      result[w.i] = allProps as unknown as Record<string, unknown>;
    });
    return result;
  }, [entityType, entityId, organizationId, siteId, sensor, unit, readings, derivedStatus, alerts, onLogTemp, loraSensors, lastKnownGood, site, areas, totalUnits, state.activeLayout.timelineState, state.activeLayout.config.widgets, recentlyAddedWidgetId, handleClearRecentlyAdded, onSiteLocationChange, refreshTick]);

  // Apply preview mode mock data when not in live mode
  const effectiveWidgetProps = useMemo(() => {
    if (previewMode === "live") return widgetProps;
    return generatePreviewMockProps(previewMode, widgetProps, { unit, sensor, site });
  }, [previewMode, widgetProps, unit, sensor, site]);

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
    setRecentlyAddedWidgetId(widgetId); // Track the just-added widget for auto-prompt flows
    setAddWidgetOpen(false);
  }, [actions, state.activeLayout.config]);

  const handleSave = useCallback(async () => {
    // Block save if there are validation errors
    if (validation.hasErrors) {
      toast.error("Cannot save layout with errors. Please fix the issues first.");
      return;
    }
    await actions.saveLayout();
  }, [actions, validation.hasErrors]);

  const handleDiscard = useCallback(() => {
    actions.discardChanges();
  }, [actions]);

  // Handler for creating first layout from the Default layout prompt
  const handleCreateFirstLayout = useCallback(async () => {
    try {
      await actions.createNewLayout("My Layout");
      setCreateLayoutPromptOpen(false);
      // Layout manager automatically switches to the new layout
    } catch (error) {
      console.error("Failed to create layout:", error);
      toast.error("Failed to create layout");
    }
  }, [actions]);

  return (
    <DashboardErrorBoundary
      entityType={entityType}
      entityId={entityId}
      userId={userId}
    >
    <div className="space-y-4">

      {/* Draft Recovery Banner */}
      {state.hasDraft && !state.isDirty && !state.activeLayout.isDefault && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              You have a saved draft from a previous session
            </span>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={actions.clearLocalDraft}
                className="text-blue-800 hover:text-blue-900 dark:text-blue-200"
              >
                Discard Draft
              </Button>
              <Button 
                size="sm" 
                onClick={actions.applyDraft}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Restore Draft
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <LayoutSelector 
          activeLayoutId={state.activeLayout.id} 
          availableLayouts={state.availableLayouts} 
          onSelect={actions.selectLayout} 
          isDirty={state.isDirty} 
          canCreateNew={state.canCreateNew} 
          onCreateNew={() => actions.createNewLayout(`Layout ${state.layoutCount + 1}`)} 
          layoutCount={state.layoutCount} 
        />
        <div className="flex items-center gap-2">
          {/* Normal Add Widget button for custom layouts in customize mode */}
          {state.isCustomizing && !isDefaultLayout && (
            <Button variant="outline" size="sm" onClick={() => setAddWidgetOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />Add Widget
            </Button>
          )}
          
          {/* Add Widget CTA on Default layout ONLY when no custom layouts exist */}
          {isDefaultLayout && !hasAnyCustomLayouts && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCreateLayoutPromptOpen(true)}
                    disabled={!state.canCreateNew}
                  >
                    <Plus className="w-4 h-4 mr-1" />Add Widget
                  </Button>
                </TooltipTrigger>
                {!state.canCreateNew && (
                  <TooltipContent>
                    Unable to create layouts. Contact your administrator.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
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
            isSaving={state.isSaving} 
            canCreateNew={state.canCreateNew} 
            onSave={() => actions.saveLayout()} 
            onRename={actions.renameLayout} 
            onDelete={actions.deleteLayout} 
            onSetDefault={actions.setAsUserDefault} 
            onRevert={actions.revertToDefault} 
            onDiscard={actions.discardChanges} 
            onCreateFromDefault={actions.createNewLayout} 
          />
        </div>
      </div>
      <TimelineControls 
        state={state.activeLayout.timelineState} 
        onChange={actions.updateTimelineState} 
        isDefaultLayout={state.activeLayout.isDefault} 
        dateRange={dateRange} 
        isComparing={!!state.activeLayout.timelineState.compare}
        saveStatus={state.isSaving ? 'saving' : state.isDirty ? 'dirty' : 'saved'}
      />
      {/* Validation Banner (only in customize mode) */}
      {state.isCustomizing && validation.issues.length > 0 && (
        <LayoutValidationBanner validation={validation} />
      )}
      
      {/* Preview Mode and Hidden Widgets (only in customize mode) */}
      {state.isCustomizing && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <PreviewModeSelector value={previewMode} onChange={setPreviewMode} />
          <HiddenWidgetsPanel 
            hiddenWidgetIds={state.activeLayout.config.hiddenWidgets || []} 
            onRestore={handleRestoreWidget} 
            onRestoreAll={handleRestoreAllWidgets} 
          />
        </div>
      )}
      <div ref={containerRef} className="w-full">
        {containerWidth > 0 && (
          <GridCanvas 
            layout={state.activeLayout.config} 
            isCustomizing={state.isCustomizing} 
            onLayoutChange={handleLayoutChange} 
            widgetProps={effectiveWidgetProps} 
            onHideWidget={actions.toggleWidgetVisibility}
            containerWidth={containerWidth}
          />
        )}
      </div>
      <AddWidgetModal 
        open={addWidgetOpen} 
        onOpenChange={setAddWidgetOpen} 
        entityType={entityType} 
        visibleWidgetIds={state.activeLayout.config.widgets.map(w => w.i)} 
        hiddenWidgetIds={state.activeLayout.config.hiddenWidgets || []} 
        onAddWidget={handleAddWidget} 
      />

      {/* Navigation Guard Dialog */}
      <AlertDialog open={unsavedGuard.showPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save before leaving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this layout. Would you like to save them before navigating away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={unsavedGuard.onCancel}>
              Cancel
            </AlertDialogCancel>
            <Button 
              variant="outline" 
              onClick={unsavedGuard.onDiscard}
            >
              Discard
            </Button>
            <AlertDialogAction 
              onClick={unsavedGuard.onSave}
              disabled={unsavedGuard.isSaving}
            >
              {unsavedGuard.isSaving ? "Saving..." : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Layout Prompt Modal (shown when clicking Add Widget on Default with no custom layouts) */}
      <Dialog open={createLayoutPromptOpen} onOpenChange={setCreateLayoutPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Your First Layout</DialogTitle>
            <DialogDescription>
              Widgets can only be added to custom layouts. Create a layout to start customizing your dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCreateLayoutPromptOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFirstLayout}>
              Create Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardErrorBoundary>
  );
}
