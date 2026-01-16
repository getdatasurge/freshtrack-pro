import { useState, useEffect, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthOnboardingState {
  isInitializing: boolean;
  isAuthenticated: boolean;
  isOnboardingComplete: boolean;
  isSuperAdmin: boolean;
  session: Session | null;
  organizationId: string | null;
}

/**
 * Unified hook for auth + onboarding state.
 * Prevents route flicker by ensuring both session and org status are resolved
 * before any routing decisions are made.
 */
export function useAuthAndOnboarding() {
  const [state, setState] = useState<AuthOnboardingState>({
    isInitializing: true,
    isAuthenticated: false,
    isOnboardingComplete: false,
    isSuperAdmin: false,
    session: null,
    organizationId: null,
  });

  const checkUserStatus = useCallback(async (userId: string) => {
    try {
      // Check profile and super admin status in parallel
      const [profileResult, superAdminResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.rpc('is_current_user_super_admin')
      ]);

      if (profileResult.error) {
        console.error("[useAuthAndOnboarding] Error checking profile:", profileResult.error);
      }

      const isSuperAdmin = superAdminResult.data === true;
      const organizationId = profileResult.data?.organization_id || null;
      
      return {
        organizationId,
        isComplete: !!organizationId,
        isSuperAdmin,
      };
    } catch (err) {
      console.error("[useAuthAndOnboarding] Exception checking user status:", err);
      return { organizationId: null, isComplete: false, isSuperAdmin: false };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!isMounted) return;

      if (!session?.user) {
        setState({
          isInitializing: false,
          isAuthenticated: false,
          isOnboardingComplete: false,
          isSuperAdmin: false,
          session: null,
          organizationId: null,
        });
        return;
      }

      // Session exists, check user status (profile + super admin)
      const { organizationId, isComplete, isSuperAdmin } = await checkUserStatus(session.user.id);
      
      if (!isMounted) return;

      setState({
        isInitializing: false,
        isAuthenticated: true,
        isOnboardingComplete: isComplete,
        isSuperAdmin,
        session,
        organizationId,
      });
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT" || !session?.user) {
          setState({
            isInitializing: false,
            isAuthenticated: false,
            isOnboardingComplete: false,
            isSuperAdmin: false,
            session: null,
            organizationId: null,
          });
          return;
        }

        // For sign in events, check user status
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          const { organizationId, isComplete, isSuperAdmin } = await checkUserStatus(session.user.id);
          
          if (!isMounted) return;

          setState({
            isInitializing: false,
            isAuthenticated: true,
            isOnboardingComplete: isComplete,
            isSuperAdmin,
            session,
            organizationId,
          });
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [checkUserStatus]);

  return state;
}
