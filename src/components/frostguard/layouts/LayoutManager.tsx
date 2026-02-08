import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, surface, border, spacing } from '@/lib/design-system/tokens';
import { Layout, Plus, Save, Trash2, Copy, Eye } from 'lucide-react';
import { Button } from '@/lib/components/elements/Button';
import { SelectMenu } from '@/lib/components/forms/SelectMenu';
import { Card } from '@/lib/components/layout/Card';
import { PageHeading } from '@/lib/components/headings/PageHeading';
import { SectionHeading } from '@/lib/components/headings/SectionHeading';
import { ConfirmDialog } from '@/lib/components/overlays/ConfirmDialog';
import { Badge } from '@/lib/components/elements/Badge';
import { StackedList } from '@/lib/components/data-display/StackedList';
import { StackedListItem } from '@/lib/components/data-display/StackedListItem';
import { AdminWidgetGrid } from './AdminWidgetGrid';
import { WidgetPicker } from './WidgetPicker';
import { type WidgetPlacement, createPlacement } from '../registry/widgetFactory';
import { getWidget, type WidgetRegistryEntry, type AppTarget } from '../registry/widgetRegistry';

export interface SavedLayout {
  id: string;
  name: string;
  equipmentType: string;
  appTarget: AppTarget;
  placements: WidgetPlacement[];
  createdAt: string;
  updatedAt: string;
}

export interface LayoutManagerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Saved layouts from the database */
  layouts: SavedLayout[];
  /** Equipment types for the select menu */
  equipmentTypes?: string[];
  /** Callback to save a layout */
  onSave: (layout: SavedLayout) => void;
  /** Callback to delete a layout */
  onDelete: (layoutId: string) => void;
  /** Loading state */
  loading?: boolean;
}

/**
 * Admin-only layout manager.
 * Design default layouts per equipment type that flow to the customer app.
 */
export function LayoutManager({
  className,
  layouts,
  equipmentTypes = ['walk_in_cooler', 'walk_in_freezer', 'prep_display', 'prep_table', 'display_case', 'dry_storage'],
  onSave,
  onDelete,
  loading,
  ...props
}: LayoutManagerProps) {
  const [selectedLayoutId, setSelectedLayoutId] = React.useState<string | null>(
    layouts[0]?.id || null,
  );
  const [placements, setPlacements] = React.useState<WidgetPlacement[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editEquipType, setEditEquipType] = React.useState(equipmentTypes[0] || 'walk_in_cooler');
  const [hasChanges, setHasChanges] = React.useState(false);

  const selectedLayout = layouts.find((l) => l.id === selectedLayoutId);

  // Sync placements when selected layout changes
  React.useEffect(() => {
    if (selectedLayout) {
      setPlacements(selectedLayout.placements);
      setEditName(selectedLayout.name);
      setEditEquipType(selectedLayout.equipmentType);
      setHasChanges(false);
    }
  }, [selectedLayoutId]);

  const handleAddWidget = (widget: WidgetRegistryEntry) => {
    const placement = createPlacement(widget, {}, { x: 0, y: Infinity });
    setPlacements((prev) => [...prev, placement]);
    setHasChanges(true);
  };

  const handleRemoveWidget = (instanceId: string) => {
    setPlacements((prev) => prev.filter((p) => p.instanceId !== instanceId));
    setHasChanges(true);
  };

  const handleLayoutChange = (updated: WidgetPlacement[]) => {
    setPlacements(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    const layout: SavedLayout = {
      id: selectedLayout?.id || `layout-${Date.now()}`,
      name: editName || `${editEquipType} layout`,
      equipmentType: editEquipType,
      appTarget: 'customer',
      placements,
      createdAt: selectedLayout?.createdAt || now,
      updatedAt: now,
    };
    onSave(layout);
    setHasChanges(false);
  };

  const handleNewLayout = () => {
    setSelectedLayoutId(null);
    setPlacements([]);
    setEditName('New Layout');
    setEditEquipType(equipmentTypes[0] || 'walk_in_cooler');
    setHasChanges(true);
  };

  const placedWidgetIds = placements.map((p) => p.widgetId);

  return (
    <div className={cn(spacing.page, className)} {...props}>
      <PageHeading
        title="Layout Manager"
        description="Design default widget layouts per equipment type"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={handleNewLayout}
            >
              New Layout
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="h-4 w-4" />}
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-6 mt-6">
        {/* Sidebar: saved layouts list */}
        <div className="col-span-1 space-y-4">
          <SectionHeading title="Saved Layouts" />
          {layouts.length === 0 ? (
            <p className={cn('text-sm', textTokens.tertiary)}>No layouts yet</p>
          ) : (
            <StackedList>
              {layouts.map((layout) => (
                <StackedListItem
                  key={layout.id}
                  title={layout.name}
                  description={layout.equipmentType}
                  meta={
                    <Badge variant={layout.id === selectedLayoutId ? 'info' : 'neutral'} size="sm">
                      {layout.placements.length} widgets
                    </Badge>
                  }
                  navigable
                  onClick={() => setSelectedLayoutId(layout.id)}
                />
              ))}
            </StackedList>
          )}
        </div>

        {/* Main: layout editor */}
        <div className="col-span-3 space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className={cn('text-sm font-medium', textTokens.secondary)}>Layout Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => { setEditName(e.target.value); setHasChanges(true); }}
                className={cn(
                  'mt-1 w-full px-3 py-2 text-sm rounded-lg border outline-none',
                  surface.raised,
                  border.default,
                  textTokens.primary,
                  'focus:border-blue-500',
                )}
              />
            </div>
            <SelectMenu
              label="Equipment Type"
              value={editEquipType}
              onChange={(e) => { setEditEquipType(e.target.value); setHasChanges(true); }}
              options={equipmentTypes.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
            />
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setPickerOpen(true)}
            >
              Add Widget
            </Button>
          </div>

          {/* Widget grid editor */}
          {placements.length === 0 ? (
            <Card variant="outlined" padding="loose">
              <div className="flex flex-col items-center justify-center py-12">
                <Layout className={cn('h-12 w-12 mb-3', textTokens.disabled)} />
                <p className={cn('text-sm', textTokens.tertiary)}>No widgets added yet</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setPickerOpen(true)}
                >
                  Add Widget
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <AdminWidgetGrid
                placements={placements}
                editable
                onLayoutChange={handleLayoutChange}
              />

              {/* Placement list for management */}
              <SectionHeading title="Placed Widgets" />
              <div className="grid grid-cols-2 gap-2">
                {placements.map((p) => {
                  const entry = getWidget(p.widgetId);
                  return (
                    <div
                      key={p.instanceId}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg border',
                        surface.raised,
                        border.default,
                      )}
                    >
                      <span className={cn('text-sm', textTokens.secondary)}>
                        {entry?.name || p.widgetId}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRemoveWidget(p.instanceId)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddWidget}
        appTarget="customer"
        placedWidgetIds={placedWidgetIds}
      />

      {selectedLayout && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={() => {
            onDelete(selectedLayout.id);
            setDeleteConfirmOpen(false);
            setSelectedLayoutId(layouts.find((l) => l.id !== selectedLayout.id)?.id || null);
          }}
          title="Delete Layout"
          description={`Are you sure you want to delete "${selectedLayout.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
        />
      )}
    </div>
  );
}
