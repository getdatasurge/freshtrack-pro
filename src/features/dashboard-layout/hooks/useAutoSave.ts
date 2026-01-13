/**
 * Auto-save Hook for Dashboard Layouts
 * 
 * Provides debounced auto-save with undo functionality.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { LayoutConfig, ActiveLayout } from "../types";
import { cloneLayoutConfig, areLayoutConfigsEqual } from "../utils/layoutTransforms";
import { toast } from "sonner";

interface AutoSaveState {
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Whether undo is available */
  canUndo: boolean;
  /** Last save timestamp */
  lastSavedAt: Date | null;
}

interface UseAutoSaveOptions {
  /** Debounce delay in milliseconds (default: 1500) */
  debounceMs?: number;
  /** Maximum undo stack size (default: 10) */
  maxUndoStack?: number;
  /** Whether auto-save is enabled */
  enabled?: boolean;
}

export function useAutoSave(
  activeLayout: ActiveLayout,
  saveLayout: () => Promise<unknown>,
  options: UseAutoSaveOptions = {}
): AutoSaveState & { undo: () => LayoutConfig | null; pushUndo: (config: LayoutConfig) => void } {
  const {
    debounceMs = 1500,
    maxUndoStack = 10,
    enabled = true,
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [undoStack, setUndoStack] = useState<LayoutConfig[]>([]);
  
  // Track the last saved config to avoid unnecessary saves
  const lastSavedConfig = useRef<LayoutConfig | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save effect - debounced
  useEffect(() => {
    // Skip if disabled, is default layout, or no changes
    if (!enabled || activeLayout.isDefault || !activeLayout.id) {
      return;
    }

    // Skip if config matches last saved
    if (lastSavedConfig.current && areLayoutConfigsEqual(activeLayout.config, lastSavedConfig.current)) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        
        // Push current state to undo stack before saving
        if (lastSavedConfig.current) {
          setUndoStack((prev) => {
            const newStack = [...prev, cloneLayoutConfig(lastSavedConfig.current!)];
            return newStack.slice(-maxUndoStack);
          });
        }
        
        await saveLayout();
        lastSavedConfig.current = cloneLayoutConfig(activeLayout.config);
        setLastSavedAt(new Date());
        
        // Show subtle indicator
        toast.success("Layout saved", { duration: 1500 });
      } catch (error) {
        console.error("[useAutoSave] Save failed:", error);
        toast.error("Failed to auto-save layout");
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeLayout.config, activeLayout.isDefault, activeLayout.id, enabled, debounceMs, saveLayout, maxUndoStack]);

  // Undo function - returns the previous config or null
  const undo = useCallback((): LayoutConfig | null => {
    if (undoStack.length === 0) return null;
    
    const lastConfig = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    
    // Update lastSavedConfig to the restored state
    lastSavedConfig.current = cloneLayoutConfig(lastConfig);
    
    return lastConfig;
  }, [undoStack]);

  // Manually push to undo stack (for external state management)
  const pushUndo = useCallback((config: LayoutConfig) => {
    setUndoStack((prev) => {
      const newStack = [...prev, cloneLayoutConfig(config)];
      return newStack.slice(-maxUndoStack);
    });
  }, [maxUndoStack]);

  return {
    isSaving,
    canUndo: undoStack.length > 0,
    lastSavedAt,
    undo,
    pushUndo,
  };
}
