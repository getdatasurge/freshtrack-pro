import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { zIndex } from '@/lib/design-system/tokens';
import { Toast, type ToastProps } from './Toast';
import type { StatusVariant } from '@/lib/design-system/tokens';

interface ToastItem extends Omit<ToastProps, 'onDismiss'> {
  id: string;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function useToasts() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used within a ToastProvider');
  return ctx;
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = React.useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className={cn(
          'fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none',
          zIndex.toast,
        )}
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            variant={toast.variant}
            title={toast.title}
            description={toast.description}
            action={toast.action}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Convenience helper functions */
export function toast(title: string, options?: { description?: string; variant?: StatusVariant; action?: { label: string; onClick: () => void } }) {
  // This is a static reference - will be set by the provider
  return { title, ...options };
}
