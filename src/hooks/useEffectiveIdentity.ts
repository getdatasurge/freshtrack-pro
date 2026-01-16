/**
 * useEffectiveIdentity Hook
 * 
 * Single source of truth for "who is the current effective user/org" for data fetching.
 * When a Super Admin is impersonating a user, this returns the impersonated user's
 * identity. Otherwise, returns the real authenticated user's identity.
 * 
 * This hook should be used by all data-fetching components to ensure proper scoping.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';

export interface EffectiveIdentity {
  // Effective identity (impersonated if active, else real user)
  effectiveUserId: string | null;
  effectiveOrgId: string | null;
  effectiveOrgName: string | null;
  effectiveUserEmail: string | null;
  effectiveUserName: string | null;
  
  // Real user identity (always the authenticated user)
  realUserId: string | null;
  realOrgId: string | null;
  
  // Impersonation metadata
  isImpersonating: boolean;
  impersonationExpiresAt: Date | null;
  impersonationSessionId: string | null;
  
  // Loading state
  isLoading: boolean;
  isInitialized: boolean;
  impersonationChecked: boolean; // True after server-side impersonation check completes
  
  // Actions
  refresh: () => Promise<void>;
}

const IMPERSONATION_STORAGE_KEY = 'ftp_impersonation_session';

interface StoredImpersonation {
  sessionId: string;
  targetUserId: string;
  targetOrgId: string;
  targetUserEmail: string | null;
  targetUserName: string | null;
  targetOrgName: string | null;
  expiresAt: string;
}

export function useEffectiveIdentity(): EffectiveIdentity {
  const { 
    isSuperAdmin, 
    rolesLoaded, 
    impersonation, 
    isSupportModeActive 
  } = useSuperAdmin();
  
  const [realUserId, setRealUserId] = useState<string | null>(null);
  const [realOrgId, setRealOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [impersonationChecked, setImpersonationChecked] = useState(false);
  
  // Server-validated impersonation state
  const [serverImpersonation, setServerImpersonation] = useState<{
    sessionId: string;
    targetUserId: string;
    targetOrgId: string;
    targetUserEmail: string | null;
    targetUserName: string | null;
    targetOrgName: string | null;
    expiresAt: Date;
  } | null>(null);

  // Load real user identity
  const loadRealIdentity = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRealUserId(null);
        setRealOrgId(null);
        return;
      }
      
      setRealUserId(user.id);
      
      // Get user's org from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setRealOrgId(profile?.organization_id || null);
    } catch (err) {
      console.error('Error loading real identity:', err);
    }
  }, []);

  // Validate and restore server-side impersonation session
  const validateServerImpersonation = useCallback(async () => {
    if (!isSuperAdmin || !isSupportModeActive) {
      setServerImpersonation(null);
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      return null;
    }

    try {
      // Check for active server-side session
      const { data, error } = await supabase.rpc('get_active_impersonation');
      
      if (error) {
        console.error('Error checking impersonation session:', error);
        setServerImpersonation(null);
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        return null;
      }
      
      if (data && data.length > 0) {
        const session = data[0];
        const impersonationData = {
          sessionId: session.session_id,
          targetUserId: session.target_user_id,
          targetOrgId: session.target_org_id,
          targetUserEmail: session.target_user_email,
          targetUserName: session.target_user_name,
          targetOrgName: session.target_org_name,
          expiresAt: new Date(session.expires_at),
        };
        
        setServerImpersonation(impersonationData);
        
        // Persist to localStorage for page refresh
        localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify({
          ...impersonationData,
          expiresAt: impersonationData.expiresAt.toISOString(),
        }));
        
        return impersonationData;
      } else {
        setServerImpersonation(null);
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        return null;
      }
    } catch (err) {
      console.error('Error validating impersonation:', err);
      setServerImpersonation(null);
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      return null;
    }
  }, [isSuperAdmin, isSupportModeActive]);

  // Restore from localStorage on mount (before server validation)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
      if (stored) {
        const parsed: StoredImpersonation = JSON.parse(stored);
        const expiresAt = new Date(parsed.expiresAt);
        
        // Only restore if not expired
        if (expiresAt > new Date()) {
          setServerImpersonation({
            ...parsed,
            expiresAt,
          });
        } else {
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        }
      }
    } catch (err) {
      console.error('Error restoring impersonation from storage:', err);
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    }
  }, []);

  // Initialize identity
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setImpersonationChecked(false);
    try {
      await loadRealIdentity();
      if (rolesLoaded && isSuperAdmin && isSupportModeActive) {
        await validateServerImpersonation();
      }
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
      setImpersonationChecked(true); // Mark impersonation check as complete
    }
  }, [loadRealIdentity, validateServerImpersonation, rolesLoaded, isSuperAdmin, isSupportModeActive]);

  // Initial load and when auth/roles change
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sync with SuperAdminContext impersonation state
  useEffect(() => {
    // If context says we're impersonating but we don't have server state, validate
    if (impersonation.isImpersonating && !serverImpersonation && rolesLoaded) {
      validateServerImpersonation();
    }
    
    // If context says we're NOT impersonating but we have server state, clear it
    if (!impersonation.isImpersonating && serverImpersonation) {
      setServerImpersonation(null);
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    }
  }, [impersonation.isImpersonating, serverImpersonation, rolesLoaded, validateServerImpersonation]);

  // Determine effective identity
  const isImpersonating = Boolean(
    isSuperAdmin && 
    isSupportModeActive && 
    (serverImpersonation || impersonation.isImpersonating)
  );

  // Use server impersonation data if available, fallback to context state
  const effectiveUserId = isImpersonating 
    ? (serverImpersonation?.targetUserId || impersonation.impersonatedUserId)
    : realUserId;
    
  const effectiveOrgId = isImpersonating 
    ? (serverImpersonation?.targetOrgId || impersonation.impersonatedOrgId)
    : realOrgId;
    
  const effectiveOrgName = isImpersonating 
    ? (serverImpersonation?.targetOrgName || impersonation.impersonatedOrgName)
    : null;
    
  const effectiveUserEmail = isImpersonating 
    ? (serverImpersonation?.targetUserEmail || impersonation.impersonatedUserEmail)
    : null;
    
  const effectiveUserName = isImpersonating 
    ? (serverImpersonation?.targetUserName || impersonation.impersonatedUserName)
    : null;

  return {
    effectiveUserId,
    effectiveOrgId,
    effectiveOrgName,
    effectiveUserEmail,
    effectiveUserName,
    realUserId,
    realOrgId,
    isImpersonating,
    impersonationExpiresAt: serverImpersonation?.expiresAt || null,
    impersonationSessionId: serverImpersonation?.sessionId || null,
    isLoading,
    isInitialized,
    impersonationChecked,
    refresh,
  };
}
