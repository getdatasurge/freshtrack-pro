import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { spacing } from '@/lib/design-system/tokens';

export interface FormLayoutProps extends React.FormHTMLAttributes<HTMLFormElement> {
  layout?: 'stacked' | 'two-column';
}

export const FormLayout = React.forwardRef<HTMLFormElement, FormLayoutProps>(
  ({ className, layout = 'stacked', children, ...props }, ref) => {
    return (
      <form
        ref={ref}
        className={cn(
          layout === 'two-column' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : spacing.stackLoose,
          className,
        )}
        {...props}
      >
        {children}
      </form>
    );
  },
);
FormLayout.displayName = 'FormLayout';
