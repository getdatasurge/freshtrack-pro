import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { zIndex } from '@/lib/design-system/tokens';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
} as const;

export function Tooltip({ content, children, position = 'top', delay = 200 }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute px-2.5 py-1.5 text-xs font-medium whitespace-nowrap',
            'bg-zinc-800 text-zinc-200 rounded-md border border-zinc-700',
            'shadow-lg shadow-black/40',
            zIndex.popover,
            positionClasses[position],
            'motion-safe:animate-[fadeIn_100ms_ease-out]',
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
