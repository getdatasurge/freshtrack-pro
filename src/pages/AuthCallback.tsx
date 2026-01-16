import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Thermometer } from "lucide-react";
import { useAuthAndOnboarding } from "@/hooks/useAuthAndOnboarding";

/**
 * Auth callback page - handles post-authentication routing.
 * Shows a minimal loading UI while determining where to redirect the user.
 * This prevents the dashboard from flashing before onboarding redirects.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { isInitializing, isAuthenticated, isOnboardingComplete, isSuperAdmin } = useAuthAndOnboarding();

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
    } else if (isSuperAdmin) {
      // Super admins go directly to platform admin
      navigate("/platform", { replace: true });
    } else if (!isOnboardingComplete) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [isInitializing, isAuthenticated, isOnboardingComplete, isSuperAdmin, navigate]);

  return (
    <div className="min-h-screen bg-gradient-frost flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
          <Thermometer className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-foreground">FrostGuard</span>
      </div>
      
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
        <p className="mt-4 text-muted-foreground">Finishing sign-in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
