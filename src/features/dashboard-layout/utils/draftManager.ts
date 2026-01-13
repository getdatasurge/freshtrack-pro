/**
 * Draft Manager Utility
 * 
 * Manages local draft persistence in localStorage for dashboard layouts.
 * Drafts persist across browser sessions with a 7-day TTL.
 */

import type { LayoutConfig, TimelineState, WidgetPreferences } from "../types";
import { LAYOUT_CONFIG_VERSION } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface DraftMetadata {
  version: 1;
  schemaVersion: number;
  entityType: "site" | "unit";
  entityId: string;
  layoutId: string;
  userId: string;
  updatedAt: string; // ISO timestamp
}

export interface DraftData {
  config: LayoutConfig;
  timelineState: TimelineState;
  widgetPrefs: WidgetPreferences;
}

export interface StoredDraft {
  meta: DraftMetadata;
  data: DraftData;
}

export interface DraftKeyParams {
  entityType: "site" | "unit";
  entityId: string;
  layoutId: string;
  userId: string;
}

// ============================================================================
// Constants
// ============================================================================

const DRAFT_KEY_PREFIX = "frostguard:layoutDraft:v1";
const DRAFT_TTL_DAYS = 7;
const DRAFT_CURRENT_VERSION = 1;

// ============================================================================
// Draft Manager
// ============================================================================

/**
 * Generate a deterministic key for storing drafts.
 */
export function getDraftKey(params: DraftKeyParams): string {
  const { entityType, entityId, layoutId, userId } = params;
  return `${DRAFT_KEY_PREFIX}:${entityType}:${entityId}:${layoutId}:${userId}`;
}

/**
 * Save a draft to localStorage.
 */
export function saveDraft(params: DraftKeyParams, data: DraftData): void {
  try {
    const key = getDraftKey(params);
    const draft: StoredDraft = {
      meta: {
        version: DRAFT_CURRENT_VERSION,
        schemaVersion: LAYOUT_CONFIG_VERSION,
        entityType: params.entityType,
        entityId: params.entityId,
        layoutId: params.layoutId,
        userId: params.userId,
        updatedAt: new Date().toISOString(),
      },
      data,
    };
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.warn("[DraftManager] Failed to save draft:", error);
  }
}

/**
 * Load a draft from localStorage.
 * Returns null if no draft exists, draft is expired, or schema version mismatch.
 */
export function loadDraft(params: DraftKeyParams): StoredDraft | null {
  try {
    const key = getDraftKey(params);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const draft = JSON.parse(stored) as StoredDraft;

    // Version check
    if (draft.meta.version !== DRAFT_CURRENT_VERSION) {
      console.warn("[DraftManager] Draft version mismatch, clearing");
      clearDraft(params);
      return null;
    }

    // Schema version check
    if (draft.meta.schemaVersion !== LAYOUT_CONFIG_VERSION) {
      console.warn("[DraftManager] Schema version mismatch, clearing draft");
      clearDraft(params);
      return null;
    }

    // TTL check
    const age = getDraftAgeDays(draft.meta.updatedAt);
    if (age !== null && age > DRAFT_TTL_DAYS) {
      console.info("[DraftManager] Draft expired, clearing");
      clearDraft(params);
      return null;
    }

    return draft;
  } catch (error) {
    console.warn("[DraftManager] Failed to load draft:", error);
    return null;
  }
}

/**
 * Clear a draft from localStorage.
 */
export function clearDraft(params: DraftKeyParams): void {
  try {
    const key = getDraftKey(params);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("[DraftManager] Failed to clear draft:", error);
  }
}

/**
 * Check if a draft exists in localStorage.
 */
export function hasDraft(params: DraftKeyParams): boolean {
  return loadDraft(params) !== null;
}

/**
 * Get the age of a draft in days.
 */
export function getDraftAgeDays(updatedAt: string): number | null {
  try {
    const updatedDate = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - updatedDate.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  } catch {
    return null;
  }
}

/**
 * Check if draft is newer than server's updatedAt timestamp.
 */
export function isDraftNewerThanServer(
  draft: StoredDraft,
  serverUpdatedAt: string | null
): boolean {
  if (!serverUpdatedAt) return true;
  
  try {
    const draftDate = new Date(draft.meta.updatedAt);
    const serverDate = new Date(serverUpdatedAt);
    return draftDate.getTime() > serverDate.getTime();
  } catch {
    return false;
  }
}

/**
 * Clean up all expired drafts from localStorage.
 * Call this on app initialization.
 */
export function cleanupExpiredDrafts(): void {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DRAFT_KEY_PREFIX)) continue;
      
      try {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        
        const draft = JSON.parse(stored) as StoredDraft;
        const age = getDraftAgeDays(draft.meta.updatedAt);
        
        if (age !== null && age > DRAFT_TTL_DAYS) {
          keysToRemove.push(key);
        }
      } catch {
        // Invalid draft, remove it
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.info(`[DraftManager] Cleaned up ${keysToRemove.length} expired drafts`);
    }
  } catch (error) {
    console.warn("[DraftManager] Failed to cleanup drafts:", error);
  }
}

/**
 * Get all draft keys for a specific entity (for debugging/listing).
 */
export function getDraftKeysForEntity(
  entityType: "site" | "unit",
  entityId: string
): string[] {
  const keys: string[] = [];
  const prefix = `${DRAFT_KEY_PREFIX}:${entityType}:${entityId}:`;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keys.push(key);
      }
    }
  } catch {
    // Ignore errors
  }
  
  return keys;
}

// Export all functions as a namespace for convenience
export const draftManager = {
  getDraftKey,
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  getDraftAgeDays,
  isDraftNewerThanServer,
  cleanupExpiredDrafts,
  getDraftKeysForEntity,
};
