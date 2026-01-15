import { useState, useEffect, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthOnboardingState {
  isInitializing: boolean;
  isAuthenticated: boolean;
  isOnboardingComplete: boolean;
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
    session: null,
    organizationId: null,
  });

  const checkOnboardingStatus = useCallback(async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[useAuthAndOnboarding] Error checking profile:", error);
        return { organizationId: null, isComplete: false };
      }

      return {
        organizationId: profile?.organization_id || null,
        isComplete: !!profile?.organization_id,
      };
    } catch (err) {
      console.error("[useAuthAndOnboarding] Exception checking profile:", err);
      return { organizationId: null, isComplete: false };
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
          session: null,
          organizationId: null,
        });
        return;
      }

      // Session exists, check onboarding status
      const { organizationId, isComplete } = await checkOnboardingStatus(session.user.id);
      
      if (!isMounted) return;

      setState({
        isInitializing: false,
        isAuthenticated: true,
        isOnboardingComplete: isComplete,
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
            session: null,
            organizationId: null,
          });
          return;
        }

        // For sign in events, check onboarding status
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          const { organizationId, isComplete } = await checkOnboardingStatus(session.user.id);
          
          if (!isMounted) return;

          setState({
            isInitializing: false,
            isAuthenticated: true,
            isOnboardingComplete: isComplete,
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
  }, [checkOnboardingStatus]);

  return state;
}
