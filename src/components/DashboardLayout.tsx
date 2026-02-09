import { ReactNode, useEffect, useState, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LogOut,
  MapPin,
  Settings,
  LayoutGrid,
  Building2,
  Menu,
  X,
  ChevronLeft,
  Trash2,
  Shield,
  Wrench,
} from "lucide-react";
import { SidebarSitesAccordion, SidebarUnitsAccordion } from "@/components/sidebar";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import BrandedLogo from "@/components/BrandedLogo";
import NotificationDropdown from "@/components/NotificationDropdown";
import { clearOfflineStorage } from "@/lib/offlineStorage";
import { usePermissions } from "@/hooks/useUserRole";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { SupportModeBanner, ImpersonationBanner } from "@/components/platform/SupportModeBanner";
import { SupportDiagnosticsPanel } from "@/components/platform/SupportDiagnosticsPanel";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
}

import { ClipboardList, AlertCircle, FileBarChart, Boxes } from "lucide-react";

// Nav items - Sites and Units handled separately via accordions
const navItemsBeforeAccordions = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/organization", label: "Organization", icon: Building2 },
];

const navItemsAfterAccordions = [
  { href: "/manual-log", label: "Log Temps", icon: ClipboardList },
  { href: "/alerts", label: "Alerts", icon: AlertCircle },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

const DashboardLayout = ({ children, title, showBack, backHref }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canDeleteEntities, isLoading: permissionsLoading } = usePermissions();
  const { isSuperAdmin, isLoadingSuperAdmin, rolesLoaded, isSupportModeActive, impersonation, viewingOrg } = useSuperAdmin();
  const { effectiveOrgId, effectiveOrgName, isImpersonating, isInitialized, impersonationChecked } = useEffectiveIdentity();
  const [session, setSession] = useState<Session | null>(null);
  const [realOrgId, setRealOrgId] = useState<string | null>(null);
  const [realOrgName, setRealOrgName] = useState("");
  const [alertCount, setAlertCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Use effectiveOrgId directly for sidebar - it already handles impersonation internally
  // The hook returns impersonated org when impersonating, real org otherwise
  // Keep a stable reference to prevent sidebar flicker when org is temporarily null
  const lastValidOrgIdRef = useRef<string | null>(null);
  if (effectiveOrgId) {
    lastValidOrgIdRef.current = effectiveOrgId;
  }
  // Use the current effectiveOrgId if available, otherwise fall back to last known valid value
  const sidebarOrgId = effectiveOrgId || lastValidOrgIdRef.current;
  const displayOrgName = effectiveOrgName || realOrgName;

  // Debug logging for impersonation state changes (only log when value actually changes)
  const prevOrgIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevOrgIdRef.current !== effectiveOrgId) {
      console.warn('[DashboardLayout] Sidebar org:', sidebarOrgId, 'effectiveOrgId:', effectiveOrgId, 'isImpersonating:', isImpersonating);
      prevOrgIdRef.current = effectiveOrgId;
    }
  }, [sidebarOrgId, effectiveOrgId, isImpersonating]);

  // Redirect platform-only super admins to /platform (only when NOT in support mode / impersonating)
  useEffect(() => {
    // Wait for roles, effective identity, and impersonation check to complete
    if (!rolesLoaded || !isInitialized || !impersonationChecked) return;
    
    // Add a small delay to allow impersonation state to propagate after navigation
    const timeoutId = setTimeout(() => {
      // Allow main app access if:
      // 1. Not a super admin (regular user)
      // 2. Support mode is active (viewing as org)
      // 3. Actively impersonating a user
      // 4. Viewing an org (even without full impersonation)
      const hasOrgContext = isImpersonating || impersonation.isImpersonating || isSupportModeActive || viewingOrg.orgId;
      
      if (isSuperAdmin && !hasOrgContext) {
        // Super admin accessing main app without any org context → redirect to platform
        navigate("/platform", { replace: true });
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [rolesLoaded, isSuperAdmin, isImpersonating, impersonation.isImpersonating, isSupportModeActive, viewingOrg.orgId, isInitialized, impersonationChecked, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        // If user explicitly signed out, go to landing page
        // If session was never there (initial load), go to auth
        if (event === 'SIGNED_OUT') {
          navigate("/");
        } else {
          navigate("/auth");
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load real user's org data (for non-impersonation mode)
  useEffect(() => {
    if (session?.user && !isImpersonating) {
      // Normal user - load their org data
      loadOrgData();
    }
  }, [session, isImpersonating]);

  // Load alert count for the effective org (works for both real and impersonated)
  useEffect(() => {
    const orgToUse = sidebarOrgId;
    if (orgToUse) {
      loadAlertCount(orgToUse);
    }
  }, [sidebarOrgId]);

  const loadAlertCount = async (targetOrgId: string) => {
    const { count } = await supabase
      .from("alerts")
      .select("id", { count: "exact" })
      .eq("organization_id", targetOrgId)
      .eq("status", "active")
      .limit(0);
    setAlertCount(count || 0);
  };

  const loadOrgData = async () => {
    if (!session?.user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profile?.organization_id) {
      setRealOrgId(profile.organization_id);

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (org) setRealOrgName(org.name);
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear React Query cache BEFORE signing out for session isolation
      queryClient.clear();
      
      // Clear IndexedDB offline storage
      await clearOfflineStorage();

      // Reset component state
      setRealOrgId(null);
      setRealOrgName("");
      setAlertCount(0);
      
      // Sign out from Supabase - auth listener will handle navigation
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({ 
          title: "Sign out failed", 
          description: error.message,
          variant: "destructive" 
        });
        return;
      }
      
      toast({ title: "Signed out successfully" });
      // Navigation handled by onAuthStateChange listener
    } catch (err) {
      console.error('Sign out error:', err);
      toast({ 
        title: "Sign out failed", 
        description: "An unexpected error occurred",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Support Mode Banner for Super Admins */}
      <SupportModeBanner />
      <ImpersonationBanner />

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="flex h-16">
          {/* Left section - fixed width matching sidebar on desktop */}
          <div className="hidden lg:flex items-center w-64 px-4 shrink-0">
            <Link to="/dashboard" className="flex items-center gap-3">
              <BrandedLogo showText={true} size="md" />
            </Link>
          </div>
          
          {/* Right section - main content area header with matching gutters */}
          <div className="flex-1 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Mobile: hamburger + logo */}
            <div className="flex items-center gap-3 lg:hidden">
              {showBack && backHref ? (
                <Link to={backHref}>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="shrink-0"
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                >
                  {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              )}
              <Link to="/dashboard">
                <BrandedLogo showText={true} size="md" />
              </Link>
            </div>

            {/* Desktop: org name + back button if needed */}
            <div className="hidden lg:flex items-center gap-3 min-w-0">
              {showBack && backHref && (
                <Link to={backHref}>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </Link>
              )}
              {displayOrgName && (
                <Link
                  to="/organization"
                  className="text-sm text-muted-foreground font-medium truncate hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm transition-colors"
                  title={`Go to ${displayOrgName} overview`}
                >
                  {displayOrgName}
                </Link>
              )}
            </div>

            {/* Frost Pill Divider - desktop only */}
            <div 
              className="hidden lg:block w-0.5 h-8 mx-4 rounded-full bg-muted-foreground/30 shadow-[0_0_8px_hsl(192_85%_45%/0.15)] transition-all duration-200 hover:bg-muted-foreground/50 hover:shadow-[0_0_12px_hsl(192_85%_45%/0.35)] motion-reduce:transition-none"
              aria-hidden="true"
            />

            {/* Right side actions with backplate */}
            <div className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/30 transition-colors duration-200 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring/20">
              <ThemeToggle />
              <NotificationDropdown alertCount={alertCount} />
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:flex">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="sm:hidden">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col fixed left-0 top-16 bottom-0 border-r border-border/50 bg-card/50">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {/* Nav items before accordions */}
            {navItemsBeforeAccordions.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-accent/10 text-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            {/* Sites Accordion */}
            <SidebarSitesAccordion organizationId={sidebarOrgId} />

            {/* Units Accordion */}
            <SidebarUnitsAccordion organizationId={sidebarOrgId} />

            {/* Nav items after accordions */}
            {navItemsAfterAccordions.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-accent/10 text-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            {canDeleteEntities && !permissionsLoading && (
              <Link to="/admin/recently-deleted">
                <Button
                  variant={location.pathname === "/admin/recently-deleted" ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 mt-4 pt-4 border-t border-border/50",
                    location.pathname === "/admin/recently-deleted" && "bg-accent/10 text-accent"
                  )}
                >
                  <Trash2 className="w-5 h-5" />
                  Recently Deleted
                </Button>
              </Link>
            )}
            {/* Admin Widget Tools - Desktop */}
            {rolesLoaded && isSuperAdmin && (
              <>
                <div className={cn("mt-3 mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60", !canDeleteEntities && "mt-4 pt-4 border-t border-border/50")}>
                  Admin Tools
                </div>
                {[
                  { href: "/admin/widget-builder", label: "Widget Builder" },
                  { href: "/admin/layout-manager", label: "Layout Manager" },
                  { href: "/admin/widget-preview", label: "Widget Preview" },
                ].map((item) => (
                  <Link key={item.href} to={item.href}>
                    <Button
                      variant={location.pathname === item.href ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3",
                        location.pathname === item.href && "bg-accent/10 text-accent"
                      )}
                      size="sm"
                    >
                      <Wrench className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </>
            )}
            {/* Platform Admin Link - Desktop */}
            {isLoadingSuperAdmin && (
              <div className="mt-2 px-1">
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            )}
            {rolesLoaded && isSuperAdmin && (
              <Link to="/platform">
                <Button
                  variant={location.pathname.startsWith("/platform") ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 mt-2",
                    !canDeleteEntities && "mt-4 pt-4 border-t border-border/50",
                    location.pathname.startsWith("/platform") && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  )}
                >
                  <Shield className="w-5 h-5" />
                  Platform Admin
                </Button>
              </Link>
            )}
          </nav>
        </aside>

        {/* Mobile Nav Overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="absolute left-0 top-16 bottom-0 w-64 bg-card border-r border-border/50 p-4 overflow-y-auto">
              <nav className="space-y-1">
                {/* Nav items before accordions */}
                {navItemsBeforeAccordions.map((item) => {
                  const isActive = location.pathname === item.href || 
                    (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
                  return (
                    <Link 
                      key={item.href} 
                      to={item.href}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3",
                          isActive && "bg-accent/10 text-accent"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}

                {/* Sites Accordion (Mobile) */}
                <SidebarSitesAccordion organizationId={sidebarOrgId} />

                {/* Units Accordion (Mobile) */}
                <SidebarUnitsAccordion organizationId={sidebarOrgId} />

                {/* Nav items after accordions */}
                {navItemsAfterAccordions.map((item) => {
                  const isActive = location.pathname === item.href || 
                    (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
                  return (
                    <Link 
                      key={item.href} 
                      to={item.href}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3",
                          isActive && "bg-accent/10 text-accent"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}

                {canDeleteEntities && !permissionsLoading && (
                  <Link
                    to="/admin/recently-deleted"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Button
                      variant={location.pathname === "/admin/recently-deleted" ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 mt-4 pt-4 border-t border-border/50",
                        location.pathname === "/admin/recently-deleted" && "bg-accent/10 text-accent"
                      )}
                    >
                      <Trash2 className="w-5 h-5" />
                      Recently Deleted
                    </Button>
                  </Link>
                )}
                {/* Admin Widget Tools - Mobile */}
                {rolesLoaded && isSuperAdmin && (
                  <>
                    <div className={cn("mt-3 mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60", !canDeleteEntities && "mt-4 pt-4 border-t border-border/50")}>
                      Admin Tools
                    </div>
                    {[
                      { href: "/admin/widget-builder", label: "Widget Builder" },
                      { href: "/admin/layout-manager", label: "Layout Manager" },
                      { href: "/admin/widget-preview", label: "Widget Preview" },
                    ].map((item) => (
                      <Link key={item.href} to={item.href} onClick={() => setMobileNavOpen(false)}>
                        <Button
                          variant={location.pathname === item.href ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start gap-3",
                            location.pathname === item.href && "bg-accent/10 text-accent"
                          )}
                          size="sm"
                        >
                          <Wrench className="w-4 h-4" />
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </>
                )}
                {/* Platform Admin Link - Mobile */}
                {isLoadingSuperAdmin && (
                  <div className="mt-2 px-1">
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                )}
                {rolesLoaded && isSuperAdmin && (
                  <Link
                    to="/platform"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Button
                      variant={location.pathname.startsWith("/platform") ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 mt-2",
                        !canDeleteEntities && "mt-4 pt-4 border-t border-border/50",
                        location.pathname.startsWith("/platform") && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      )}
                    >
                      <Shield className="w-5 h-5" />
                      Platform Admin
                    </Button>
                  </Link>
                )}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 min-w-0 overflow-x-hidden">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            {title && (
              <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>
            )}
            {children}
          </div>
        </main>
        
        {/* Support Diagnostics Panel - visible only to Super Admins in support mode */}
        <SupportDiagnosticsPanel />
      </div>
    </div>
  );
};

export default DashboardLayout;
