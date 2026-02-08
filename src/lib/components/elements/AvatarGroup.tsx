import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { Avatar, type AvatarSize } from './Avatar';
import { surface, border as borderTokens, text as textTokens } from '@/lib/design-system/tokens';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: AvatarSize;
  items: Array<{ src?: string | null; name?: string; alt?: string }>;
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 4, size = 'md', items, ...props }, ref) => {
    const visible = items.slice(0, max);
    const remaining = items.length - max;

    return (
      <div ref={ref} className={cn('flex -space-x-2', className)} {...props}>
        {visible.map((item, i) => (
          <Avatar
            key={i}
            src={item.src}
            name={item.name}
            alt={item.alt}
            size={size}
            className="ring-2 ring-zinc-950"
          />
        ))}
        {remaining > 0 && (
          <div
            className={cn(
              'relative inline-flex items-center justify-center rounded-full',
              'ring-2 ring-zinc-950 border',
              surface.raised,
              borderTokens.default,
              textTokens.secondary,
              'text-xs font-medium',
              size === 'xs' ? 'h-6 w-6 text-[10px]' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
            )}
          >
            +{remaining}
          </div>
        )}
      </div>
    );
  },
);
AvatarGroup.displayName = 'AvatarGroup';
