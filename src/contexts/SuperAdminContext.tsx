import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Support mode timeout (30 minutes in milliseconds)
const SUPPORT_MODE_TIMEOUT_MS = 30 * 60 * 1000;
const SUPPORT_MODE_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUserId: string | null;
  impersonatedUserEmail: string | null;
  impersonatedUserName: string | null;
  impersonatedOrgId: string | null;
  impersonatedOrgName: string | null;
  startedAt: Date | null;
}

interface ViewingOrgState {
  orgId: string | null;
  orgName: string | null;
}

interface SuperAdminContextType {
  // Super admin status
  isSuperAdmin: boolean;
  isLoadingSuperAdmin: boolean;

  // Support mode
  isSupportModeActive: boolean;
  supportModeStartedAt: Date | null;
  supportModeExpiresAt: Date | null;
  enterSupportMode: () => Promise<void>;
  exitSupportMode: () => Promise<void>;

  // Impersonation
  impersonation: ImpersonationState;
  startImpersonation: (userId: string, userEmail: string, userName: string, orgId: string, orgName: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;

  // Org viewing (without impersonation)
  viewingOrg: ViewingOrgState;
  setViewingOrg: (orgId: string | null, orgName: string | null) => void;
  exitToplatform: () => void;

  // Audit logging
  logSuperAdminAction: (
    actionType: string,
    targetType?: string,
    targetId?: string,
    targetOrgId?: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;

  // Refresh super admin status
  refreshSuperAdminStatus: () => Promise<void>;
}

const SuperAdminContext = createContext<SuperAdminContextType | undefined>(undefined);

interface SuperAdminProviderProps {
  children: ReactNode;
}

export function SuperAdminProvider({ children }: SuperAdminProviderProps) {
  const { toast } = useToast();

  // Super admin status
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoadingSuperAdmin, setIsLoadingSuperAdmin] = useState(true);

  // Support mode state
  const [isSupportModeActive, setIsSupportModeActive] = useState(false);
  const [supportModeStartedAt, setSupportModeStartedAt] = useState<Date | null>(null);
  const [supportModeExpiresAt, setSupportModeExpiresAt] = useState<Date | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<Date>(new Date());

  // Impersonation state
  const [impersonation, setImpersonation] = useState<ImpersonationState>({
    isImpersonating: false,
    impersonatedUserId: null,
    impersonatedUserEmail: null,
    impersonatedUserName: null,
    impersonatedOrgId: null,
    impersonatedOrgName: null,
    startedAt: null,
  });

  // Viewing org state (for browsing without impersonation)
  const [viewingOrg, setViewingOrgState] = useState<ViewingOrgState>({
    orgId: null,
    orgName: null,
  });

  // Check super admin status
  const checkSuperAdminStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSuperAdmin(false);
        setIsLoadingSuperAdmin(false);
        return;
      }

      // Call the is_current_user_super_admin function
      const { data, error } = await supabase.rpc('is_current_user_super_admin');

