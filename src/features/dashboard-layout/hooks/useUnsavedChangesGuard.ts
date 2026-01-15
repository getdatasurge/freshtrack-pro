/**
 * Unsaved Changes Guard Hook
 * 
 * Prevents navigation when there are unsaved changes.
 * Shows a prompt with Save/Discard/Cancel options.
 * 
 * NOTE: useBlocker from react-router-dom requires a Data Router (createBrowserRouter).
 * Since this app uses BrowserRouter, we disable in-app navigation blocking.
 * Browser tab close/refresh protection still works via beforeunload.
 */

import { useEffect, useCallback, useState } from "react";

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
  
  // NOTE: useBlocker requires Data Router (createBrowserRouter + RouterProvider).
  // This app uses BrowserRouter, so in-app navigation blocking is disabled.
  // Browser beforeunload protection still works below.
  // TODO: Migrate App.tsx to createBrowserRouter to re-enable useBlocker.
  const blockerState = "unblocked" as const;

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

  // Handle Save action (no-op since blocker is disabled)
  const handleSave = useCallback(async () => {
    // Blocker disabled - this won't be called from the dialog
    try {
      setIsSaving(true);
      await onSave();
    } catch (error) {
      console.error("[UnsavedChangesGuard] Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  // Handle Discard action (no-op since blocker is disabled)
  const handleDiscard = useCallback(() => {
    onDiscard();
  }, [onDiscard]);

  // Handle Cancel action (no-op since blocker is disabled)
  const handleCancel = useCallback(() => {
    // No-op - blocker disabled
  }, []);

  // Note: showPrompt will always be false until we migrate to Data Router
  // This is intentional - useBlocker requires createBrowserRouter
  return {
    showPrompt: false,
    isSaving,
    onSave: handleSave,
    onDiscard: handleDiscard,
    onCancel: handleCancel,
  };
}
