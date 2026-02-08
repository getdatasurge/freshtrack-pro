import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, transition } from '@/lib/design-system/tokens';

export interface ToggleSwitchProps extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const sizeConfig = {
  sm: { track: 'h-5 w-9', thumb: 'h-3.5 w-3.5', translate: 'translate-x-4' },
  md: { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-5' },
} as const;

export const ToggleSwitch = React.forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  ({ className, checked, onChange, label, description, disabled, size = 'md', ...props }, ref) => {
    const config = sizeConfig[size];

    return (
      <div className={cn('flex items-start gap-3', className)}>
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex flex-shrink-0 rounded-full border-2 border-transparent cursor-pointer',
            transition.fast,
            config.track,
            checked ? 'bg-blue-600' : 'bg-zinc-700',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          {...props}
        >
          <span
            className={cn(
              'pointer-events-none inline-block rounded-full bg-white shadow transform',
              transition.fast,
              config.thumb,
              checked ? config.translate : 'translate-x-0.5',
              'mt-0.5 ml-0.5',
            )}
          />
        </button>
        {(label || description) && (
          <div>
            {label && <span className={cn('text-sm font-medium', textTokens.primary)}>{label}</span>}
            {description && <p className={cn('text-sm mt-0.5', textTokens.tertiary)}>{description}</p>}
          </div>
        )}
      </div>
    );
  },
);
ToggleSwitch.displayName = 'ToggleSwitch';
