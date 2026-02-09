import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { LayoutManager, type SavedLayout } from "@/components/frostguard/layouts/LayoutManager";

/**
 * Admin page for managing default widget layouts per equipment type.
 * Layouts saved here flow to the customer app via the default_widget_layouts table.
 *
 * NOTE: Currently uses local state for layouts. Wire to Supabase
 * default_widget_layouts table for persistence.
 */
const LayoutManagerPage = () => {
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);

  const handleSave = useCallback((layout: SavedLayout) => {
    setLayouts((prev) => {
      const idx = prev.findIndex((l) => l.id === layout.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = layout;
        return updated;
      }
      return [...prev, layout];
    });
    // TODO: Persist to Supabase default_widget_layouts table
    console.log("[LayoutManagerPage] Save layout:", layout);
  }, []);

  const handleDelete = useCallback((layoutId: string) => {
    setLayouts((prev) => prev.filter((l) => l.id !== layoutId));
    // TODO: Delete from Supabase default_widget_layouts table
    console.log("[LayoutManagerPage] Delete layout:", layoutId);
  }, []);

  return (
    <DashboardLayout>
      <LayoutManager
        layouts={layouts}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </DashboardLayout>
  );
};

export default LayoutManagerPage;
