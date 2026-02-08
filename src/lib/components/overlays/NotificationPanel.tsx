import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, border, text as textTokens, transition, radius, zIndex, shadow, status, type StatusVariant } from '@/lib/design-system/tokens';
import { X, Bell, Check } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  variant?: StatusVariant;
  read?: boolean;
}

export interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
}

export function NotificationPanel({ open, onClose, notifications, onMarkRead, onMarkAllRead }: NotificationPanelProps) {
  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={cn('fixed inset-0', zIndex.overlay)} role="dialog" aria-label="Notifications">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          'fixed right-4 top-14 w-96 max-h-[80vh] flex flex-col',
          surface.overlay,
          'border',
          border.default,
          radius.lg,
          shadow.lg,
          'motion-safe:animate-[slideDown_150ms_ease-out]',
        )}
      >
        <div className={cn('flex items-center justify-between px-4 py-3 border-b', border.default)}>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-50">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onMarkAllRead && unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className={cn('text-xs px-2 py-1 rounded', textTokens.link, transition.fast)}
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={cn('p-1 rounded', textTokens.tertiary, 'hover:bg-zinc-800', transition.fast)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className={cn('h-8 w-8 mx-auto mb-2', textTokens.disabled)} />
              <p className={cn('text-sm', textTokens.tertiary)}>No notifications</p>
            </div>
          ) : (
            notifications.map((n) => {
              const colors = status[n.variant || 'neutral'];
              return (
                <div
                  key={n.id}
                  className={cn(
                    'px-4 py-3 border-b',
                    border.subtle,
                    !n.read && 'bg-zinc-800/30',
                    transition.fast,
                  )}
                >
                  <div className="flex gap-3">
                    <div className={cn('mt-0.5 h-2 w-2 rounded-full flex-shrink-0', !n.read ? colors.dot : 'bg-transparent')} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', textTokens.primary)}>{n.title}</p>
                      {n.description && <p className={cn('text-xs mt-0.5', textTokens.tertiary)}>{n.description}</p>}
                      <p className={cn('text-xs mt-1', textTokens.disabled)}>{n.timestamp}</p>
                    </div>
                    {!n.read && onMarkRead && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(n.id)}
                        className={cn('p-1 rounded flex-shrink-0', textTokens.tertiary, 'hover:bg-zinc-800', transition.fast)}
                        aria-label="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
