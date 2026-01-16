import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useToast } from '@/hooks/use-toast';

interface ImpersonationTarget {
  user_id: string;
  email: string;
  full_name?: string | null;
  organization_id: string;
  organization_name: string;
}

/**
 * Hook that combines entering support mode, starting impersonation, and navigating to Main App.
 * Provides a one-click flow for "View as user" functionality.
 */
export function useImpersonateAndNavigate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    isSuperAdmin,
    isSupportModeActive,
    enterSupportMode,
    startImpersonation,
  } = useSuperAdmin();
  
  const [isNavigating, setIsNavigating] = useState(false);

  const impersonateAndNavigate = useCallback(async (user: ImpersonationTarget) => {
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

    setIsNavigating(true);

    try {
      // Step 1: Enter support mode if needed
      if (!isSupportModeActive) {
        await enterSupportMode();
        // Brief delay to allow state propagation
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Step 2: Start impersonation
      const success = await startImpersonation(
        user.user_id,
        user.email,
        user.full_name || user.email,
        user.organization_id,
        user.organization_name
      );

      if (!success) {
        setIsNavigating(false);
        return false;
      }

      // Step 3: Wait for state propagation to prevent race condition with DashboardLayout guard
      await new Promise(resolve => setTimeout(resolve, 150));

      // Step 4: Navigate to Main App
      navigate('/dashboard');
      
      return true;
    } catch (err) {
      console.error('Error in impersonateAndNavigate:', err);
      toast({
        title: 'Impersonation Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsNavigating(false);
    }
  }, [isSuperAdmin, isSupportModeActive, enterSupportMode, startImpersonation, navigate, toast]);

  return {
    impersonateAndNavigate,
    isNavigating,
    canImpersonate: isSuperAdmin,
  };
}
