import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, transition } from '@/lib/design-system/tokens';

export interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ className, leftIcon, rightIcon, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium',
          textTokens.link,
          transition.fast,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:rounded-sm',
          className,
        )}
        {...props}
      >
        {leftIcon && <span className="[&_svg]:h-4 [&_svg]:w-4">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="[&_svg]:h-4 [&_svg]:w-4">{rightIcon}</span>}
      </a>
    );
  },
);
LinkButton.displayName = 'LinkButton';
