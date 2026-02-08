import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { Chip } from './Chip';

export interface ChipGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  items: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  selected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  multiple?: boolean;
}

export const ChipGroup = React.forwardRef<HTMLDivElement, ChipGroupProps>(
  ({ className, items, selected = [], onSelectionChange, multiple = false, ...props }, ref) => {
    const handleToggle = (id: string) => {
      if (!onSelectionChange) return;

      if (multiple) {
        const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
        onSelectionChange(next);
      } else {
        onSelectionChange(selected.includes(id) ? [] : [id]);
      }
    };

    return (
      <div
        ref={ref}
        role="group"
        className={cn('flex flex-wrap gap-2', className)}
        {...props}
      >
        {items.map((item) => (
          <Chip
            key={item.id}
            icon={item.icon}
            selected={selected.includes(item.id)}
            onClick={() => handleToggle(item.id)}
            role="option"
            aria-selected={selected.includes(item.id)}
            className="cursor-pointer"
          >
            {item.label}
          </Chip>
        ))}
      </div>
    );
  },
);
ChipGroup.displayName = 'ChipGroup';
