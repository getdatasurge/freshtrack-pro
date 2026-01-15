import { Link, useLocation, useParams } from "react-router-dom";
import { Plus, Layout, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LayoutSlot } from "@/hooks/useNavTree";

type EntityType = 'unit' | 'site';

interface LayoutLinksGroupProps {
  entityType: EntityType;
  entityId: string;
  layouts: LayoutSlot[];
  onCreateLayout: (slot: 1 | 2 | 3) => void;
  isCreating?: boolean;
}

/**
 * Renders layout links in the sidebar with these visibility rules:
 * - Default: always shown (static, cannot be deleted)
 * - "Create Layout 1": shown only when zero custom layouts exist
 * - Layout 1/2/3: shown only if they exist (no Create 2/3 CTAs in sidebar)
 */
export function LayoutLinksGroup({
  entityType,
  entityId,
  layouts,
  onCreateLayout,
  isCreating = false,
}: LayoutLinksGroupProps) {
  const location = useLocation();
  const params = useParams<{ unitId?: string; siteId?: string; layoutKey?: string }>();

  // Build URL for layout
  const buildUrl = (layout: string = 'default') => {
    const base = entityType === 'site' ? `/sites/${entityId}` : `/units/${entityId}`;
    return layout === 'default' ? base : `${base}/layout/${layout}`;
  };

  // Check if a layout is currently active
  const isLayoutActive = (layoutId: string | null, isDefault: boolean) => {
    const currentEntityId = entityType === 'site' ? params.siteId : params.unitId;
    if (currentEntityId !== entityId) return false;
    
    const currentLayoutKey = params.layoutKey || 'default';
    
    if (isDefault) {
      return currentLayoutKey === 'default';
    }
    
    return layoutId && currentLayoutKey === layoutId;
  };

  // Find layouts by slot
  const layout1 = layouts.find(l => l.slotNumber === 1);
  const layout2 = layouts.find(l => l.slotNumber === 2);
  const layout3 = layouts.find(l => l.slotNumber === 3);

  const linkBaseClass = "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors";
  const activeClass = "bg-accent text-accent-foreground font-medium";
  const inactiveClass = "text-muted-foreground hover:bg-accent/50 hover:text-foreground";

  return (
    <div className="flex flex-col gap-0.5 pl-4">
      {/* Default Layout - always shown */}
      <Link
        to={buildUrl('default')}
        className={cn(linkBaseClass, isLayoutActive(null, true) ? activeClass : inactiveClass)}
      >
        <Layout className="w-3.5 h-3.5" />
        <span>Default</span>
      </Link>

      {/* Layout 1 or Create CTA */}
      {layout1 ? (
        <Link
          to={buildUrl(layout1.layoutId!)}
          className={cn(linkBaseClass, isLayoutActive(layout1.layoutId, false) ? activeClass : inactiveClass)}
        >
          <Layout className="w-3.5 h-3.5" />
          <span className="truncate">{layout1.name}</span>
          {layout1.isUserDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500 ml-auto" />}
        </Link>
      ) : (
        <button
          onClick={() => onCreateLayout(1)}
          disabled={isCreating}
          className={cn(
            linkBaseClass,
            "text-muted-foreground hover:text-primary hover:bg-primary/5 cursor-pointer",
            isCreating && "opacity-50 cursor-not-allowed"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Layout 1</span>
        </button>
      )}

      {/* Layout 2 - only show if it exists (no Create CTA in sidebar) */}
      {layout2 && (
        <Link
          to={buildUrl(layout2.layoutId!)}
          className={cn(linkBaseClass, isLayoutActive(layout2.layoutId, false) ? activeClass : inactiveClass)}
        >
          <Layout className="w-3.5 h-3.5" />
          <span className="truncate">{layout2.name}</span>
          {layout2.isUserDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500 ml-auto" />}
        </Link>
      )}

      {/* Layout 3 - only show if it exists (no Create CTA in sidebar) */}
      {layout3 && (
        <Link
          to={buildUrl(layout3.layoutId!)}
          className={cn(linkBaseClass, isLayoutActive(layout3.layoutId, false) ? activeClass : inactiveClass)}
        >
          <Layout className="w-3.5 h-3.5" />
          <span className="truncate">{layout3.name}</span>
          {layout3.isUserDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500 ml-auto" />}
        </Link>
      )}
    </div>
  );
}
