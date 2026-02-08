import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, status } from '@/lib/design-system/tokens';
import { AlertTriangle } from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import { Button } from '../elements/Button';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading,
}: ConfirmDialogProps) {
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        {variant === 'destructive' && (
          <div className={cn('flex-shrink-0 rounded-full p-2', status.danger.bg)}>
            <AlertTriangle className={cn('h-5 w-5', status.danger.icon)} />
          </div>
        )}
        <div>
          <h3 className={cn('text-base font-medium', textTokens.primary)}>{title}</h3>
          {description && <p className={cn('mt-2 text-sm', textTokens.tertiary)}>{description}</p>}
        </div>
      </div>
    </ModalDialog>
  );
}
