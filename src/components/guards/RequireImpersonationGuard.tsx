import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, UserX, ArrowRight, Loader2 } from 'lucide-react';

interface RequireImpersonationGuardProps {
  children: ReactNode;
}

/**
 * Guard component that blocks Super Admins from accessing Main App routes
 * unless they have an active impersonation session.
 * 
 * For normal users, this is a pass-through (renders children directly).
 * For Super Admins without impersonation, shows a blocking message with CTA.
 */
export function RequireImpersonationGuard({ children }: RequireImpersonationGuardProps) {
  const { isSuperAdmin, isSupportModeActive } = useSuperAdmin();
  const { isImpersonating, isInitialized } = useEffectiveIdentity();

  // Still loading - show loading state
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not a Super Admin - allow access (normal user flow)
  if (!isSuperAdmin) {
    return <>{children}</>;
  }

  // Super Admin with active impersonation - allow access
  if (isImpersonating) {
    return <>{children}</>;
  }

  // Super Admin without impersonation - block access
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
            <UserX className="w-8 h-8 text-orange-600" />
          </div>
          <CardTitle className="text-xl">Main App Access Restricted</CardTitle>
          <CardDescription className="text-base mt-2">
            Super Admins cannot access the main application directly. 
            You must impersonate a user to view their experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-medium">Why this restriction?</span>
                <br />
                Super Admins have elevated privileges that could affect all organizations. 
                Impersonation ensures you see exactly what a specific user sees, 
                with proper data scoping and audit logging.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isSupportModeActive ? (
              <Link to="/platform/users" className="w-full">
                <Button className="w-full" variant="default">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Select a User to Impersonate
                </Button>
              </Link>
            ) : (
              <Link to="/platform" className="w-full">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  <Shield className="w-4 h-4 mr-2" />
                  Go to Platform Admin
                </Button>
              </Link>
            )}
            
            <Link to="/platform" className="w-full">
              <Button variant="outline" className="w-full">
                Back to Platform Admin
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
