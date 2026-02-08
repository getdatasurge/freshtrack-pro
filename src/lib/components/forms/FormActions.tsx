import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { border } from '@/lib/design-system/tokens';

export interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'left' | 'right' | 'between';
  bordered?: boolean;
}

export const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(
  ({ className, align = 'right', bordered = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-3',
          bordered && `pt-4 border-t ${border.default}`,
          align === 'right' && 'justify-end',
          align === 'left' && 'justify-start',
          align === 'between' && 'justify-between',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
FormActions.displayName = 'FormActions';
