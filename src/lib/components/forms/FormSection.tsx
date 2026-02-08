import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { typography, border, spacing } from '@/lib/design-system/tokens';

export interface FormSectionProps extends React.HTMLAttributes<HTMLFieldSetElement> {
  title: string;
  description?: string;
}

export const FormSection = React.forwardRef<HTMLFieldSetElement, FormSectionProps>(
  ({ className, title, description, children, ...props }, ref) => {
    return (
      <fieldset
        ref={ref}
        className={cn('border-none p-0 m-0', `pb-6 border-b ${border.default}`, 'last:border-b-0 last:pb-0', className)}
        {...props}
      >
        <legend className="contents">
          <h3 className={typography.h4}>{title}</h3>
          {description && <p className={cn('mt-1', typography.bodySmall)}>{description}</p>}
        </legend>
        <div className={cn('mt-4', spacing.stack)}>{children}</div>
      </fieldset>
    );
  },
);
FormSection.displayName = 'FormSection';
