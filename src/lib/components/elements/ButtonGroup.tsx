import * as React from 'react';
import { cn } from '@/lib/design-system/cn';

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation = 'horizontal', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        className={cn(
          'inline-flex',
          orientation === 'horizontal'
            ? '[&>*]:rounded-none [&>*:first-child]:rounded-l-lg [&>*:last-child]:rounded-r-lg [&>*+*]:border-l-0'
            : 'flex-col [&>*]:rounded-none [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg [&>*+*]:border-t-0',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ButtonGroup.displayName = 'ButtonGroup';
