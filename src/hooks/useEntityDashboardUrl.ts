import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCallback } from "react";

export type EntityType = 'unit' | 'site';

/**
 * Hook for managing entity dashboard URL state.
 * Handles nested routes: /units/:unitId/layout/:layoutKey or /sites/:siteId/layout/:layoutKey
 */
export function useEntityDashboardUrl() {
  const params = useParams<{ unitId?: string; siteId?: string; layoutKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine entity type based on current route
  const entityType: EntityType = location.pathname.startsWith('/sites') ? 'site' : 'unit';
  const entityId = entityType === 'site' ? params.siteId : params.unitId;
  const layoutKey = params.layoutKey || 'default';

  /**
   * Navigate to a specific entity's layout dashboard
   */
  const navigateToLayout = useCallback(
    (type: EntityType, id: string, layout: string = 'default') => {
      const base = type === 'site' ? `/sites/${id}` : `/units/${id}`;
      navigate(layout === 'default' ? base : `${base}/layout/${layout}`);
    },
    [navigate]
  );

  /**
   * Update layout selection without changing entity
   */
  const setLayoutKey = useCallback(
    (layout: string) => {
      if (!entityId) return;
      const base = entityType === 'site' ? `/sites/${entityId}` : `/units/${entityId}`;
      navigate(layout === 'default' ? base : `${base}/layout/${layout}`, { replace: true });
    },
    [entityType, entityId, navigate]
  );

  /**
   * Build URL for an entity layout (for NavLink href)
   */
  const buildLayoutUrl = useCallback(
    (type: EntityType, id: string, layout: string = 'default') => {
      const base = type === 'site' ? `/sites/${id}` : `/units/${id}`;
      return layout === 'default' ? base : `${base}/layout/${layout}`;
    },
    []
  );

  /**
   * Check if a given entity/layout combo is currently active
   */
  const isActive = useCallback(
    (type: EntityType, id: string, layout: string = 'default') => {
      if (entityType !== type) return false;
      if (entityId !== id) return false;
      return layoutKey === layout;
    },
    [entityType, entityId, layoutKey]
  );

  return {
    entityType,
    entityId,
    layoutKey,
    navigateToLayout,
    setLayoutKey,
    buildLayoutUrl,
    isActive,
  };
}
