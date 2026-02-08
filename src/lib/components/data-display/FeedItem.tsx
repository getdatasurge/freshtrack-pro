import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, border } from '@/lib/design-system/tokens';

export interface FeedItemProps extends React.HTMLAttributes<HTMLDivElement> {
  avatar?: React.ReactNode;
  actor: string;
  action: string;
  target?: string;
  timestamp: string;
  extra?: React.ReactNode;
}

export const FeedItem = React.forwardRef<HTMLDivElement, FeedItemProps>(
  ({ className, avatar, actor, action, target, timestamp, extra, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex gap-3 py-3', `border-b ${border.subtle}`, 'last:border-b-0', className)}
        {...props}
      >
        {avatar && <div className="flex-shrink-0 mt-0.5">{avatar}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className={cn('font-medium', textTokens.primary)}>{actor}</span>{' '}
            <span className={textTokens.tertiary}>{action}</span>{' '}
            {target && <span className={cn('font-medium', textTokens.primary)}>{target}</span>}
          </p>
          <p className={cn('text-xs mt-0.5', textTokens.tertiary)}>{timestamp}</p>
          {extra && <div className="mt-2">{extra}</div>}
        </div>
      </div>
    );
  },
);
FeedItem.displayName = 'FeedItem';
