import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, transition, zIndex, radius, shadow } from '@/lib/design-system/tokens';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const close = () => setPosition(null);
    if (position) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [position]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {position && (
        <div
          className={cn(
            'fixed min-w-[160px] border py-1',
            surface.overlay,
            border.default,
            radius.md,
            shadow.lg,
            zIndex.popover,
            'motion-safe:animate-[scaleIn_100ms_ease-out]',
          )}
          style={{ left: position.x, top: position.y }}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setPosition(null);
              }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-sm text-left',
                transition.fast,
                'disabled:opacity-50',
                item.variant === 'danger'
                  ? 'text-red-400 hover:bg-red-500/10'
                  : `${textTokens.secondary} hover:bg-zinc-800`,
              )}
            >
              {item.icon && <span className="[&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
