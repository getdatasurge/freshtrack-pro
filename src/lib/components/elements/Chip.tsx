import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, transition } from '@/lib/design-system/tokens';
import { X } from 'lucide-react';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  removable?: boolean;
  onRemove?: () => void;
  selected?: boolean;
  icon?: React.ReactNode;
}

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, removable, onRemove, selected, icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
          'text-xs font-medium',
          transition.fast,
          selected
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            : `${surface.raised} ${textTokens.secondary} ${border.default} hover:${surface.hover}`,
          className,
        )}
        {...props}
      >
        {icon && <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
        {children}
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className={cn(
              'ml-0.5 -mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full',
              'hover:bg-white/10',
              transition.fast,
            )}
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  },
);
Chip.displayName = 'Chip';
