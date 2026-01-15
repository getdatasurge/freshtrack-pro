import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { Button } from '@/components/ui/button';
import { Shield, X, User, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function SupportModeBanner() {
  const {
    isSuperAdmin,
    isSupportModeActive,
    supportModeExpiresAt,
    exitSupportMode,
    impersonation
  } = useSuperAdmin();

  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Update time remaining every second
  useEffect(() => {
    if (!supportModeExpiresAt || !isSupportModeActive) {
      setTimeRemaining('');
      return;
    }

    const updateTimeRemaining = () => {
      const now = new Date();
      const diff = supportModeExpiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expiring...');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [supportModeExpiresAt, isSupportModeActive]);

  if (!isSuperAdmin || !isSupportModeActive) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-between gap-4",
        impersonation.isImpersonating
          ? "bg-orange-600 text-white"
          : "bg-purple-600 text-white"
      )}
    >
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5" />
        <span className="font-semibold">
          {impersonation.isImpersonating ? 'Impersonation Active' : 'Support Mode Active'}
        </span>

        {impersonation.isImpersonating && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm">
            <User className="w-4 h-4" />
            <span>
              Viewing as: {impersonation.impersonatedUserName || impersonation.impersonatedUserEmail}
            </span>
            {impersonation.impersonatedOrgName && (
              <span className="text-white/80">({impersonation.impersonatedOrgName})</span>
            )}
          </div>
        )}

        {timeRemaining && (
          <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-sm">
            <Clock className="w-3 h-3" />
            <span>{timeRemaining}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1 text-sm text-white/80">
          <AlertTriangle className="w-4 h-4" />
          <span>All actions are logged</span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={exitSupportMode}
          className="bg-white/20 hover:bg-white/30 text-white border-0"
        >
          <X className="w-4 h-4 mr-1" />
          Exit Support Mode
        </Button>
      </div>
    </div>
  );
}

export function ImpersonationBanner() {
  const { impersonation, stopImpersonation, isSupportModeActive } = useSuperAdmin();

  if (!impersonation.isImpersonating || !isSupportModeActive) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] p-4 bg-orange-600 text-white rounded-lg shadow-lg max-w-sm">
      <div className="flex items-start gap-3">
        <User className="w-5 h-5 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold">Impersonating User</div>
          <div className="text-sm text-white/90">
            {impersonation.impersonatedUserName || impersonation.impersonatedUserEmail}
          </div>
          {impersonation.impersonatedOrgName && (
            <div className="text-xs text-white/70 mt-1">
              Organization: {impersonation.impersonatedOrgName}
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={stopImpersonation}
          className="bg-white/20 hover:bg-white/30 text-white border-0"
        >
          Stop
        </Button>
      </div>
    </div>
  );
}
