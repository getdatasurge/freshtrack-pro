import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useToast } from '@/hooks/use-toast';

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
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<ImpersonationTarget | null>(null);

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
   * Phase 2: Confirm and execute impersonation + navigation
   * Called when user confirms in the modal
   */
  const confirmAndNavigate = useCallback(async (
    target: ImpersonationTarget,
    reason?: string
  ): Promise<boolean> => {
    setIsNavigating(true);

    try {
      // Step 1: Enter support mode if needed
      if (!isSupportModeActive) {
        await enterSupportMode();
        // Brief delay to allow state propagation
        await new Promise(resolve => setTimeout(resolve, 50));
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
        return false;
      }

      // Step 3: Invalidate all tenant-scoped caches to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
      await queryClient.invalidateQueries({ queryKey: ['units'] });
      await queryClient.invalidateQueries({ queryKey: ['areas'] });
      await queryClient.invalidateQueries({ queryKey: ['sensors'] });
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });

      // Step 4: Wait for state propagation to prevent race condition with DashboardLayout guard
      await new Promise(resolve => setTimeout(resolve, 150));

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
    }
  }, [isSupportModeActive, enterSupportMode, startImpersonation, navigate, toast, queryClient]);

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
