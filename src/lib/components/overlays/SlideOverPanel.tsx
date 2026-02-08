import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, zIndex, text as textTokens, transition } from '@/lib/design-system/tokens';
import { X } from 'lucide-react';

export type SlideOverSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<SlideOverSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: SlideOverSize;
  position?: 'right' | 'left';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SlideOverPanel({ open, onClose, title, description, size = 'md', position = 'right', children, footer }: SlideOverPanelProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={cn('fixed inset-0', zIndex.overlay)} role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={cn('fixed inset-y-0 flex', position === 'right' ? 'right-0' : 'left-0')}>
        <div
          className={cn(
            'relative w-screen flex flex-col',
            sizeClasses[size],
            surface.overlay,
            position === 'right' ? `border-l ${border.default}` : `border-r ${border.default}`,
            'shadow-2xl',
            position === 'right'
              ? 'motion-safe:animate-[slideLeft_200ms_ease-out]'
              : 'motion-safe:animate-[slideRight_200ms_ease-out]',
          )}
        >
          {(title || description) && (
            <div className={cn('flex items-start justify-between gap-4 px-6 py-5 border-b', border.default)}>
              <div>
                {title && <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>}
                {description && <p className={cn('mt-1 text-sm', textTokens.tertiary)}>{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn('p-1 rounded-md', textTokens.tertiary, 'hover:text-zinc-200 hover:bg-zinc-800', transition.fast)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && (
            <div className={cn('flex items-center justify-end gap-3 px-6 py-4 border-t', border.default)}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
