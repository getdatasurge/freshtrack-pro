/**
 * Unsaved Changes Guard Hook
 * 
 * Prevents navigation when there are unsaved changes.
 * Shows a prompt with Save/Discard/Cancel options.
 */

import { useEffect, useCallback, useState } from "react";
import { useBlocker } from "react-router-dom";

// ============================================================================
// Types
// ============================================================================

export interface UnsavedChangesGuardResult {
  /** Whether to show the unsaved changes prompt */
  showPrompt: boolean;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Save changes and proceed with navigation */
  onSave: () => Promise<void>;
  /** Discard changes and proceed with navigation */
  onDiscard: () => void;
  /** Cancel navigation and stay on page */
  onCancel: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUnsavedChangesGuard(
  isDirty: boolean,
  onSave: () => Promise<void>,
  onDiscard: () => void
): UnsavedChangesGuardResult {
  const [isSaving, setIsSaving] = useState(false);
  
  // React Router blocker for in-app navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Browser beforeunload handler for tab close/refresh
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Modern browsers ignore custom messages, but we still need to set returnValue
      return "You have unsaved changes. Are you sure you want to leave?";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Handle Save action
  const handleSave = useCallback(async () => {
    if (blocker.state !== "blocked") return;
    
    try {
      setIsSaving(true);
      await onSave();
      blocker.proceed?.();
    } catch (error) {
      console.error("[UnsavedChangesGuard] Save failed:", error);
      // Don't proceed on error - let user retry or discard
    } finally {
      setIsSaving(false);
    }
  }, [blocker, onSave]);

  // Handle Discard action
  const handleDiscard = useCallback(() => {
    if (blocker.state !== "blocked") return;
    
    onDiscard();
    blocker.proceed?.();
  }, [blocker, onDiscard]);

  // Handle Cancel action
  const handleCancel = useCallback(() => {
    if (blocker.state !== "blocked") return;
    
    blocker.reset?.();
  }, [blocker]);

  return {
    showPrompt: blocker.state === "blocked",
    isSaving,
    onSave: handleSave,
    onDiscard: handleDiscard,
    onCancel: handleCancel,
  };
}
