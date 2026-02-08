import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, surface, border, radius, transition, spacing } from '@/lib/design-system/tokens';
import { Plus, Search, X } from 'lucide-react';
import { ModalDialog } from '@/lib/components/overlays/ModalDialog';
import { Button } from '@/lib/components/elements/Button';
import { Badge } from '@/lib/components/elements/Badge';
import { Card } from '@/lib/components/layout/Card';
import { getAdminWidgets, getWidgetsForApp, type WidgetRegistryEntry, type AppTarget } from '../registry/widgetRegistry';
import { SensorIcon } from '../primitives/SensorIcon';

export interface WidgetPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (widget: WidgetRegistryEntry) => void;
  /** Filter widgets by sensor kind */
  sensorKind?: string;
  /** App target to filter widgets */
  appTarget?: AppTarget;
  /** Widget IDs already placed (shown as disabled) */
  placedWidgetIds?: string[];
}

const categoryLabels: Record<string, string> = {
  sensor: 'Sensor Data',
  compliance: 'Compliance',
  system: 'System & Diagnostics',
  overview: 'Overview',
};

/**
 * Admin-only modal catalog for selecting widgets to add to a layout.
 */
export function WidgetPicker({
  open,
  onClose,
  onSelect,
  sensorKind,
  appTarget = 'admin',
  placedWidgetIds = [],
}: WidgetPickerProps) {
  const [search, setSearch] = React.useState('');

  const allWidgets = sensorKind
    ? getWidgetsForApp(sensorKind, appTarget)
    : appTarget === 'admin'
      ? getAdminWidgets()
      : getAdminWidgets();

  const filtered = search
    ? allWidgets.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.description.toLowerCase().includes(search.toLowerCase()),
      )
    : allWidgets;

  // Group by category
  const grouped = filtered.reduce<Record<string, WidgetRegistryEntry[]>>((acc, w) => {
    const cat = w.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(w);
    return acc;
  }, {});

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Add Widget"
      size="lg"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4', textTokens.disabled)} />
          <input
            type="text"
            placeholder="Search widgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border outline-none',
              surface.raised,
              border.default,
              textTokens.primary,
              'placeholder:text-zinc-500 focus:border-blue-500',
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className={cn('absolute right-3 top-1/2 -translate-y-1/2', textTokens.disabled, 'hover:text-zinc-300')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Widget grid by category */}
        {Object.entries(grouped).map(([category, widgets]) => (
          <div key={category}>
            <h3 className={cn('text-xs font-semibold uppercase tracking-widest mb-3', textTokens.tertiary)}>
              {categoryLabels[category] || category}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {widgets.map((widget) => {
                const isPlaced = placedWidgetIds.includes(widget.id);
                return (
                  <button
                    key={widget.id}
                    disabled={isPlaced}
                    onClick={() => {
                      onSelect(widget);
                      onClose();
                    }}
                    className={cn(
                      'text-left p-4 rounded-lg border',
                      transition.fast,
                      isPlaced
                        ? 'opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-900'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50 cursor-pointer',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={cn('text-sm font-medium', textTokens.primary)}>{widget.name}</p>
                        <p className={cn('text-xs mt-1', textTokens.tertiary)}>{widget.description}</p>
                      </div>
                      {isPlaced ? (
                        <Badge variant="neutral" size="sm">Added</Badge>
                      ) : (
                        <Plus className={cn('h-4 w-4 flex-shrink-0 mt-0.5', textTokens.tertiary)} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="info" size="sm">{widget.category}</Badge>
                      <span className={cn('text-[10px]', textTokens.disabled)}>
                        {widget.defaultSize.cols}x{widget.defaultSize.rows}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-8 text-center">
            <p className={cn('text-sm', textTokens.tertiary)}>No widgets match your search</p>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
