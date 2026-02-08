import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, zIndex, shadow, transition } from '@/lib/design-system/tokens';
import { Search, CornerDownLeft } from 'lucide-react';

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  group?: string;
  shortcut?: string[];
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
  placeholder?: string;
}

export function CommandPalette({ open, onOpenChange, items, placeholder = 'Search...' }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (item) => item.label.toLowerCase().includes(lower) || item.description?.toLowerCase().includes(lower),
    );
  }, [items, query]);

  const groups = React.useMemo(() => {
    const map = new Map<string, CommandPaletteItem[]>();
    for (const item of filtered) {
      const group = item.group || '';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    }
    return map;
  }, [filtered]);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].onSelect();
      onOpenChange(false);
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className={cn('fixed inset-0', zIndex.command)} role="dialog" aria-label="Command palette">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-x-0 top-[20%] mx-auto w-full max-w-lg px-4">
        <div
          className={cn(
            'overflow-hidden rounded-xl border',
            surface.overlay,
            border.default,
            shadow.lg,
            'motion-safe:animate-[scaleIn_150ms_ease-out]',
          )}
          onKeyDown={handleKeyDown}
        >
          <div className={cn('flex items-center gap-3 px-4 border-b', border.default)}>
            <Search className={cn('h-4 w-4 flex-shrink-0', textTokens.tertiary)} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className={cn(
                'flex-1 bg-transparent py-3 text-sm outline-none',
                textTokens.primary,
                'placeholder:text-zinc-500',
              )}
            />
            <kbd className="text-[10px] font-mono text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">ESC</kbd>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <div className={cn('py-8 text-center text-sm', textTokens.tertiary)}>No results found</div>
            )}
            {Array.from(groups.entries()).map(([group, groupItems]) => (
              <div key={group}>
                {group && (
                  <div className={cn('px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest', textTokens.tertiary)}>
                    {group}
                  </div>
                )}
                {groupItems.map((item) => {
                  flatIndex++;
                  const isSelected = flatIndex === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.onSelect();
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left',
                        transition.fast,
                        isSelected ? 'bg-zinc-800 text-zinc-50' : `${textTokens.secondary} hover:bg-zinc-800/50`,
                      )}
                    >
                      {item.icon && <span className="[&_svg]:h-4 [&_svg]:w-4 flex-shrink-0 text-zinc-400">{item.icon}</span>}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{item.label}</div>
                        {item.description && <div className={cn('text-xs', textTokens.tertiary)}>{item.description}</div>}
                      </div>
                      {item.shortcut && (
                        <div className="flex items-center gap-0.5">
                          {item.shortcut.map((key, i) => (
                            <kbd key={i} className="text-[10px] font-mono text-zinc-500 border border-zinc-700 rounded px-1 py-0.5">
                              {key}
                            </kbd>
                          ))}
                        </div>
                      )}
                      {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-zinc-500" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
