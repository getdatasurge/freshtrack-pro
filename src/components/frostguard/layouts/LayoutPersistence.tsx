import * as React from 'react';
import type { WidgetPlacement } from '../registry/widgetFactory';
import type { AppTarget } from '../registry/widgetRegistry';
import type { SavedLayout } from './LayoutManager';

// ============================================================================
// Layout Persistence Layer
// Abstracts save/load operations for widget layouts.
// Designed to work with Supabase but can be swapped for any backend.
// ============================================================================

export interface LayoutStore {
  /** Load all layouts for the current user/scope */
  loadLayouts: () => Promise<SavedLayout[]>;
  /** Load a single layout by ID */
  loadLayout: (id: string) => Promise<SavedLayout | null>;
  /** Save (create or update) a layout */
  saveLayout: (layout: SavedLayout) => Promise<SavedLayout>;
  /** Delete a layout */
  deleteLayout: (id: string) => Promise<void>;
  /** Load default layout for an equipment type (from admin-designed defaults) */
  loadDefaultLayout: (equipmentType: string) => Promise<SavedLayout | null>;
}

/**
 * Supabase-backed layout store.
 * Tables:
 * - dashboard_layouts: per-user saved layouts
 * - default_widget_layouts: admin-designed defaults per equipment type
 */
export function createSupabaseLayoutStore(supabase: {
  from: (table: string) => {
    select: (cols?: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: unknown; error: unknown }> }; order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown[]; error: unknown }> };
    upsert: (data: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: unknown }> } };
    delete: () => { eq: (col: string, val: string) => Promise<{ error: unknown }> };
  };
}): LayoutStore {
  return {
    async loadLayouts() {
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapRowToLayout);
    },

    async loadLayout(id: string) {
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return null;
      return data ? mapRowToLayout(data) : null;
    },

    async saveLayout(layout: SavedLayout) {
      const row = mapLayoutToRow(layout);
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .upsert(row)
        .select()
        .single();

      if (error) throw error;
      return mapRowToLayout(data);
    },

    async deleteLayout(id: string) {
      const { error } = await supabase
        .from('dashboard_layouts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    async loadDefaultLayout(equipmentType: string) {
      const { data, error } = await supabase
        .from('default_widget_layouts')
        .select('*')
        .eq('equipment_type', equipmentType)
        .single();

      if (error) return null;
      return data ? mapRowToLayout(data) : null;
    },
  };
}

// Row <-> Layout mapping helpers
function mapRowToLayout(row: any): SavedLayout {
  return {
    id: row.id,
    name: row.name,
    equipmentType: row.equipment_type,
    appTarget: row.app_target || 'customer',
    placements: typeof row.placements === 'string' ? JSON.parse(row.placements) : (row.placements || []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLayoutToRow(layout: SavedLayout): Record<string, unknown> {
  return {
    id: layout.id,
    name: layout.name,
    equipment_type: layout.equipmentType,
    app_target: layout.appTarget,
    placements: JSON.stringify(layout.placements),
    updated_at: layout.updatedAt,
  };
}

// ============================================================================
// React Hook for layout persistence
// ============================================================================

export interface UseLayoutPersistenceOptions {
  store: LayoutStore;
  equipmentType?: string;
}

export interface UseLayoutPersistenceReturn {
  layouts: SavedLayout[];
  loading: boolean;
  error: string | null;
  saveLayout: (layout: SavedLayout) => Promise<void>;
  deleteLayout: (id: string) => Promise<void>;
  loadDefaultLayout: (equipmentType: string) => Promise<SavedLayout | null>;
  refresh: () => Promise<void>;
}

export function useLayoutPersistence({
  store,
  equipmentType,
}: UseLayoutPersistenceOptions): UseLayoutPersistenceReturn {
  const [layouts, setLayouts] = React.useState<SavedLayout[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await store.loadLayouts();
      setLayouts(loaded);
    } catch (err: any) {
      setError(err?.message || 'Failed to load layouts');
    } finally {
      setLoading(false);
    }
  }, [store]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const saveLayout = React.useCallback(
    async (layout: SavedLayout) => {
      try {
        const saved = await store.saveLayout(layout);
        setLayouts((prev) => {
          const idx = prev.findIndex((l) => l.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to save layout');
        throw err;
      }
    },
    [store],
  );

  const deleteLayout = React.useCallback(
    async (id: string) => {
      try {
        await store.deleteLayout(id);
        setLayouts((prev) => prev.filter((l) => l.id !== id));
      } catch (err: any) {
        setError(err?.message || 'Failed to delete layout');
        throw err;
      }
    },
    [store],
  );

  const loadDefaultLayout = React.useCallback(
    async (eqType: string) => {
      try {
        return await store.loadDefaultLayout(eqType);
      } catch {
        return null;
      }
    },
    [store],
  );

  return { layouts, loading, error, saveLayout, deleteLayout, loadDefaultLayout, refresh };
}
