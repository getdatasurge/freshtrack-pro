import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, radius, transition } from '@/lib/design-system/tokens';

export interface TextareaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
  showCount?: boolean;
}

export const TextareaInput = React.forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  ({ className, hasError, showCount, maxLength, value, ...props }, ref) => {
    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={cn(
            'w-full px-3 py-2 text-sm min-h-[80px] resize-y',
            surface.raised,
            'border',
            hasError ? 'border-red-500 ring-2 ring-red-500/30' : border.strong,
            radius.md,
            textTokens.primary,
            'placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
            transition.fast,
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {showCount && maxLength && (
          <span className={cn('absolute bottom-2 right-3 text-xs', charCount >= maxLength ? 'text-red-400' : textTokens.tertiary)}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    );
  },
);
TextareaInput.displayName = 'TextareaInput';
