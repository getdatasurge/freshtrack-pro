import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, radius, zIndex, shadow, transition, text as textTokens } from '@/lib/design-system/tokens';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function ModalDialog({ open, onClose, title, description, size = 'md', children, footer }: ModalDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', zIndex.modal)} role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          'relative w-full',
          sizeClasses[size],
          surface.overlay,
          'border',
          border.default,
          radius.lg,
          'shadow-2xl',
          'motion-safe:animate-[scaleIn_200ms_ease-out]',
          'max-h-[85vh] flex flex-col',
        )}
      >
        {(title || description) && (
          <div className={cn('flex items-start justify-between gap-4 px-6 pt-6 pb-0')}>
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
  );
}
