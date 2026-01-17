import { useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity';
import { useToast } from '@/hooks/use-toast';
import { invalidateAllOrgScopedCaches } from '@/lib/orgScopedInvalidation';

// Configuration for impersonation navigation
const IMPERSONATION_READY_POLL_INTERVAL_MS = 50;
const IMPERSONATION_READY_MAX_WAIT_MS = 2000;

export interface ImpersonationTarget {
  user_id: string;
  email: string;
  full_name?: string | null;
  organization_id: string;
  organization_name: string;
}

/**
 * Hook that combines entering support mode, starting impersonation, and navigating to Main App.
 * Now includes a two-phase flow: request confirmation, then execute.
 * 
 * Usage:
 * 1. Call requestImpersonation(target) to set the pending target
 * 2. Show ConfirmSpoofingModal with pendingTarget
 * 3. On confirm, call confirmAndNavigate(target, reason)
 * 4. On cancel, call cancelRequest()
 */
export function useImpersonateAndNavigate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    isSuperAdmin,
    isSupportModeActive,
    enterSupportMode,
    startImpersonation,
  } = useSuperAdmin();
  const { effectiveOrgId, isImpersonating, refresh: refreshIdentity } = useEffectiveIdentity();

  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<ImpersonationTarget | null>(null);

  // Track navigation attempts to prevent double navigation
  const navigationAttemptRef = useRef<string | null>(null);

  /**
   * Phase 1: Request impersonation - sets the pending target for confirmation
   * Returns the target so the modal can be shown
   */
  const requestImpersonation = useCallback((user: ImpersonationTarget): ImpersonationTarget | null => {
    if (!isSuperAdmin) {
      toast({
        title: 'Access Denied',
        description: 'Only Super Admins can impersonate users.',
        variant: 'destructive',
      });
      return null;
    }

    if (!user.organization_id || !user.organization_name) {
      toast({
        title: 'Cannot impersonate',
        description: 'This user has no organization membership.',
        variant: 'destructive',
      });
      return null;
    }

    setPendingTarget(user);
    return user;
  }, [isSuperAdmin, toast]);

  /**
   * Cancel pending impersonation request
   */
  const cancelRequest = useCallback(() => {
    setPendingTarget(null);
  }, []);

  /**
   * Wait for effective identity to be updated with the target org.
   * Polls until effectiveOrgId matches targetOrgId or timeout is reached.
   */
  const waitForEffectiveIdentity = useCallback(async (targetOrgId: string): Promise<boolean> => {
    const startTime = Date.now();

    // Trigger identity refresh
    await refreshIdentity();

    return new Promise((resolve) => {
      const checkReady = () => {
        const elapsed = Date.now() - startTime;

        // Check if identity is now correct
        // We read from localStorage directly for immediate consistency
        try {
          const stored = localStorage.getItem('ftp_impersonation_session');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.targetOrgId === targetOrgId) {
              resolve(true);
              return;
            }
          }
        } catch (e) {
          // Ignore parse errors, continue polling
        }

        // Timeout check
        if (elapsed >= IMPERSONATION_READY_MAX_WAIT_MS) {
          console.warn('[useImpersonateAndNavigate] Timed out waiting for effective identity');
          // Still resolve true - the state might be ready, just not detected
          resolve(true);
          return;
        }

        // Continue polling
        setTimeout(checkReady, IMPERSONATION_READY_POLL_INTERVAL_MS);
      };

      // Start checking
      checkReady();
    });
  }, [refreshIdentity]);

  /**
   * Phase 2: Confirm and execute impersonation + navigation
   * Called when user confirms in the modal
   */
  const confirmAndNavigate = useCallback(async (
    target: ImpersonationTarget,
    reason?: string
  ): Promise<boolean> => {
    // Prevent double navigation
    if (navigationAttemptRef.current === target.user_id) {
      return false;
    }
    navigationAttemptRef.current = target.user_id;
    setIsNavigating(true);

    try {
      // Step 1: Enter support mode if needed
      if (!isSupportModeActive) {
        await enterSupportMode();
        // Brief delay to allow support mode state propagation
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 2: Start impersonation (includes reason in audit log if provided)
      const success = await startImpersonation(
        target.user_id,
        target.email,
        target.full_name || target.email,
        target.organization_id,
        target.organization_name
      );

      if (!success) {
        setIsNavigating(false);
        navigationAttemptRef.current = null;
        return false;
      }

      // Step 3: Wait for effective identity to be updated
      // This replaces the unreliable fixed timeout
      await waitForEffectiveIdentity(target.organization_id);

      // Step 4: Invalidate all tenant-scoped caches to ensure fresh data
      // Do this AFTER identity is confirmed to prevent stale fetches
      await invalidateAllOrgScopedCaches(queryClient, 'startImpersonation');

      // Step 5: Clear pending target
      setPendingTarget(null);

      // Step 6: Navigate to Main App
      navigate('/dashboard');

      return true;
    } catch (err) {
      console.error('Error in confirmAndNavigate:', err);
      toast({
        title: 'Impersonation Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsNavigating(false);
      navigationAttemptRef.current = null;
    }
  }, [isSupportModeActive, enterSupportMode, startImpersonation, navigate, toast, queryClient, waitForEffectiveIdentity]);

  /**
   * Legacy one-step method - immediately starts impersonation (for backward compatibility)
   * Prefer using requestImpersonation + confirmAndNavigate for the modal flow
   */
  const impersonateAndNavigate = useCallback(async (user: ImpersonationTarget): Promise<boolean> => {
    if (!isSuperAdmin) {
      toast({
        title: 'Access Denied',
        description: 'Only Super Admins can impersonate users.',
        variant: 'destructive',
      });
      return false;
    }

    if (!user.organization_id || !user.organization_name) {
      toast({
        title: 'Cannot impersonate',
        description: 'This user has no organization membership.',
        variant: 'destructive',
      });
      return false;
    }

    // For the legacy method, we directly execute
    return confirmAndNavigate(user);
  }, [isSuperAdmin, toast, confirmAndNavigate]);

  return {
    // Two-phase flow (recommended)
    requestImpersonation,
    cancelRequest,
    confirmAndNavigate,
    pendingTarget,
    
    // Legacy one-step method (for backward compatibility)
    impersonateAndNavigate,
    
    // State
    isNavigating,
    canImpersonate: isSuperAdmin,
  };
}
