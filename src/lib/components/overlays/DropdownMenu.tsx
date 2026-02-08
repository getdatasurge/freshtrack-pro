import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, transition, zIndex, radius, shadow } from '@/lib/design-system/tokens';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface DropdownMenuGroup {
  label?: string;
  items: DropdownMenuItem[];
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  groups: DropdownMenuGroup[];
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({ trigger, groups, align = 'end', className }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute top-full mt-1 min-w-[180px] border py-1',
            surface.overlay,
            border.default,
            radius.md,
            shadow.lg,
            zIndex.dropdown,
            align === 'start' ? 'left-0' : 'right-0',
            'motion-safe:animate-[scaleIn_100ms_ease-out]',
            className,
          )}
          role="menu"
        >
          {groups.map((group, gIdx) => (
            <div key={gIdx}>
              {gIdx > 0 && <div className={cn('my-1 border-t', border.subtle)} />}
              {group.label && (
                <div className={cn('px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest', textTokens.tertiary)}>
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm text-left',
                    transition.fast,
                    'disabled:opacity-50 disabled:pointer-events-none',
                    item.variant === 'danger'
                      ? 'text-red-400 hover:bg-red-500/10'
                      : `${textTokens.secondary} hover:bg-zinc-800 hover:text-zinc-100`,
                  )}
                >
                  {item.icon && <span className="[&_svg]:h-4 [&_svg]:w-4 flex-shrink-0">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
