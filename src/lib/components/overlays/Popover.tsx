import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius, zIndex, shadow } from '@/lib/design-system/tokens';

export interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function Popover({ trigger, children, align = 'start', className }: PopoverProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute top-full mt-2 min-w-[200px] border p-3',
            surface.overlay,
            border.default,
            radius.lg,
            shadow.lg,
            zIndex.popover,
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'end' && 'right-0',
            'motion-safe:animate-[scaleIn_150ms_ease-out]',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
