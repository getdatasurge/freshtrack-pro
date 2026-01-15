/**
 * Draft Layout Hook
 * 
 * Manages local draft state for dashboard layouts.
 * Drafts persist in localStorage and survive browser refresh.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { LayoutConfig, TimelineState, WidgetPreferences } from "../types";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  isDraftNewerThanServer,
  cleanupExpiredDrafts,
  type DraftKeyParams,
  type StoredDraft,
  type DraftData,
} from "../utils/draftManager";

// ============================================================================
// Types
// ============================================================================

export interface DraftState {
  /** Whether a local draft exists */
  hasDraft: boolean;
  /** When the draft was last updated */
  draftUpdatedAt: Date | null;
  /** Whether the current UI state is from a draft (unsaved) */
  isUsingDraft: boolean;
  /** The loaded draft data (if any) */
  draftData: DraftData | null;
}

export interface DraftActions {
  /** Save current state as a local draft */
  saveDraftLocally: (config: LayoutConfig, timeline: TimelineState, prefs: WidgetPreferences) => void;
  /** Load draft from localStorage (called on mount) */
  loadDraftFromStorage: () => StoredDraft | null;
  /** Clear the local draft */
  clearLocalDraft: () => void;
  /** Apply draft data to the layout (mark as using draft) */
  applyDraft: () => DraftData | null;
  /** Discard draft and revert to server state */
  discardDraft: () => void;
}

export interface UseDraftLayoutResult {
  state: DraftState;
  actions: DraftActions;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useDraftLayout(
  entityType: "site" | "unit",
  entityId: string | undefined,
  layoutId: string,
  userId: string | undefined,
  serverUpdatedAt: string | null
): UseDraftLayoutResult {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<Date | null>(null);
  const [isUsingDraft, setIsUsingDraft] = useState(false);
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  
  // Track if we've initialized to avoid double-loading
  const initializedRef = useRef(false);
  
  // Create params object for draft manager
  const getParams = useCallback((): DraftKeyParams | null => {
    if (!entityId || !userId) return null;
    return { entityType, entityId, layoutId, userId };
  }, [entityType, entityId, layoutId, userId]);

  // Cleanup expired drafts on mount (once per app session)
  useEffect(() => {
    try {
      cleanupExpiredDrafts();
    } catch (error) {
      // localStorage might be disabled or full - fail silently
      if (process.env.NODE_ENV === "development") {
        console.warn("[useDraftLayout] Failed to cleanup expired drafts:", error);
      }
    }
  }, []);

  // Load draft on mount or when params change
  useEffect(() => {
    const params = getParams();
    if (!params) {
      setHasDraft(false);
      setDraftData(null);
      setDraftUpdatedAt(null);
      return;
    }

    const draft = loadDraft(params);
    if (draft && isDraftNewerThanServer(draft, serverUpdatedAt)) {
      setHasDraft(true);
      setDraftData(draft.data);
      setDraftUpdatedAt(new Date(draft.meta.updatedAt));
    } else {
      setHasDraft(false);
      setDraftData(null);
      setDraftUpdatedAt(null);
    }
  }, [getParams, serverUpdatedAt]);

  // Listen for storage events (multi-tab support)
  useEffect(() => {
    const params = getParams();
    if (!params) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key?.includes(entityId || "")) return;
      
      // Reload draft state when changed in another tab
      const draft = loadDraft(params);
      if (draft && isDraftNewerThanServer(draft, serverUpdatedAt)) {
        setHasDraft(true);
        setDraftData(draft.data);
        setDraftUpdatedAt(new Date(draft.meta.updatedAt));
      } else {
        setHasDraft(false);
        setDraftData(null);
        setDraftUpdatedAt(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [getParams, entityId, serverUpdatedAt]);

  // ============================================================================
  // Actions
  // ============================================================================

  const saveDraftLocally = useCallback(
    (config: LayoutConfig, timeline: TimelineState, prefs: WidgetPreferences) => {
      const params = getParams();
      if (!params) return;

      saveDraft(params, { config, timelineState: timeline, widgetPrefs: prefs });
      setHasDraft(true);
      setDraftUpdatedAt(new Date());
      setDraftData({ config, timelineState: timeline, widgetPrefs: prefs });
      setIsUsingDraft(true);
    },
    [getParams]
  );

  const loadDraftFromStorage = useCallback((): StoredDraft | null => {
    const params = getParams();
    if (!params) return null;
    return loadDraft(params);
  }, [getParams]);

  const clearLocalDraft = useCallback(() => {
    const params = getParams();
    if (!params) return;

    clearDraft(params);
    setHasDraft(false);
    setDraftData(null);
    setDraftUpdatedAt(null);
    setIsUsingDraft(false);
  }, [getParams]);

  const applyDraft = useCallback((): DraftData | null => {
    if (!draftData) return null;
    setIsUsingDraft(true);
    return draftData;
  }, [draftData]);

  const discardDraft = useCallback(() => {
    clearLocalDraft();
  }, [clearLocalDraft]);

  return {
    state: {
      hasDraft,
      draftUpdatedAt,
      isUsingDraft,
      draftData,
    },
    actions: {
      saveDraftLocally,
      loadDraftFromStorage,
      clearLocalDraft,
      applyDraft,
      discardDraft,
    },
  };
}
