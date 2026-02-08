import * as React from 'react';
import { cn } from '@/lib/design-system/cn';

export interface MediaObjectProps extends React.HTMLAttributes<HTMLDivElement> {
  media: React.ReactNode;
  mediaPosition?: 'top' | 'center';
  action?: React.ReactNode;
}

export const MediaObject = React.forwardRef<HTMLDivElement, MediaObjectProps>(
  ({ className, media, mediaPosition = 'top', action, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex gap-3', className)} {...props}>
        <div className={cn('flex-shrink-0', mediaPosition === 'center' && 'self-center')}>
          {media}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
        {action && <div className="flex-shrink-0 self-start">{action}</div>}
      </div>
    );
  },
);
MediaObject.displayName = 'MediaObject';