      if (error) {
        console.error('Error checking super admin status:', error);
        setIsSuperAdmin(false);
      } else {
        setIsSuperAdmin(data === true);
      }
    } catch (err) {
      console.error('Error checking super admin status:', err);
      setIsSuperAdmin(false);
    } finally {
      setIsLoadingSuperAdmin(false);
    }
  }, []);

  // Initial load and auth state changes
  useEffect(() => {
    checkSuperAdminStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        checkSuperAdminStatus();
      }

      // Reset all super admin state on sign out
      if (event === 'SIGNED_OUT') {
        setIsSuperAdmin(false);
        setIsSupportModeActive(false);
        setSupportModeStartedAt(null);
        setSupportModeExpiresAt(null);
        setImpersonation({
          isImpersonating: false,
          impersonatedUserId: null,
          impersonatedUserEmail: null,
          impersonatedUserName: null,
          impersonatedOrgId: null,
          impersonatedOrgName: null,
          startedAt: null,
        });
        setViewingOrgState({ orgId: null, orgName: null });
      }
    });

    return () => subscription.unsubscribe();
  }, [checkSuperAdminStatus]);

  // Support mode auto-timeout
  useEffect(() => {
    if (!isSupportModeActive || !supportModeExpiresAt) return;

    const checkExpiry = () => {
      const now = new Date();
      const timeSinceActivity = now.getTime() - lastActivityTime.getTime();

      // Check inactivity timeout
      if (timeSinceActivity >= SUPPORT_MODE_INACTIVITY_TIMEOUT_MS) {
        exitSupportMode();
        toast({
          title: 'Support Mode Ended',
          description: 'Support mode has been automatically disabled due to inactivity.',
        });
        return;
      }

      // Check absolute timeout
      if (now >= supportModeExpiresAt) {
        exitSupportMode();
        toast({
          title: 'Support Mode Ended',
          description: 'Support mode has reached its maximum duration.',
        });
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isSupportModeActive, supportModeExpiresAt, lastActivityTime]);

  // Track activity for inactivity timeout
  useEffect(() => {
    if (!isSupportModeActive) return;

    const updateActivity = () => setLastActivityTime(new Date());

    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('mousemove', updateActivity);

    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('mousemove', updateActivity);
    };
  }, [isSupportModeActive]);

  // Log super admin action
  const logSuperAdminAction = useCallback(async (
    actionType: string,
    targetType?: string,
    targetId?: string,
    targetOrgId?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!isSuperAdmin) return;

    try {
      await supabase.rpc('log_super_admin_action', {
        p_action: actionType,
        p_target_type: targetType || null,
        p_target_id: targetId || null,
        p_target_org_id: targetOrgId || null,
        p_impersonated_user_id: impersonation.impersonatedUserId || null,
        p_details: JSON.parse(JSON.stringify(metadata || {})),
      });
    } catch (err) {
      console.error('Error logging super admin action:', err);
    }
  }, [isSuperAdmin, impersonation.impersonatedUserId]);

  // Enter support mode
  const enterSupportMode = useCallback(async () => {
    if (!isSuperAdmin) {
      toast({
        title: 'Access Denied',
        description: 'Only Super Admins can enter Support Mode.',
        variant: 'destructive',
      });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SUPPORT_MODE_TIMEOUT_MS);

    setIsSupportModeActive(true);
    setSupportModeStartedAt(now);
    setSupportModeExpiresAt(expiresAt);
    setLastActivityTime(now);

    await logSuperAdminAction('SUPPORT_MODE_ENTERED');

    toast({
      title: 'Support Mode Activated',
      description: 'You now have access to support tools. Mode will auto-expire after 30 minutes of inactivity.',
    });
  }, [isSuperAdmin, logSuperAdminAction, toast]);

  // Exit support mode
  const exitSupportMode = useCallback(async () => {
    // Stop impersonation first if active
    if (impersonation.isImpersonating) {
      await stopImpersonation();
    }

    setIsSupportModeActive(false);
    setSupportModeStartedAt(null);
    setSupportModeExpiresAt(null);
    setViewingOrgState({ orgId: null, orgName: null });

    await logSuperAdminAction('SUPPORT_MODE_EXITED');
  }, [impersonation.isImpersonating, logSuperAdminAction]);

  // Start impersonation
  const startImpersonation = useCallback(async (
    userId: string,
    userEmail: string,
    userName: string,
    orgId: string,
    orgName: string
  ) => {
    if (!isSuperAdmin || !isSupportModeActive) {
      toast({
        title: 'Access Denied',
        description: 'Impersonation requires active Support Mode.',
        variant: 'destructive',
      });
      return;
    }

    setImpersonation({
      isImpersonating: true,
      impersonatedUserId: userId,
      impersonatedUserEmail: userEmail,
      impersonatedUserName: userName,
      impersonatedOrgId: orgId,
      impersonatedOrgName: orgName,
      startedAt: new Date(),
    });

    await logSuperAdminAction(
      'IMPERSONATION_STARTED',
      'user',
      userId,
      orgId,
      { impersonated_email: userEmail, impersonated_name: userName }
    );

    toast({
      title: 'Impersonation Started',
      description: `Now viewing as ${userName || userEmail}`,
    });
  }, [isSuperAdmin, isSupportModeActive, logSuperAdminAction, toast]);

  // Stop impersonation
  const stopImpersonation = useCallback(async () => {
    if (impersonation.isImpersonating) {
      await logSuperAdminAction(
        'IMPERSONATION_ENDED',
        'user',
        impersonation.impersonatedUserId || undefined,
        impersonation.impersonatedOrgId || undefined,
        {
          impersonated_email: impersonation.impersonatedUserEmail,
          duration_seconds: impersonation.startedAt
            ? Math.floor((new Date().getTime() - impersonation.startedAt.getTime()) / 1000)
            : 0
        }
      );
    }

    setImpersonation({
      isImpersonating: false,
      impersonatedUserId: null,
      impersonatedUserEmail: null,
      impersonatedUserName: null,
      impersonatedOrgId: null,
      impersonatedOrgName: null,
      startedAt: null,
    });

    toast({
      title: 'Impersonation Ended',
      description: 'Returned to your admin view.',
    });
  }, [impersonation, logSuperAdminAction, toast]);

  // Set viewing org (for browsing without impersonation)
  const setViewingOrg = useCallback((orgId: string | null, orgName: string | null) => {
    setViewingOrgState({ orgId, orgName });
    if (orgId) {
      logSuperAdminAction('VIEWED_ORGANIZATION', 'organization', orgId, orgId, { org_name: orgName });
    }
  }, [logSuperAdminAction]);

  // Exit to platform view
  const exitToplatform = useCallback(() => {
    setViewingOrgState({ orgId: null, orgName: null });
    if (impersonation.isImpersonating) {
      stopImpersonation();
    }
  }, [impersonation.isImpersonating, stopImpersonation]);

  const value: SuperAdminContextType = {
    isSuperAdmin,
    isLoadingSuperAdmin,
    isSupportModeActive,
    supportModeStartedAt,
    supportModeExpiresAt,
    enterSupportMode,
    exitSupportMode,
    impersonation,
    startImpersonation,
    stopImpersonation,
    viewingOrg,
    setViewingOrg,
    exitToplatform,
    logSuperAdminAction,
    refreshSuperAdminStatus: checkSuperAdminStatus,
  };

  return (
    <SuperAdminContext.Provider value={value}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  const context = useContext(SuperAdminContext);
  if (context === undefined) {
    throw new Error('useSuperAdmin must be used within a SuperAdminProvider');
  }
  return context;
}

// Convenience hooks
export function useIsSuperAdmin() {
  const { isSuperAdmin, isLoadingSuperAdmin } = useSuperAdmin();
  return { isSuperAdmin, isLoading: isLoadingSuperAdmin };
}

export function useSupportMode() {
  const {
    isSupportModeActive,
    supportModeStartedAt,
    supportModeExpiresAt,
    enterSupportMode,
    exitSupportMode
  } = useSuperAdmin();
  return {
    isSupportModeActive,
    supportModeStartedAt,
    supportModeExpiresAt,
    enterSupportMode,
    exitSupportMode
  };
}

export function useImpersonation() {
  const {
    impersonation,
    startImpersonation,
    stopImpersonation,
    isSupportModeActive,
    isSuperAdmin
  } = useSuperAdmin();
  return {
    ...impersonation,
    startImpersonation,
    stopImpersonation,
    canImpersonate: isSuperAdmin && isSupportModeActive
  };
}
