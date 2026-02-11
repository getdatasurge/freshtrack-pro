import { ReactNode, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Shield,
  Building2,
  Users,
  FileText,
  Wrench,
  Menu,
  X,
  ChevronLeft,
  Home,
  Headphones,
  BookOpen,
  Activity,
  QrCode,
  Radio,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import BrandedLogo from "@/components/BrandedLogo";
import { SupportModeBanner } from "./SupportModeBanner";
import { GlobalUserSearch } from "./GlobalUserSearch";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlatformLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
}

const platformNavItems = [
  { href: "/platform/organizations", label: "Organizations", icon: Building2 },
  { href: "/platform/users", label: "Users", icon: Users },
  { href: "/platform/sensor-library", label: "Sensor Library", icon: BookOpen },
  { href: "/platform/qr-provisioning", label: "QR Provisioning", icon: QrCode },
  { href: "/platform/gateways", label: "Gateways", icon: Radio },
  { href: "/platform/decoder-confidence", label: "Decoder Confidence", icon: Activity },
  { href: "/platform/audit", label: "Audit Log", icon: FileText },
  { href: "/platform/developer-tools", label: "Developer Tools", icon: Wrench },
];

export default function PlatformLayout({ children, title, showBack, backHref }: PlatformLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const {
    isSuperAdmin,
    isLoadingSuperAdmin,
    isSupportModeActive,
    enterSupportMode,
    viewingOrg,
    exitToplatform
  } = useSuperAdmin();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showEnterSupportModeDialog, setShowEnterSupportModeDialog] = useState(false);

  // Redirect non-super-admins
  useEffect(() => {
    if (!isLoadingSuperAdmin && !isSuperAdmin) {
      toast({
        title: "Access Denied",
        description: "Platform Admin access requires Super Admin privileges.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  }, [isSuperAdmin, isLoadingSuperAdmin, navigate, toast]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      navigate("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleEnterSupportMode = async () => {
    setShowEnterSupportModeDialog(false);
    await enterSupportMode();
  };

  if (isLoadingSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Verifying access...</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Support Mode Banner */}
      <SupportModeBanner />

      {/* Header */}
      <header
        className={cn(
          "sticky z-50 glass border-b border-border/50",
          isSupportModeActive ? "top-10" : "top-0"
        )}
      >
        <div className="flex h-16">
          {/* Left section - fixed width matching sidebar on desktop */}
          <div className="hidden lg:flex items-center w-64 px-4 shrink-0">
            <Link to="/platform" className="flex items-center gap-3">
              <BrandedLogo showText={true} size="md" />
              <div className="flex items-center gap-2 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Platform Admin
                </span>
              </div>
            </Link>
          </div>

          {/* Right section - full-width with matching gutters */}
          <div className="flex-1 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {showBack && backHref ? (
                <Link to={backHref}>
                  <Button variant="ghost" size="icon" className="mr-2">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                >
                  {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              )}

              {/* Mobile logo - only show on mobile */}
              <Link to="/platform" className="flex lg:hidden items-center gap-3">
                <BrandedLogo showText={true} size="md" />
                <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                  <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Platform Admin
                  </span>
                </div>
              </Link>

              {viewingOrg.orgId && (
                <div className="hidden sm:flex items-center gap-2 ml-4">
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">
                    Viewing: <strong>{viewingOrg.orgName}</strong>
                  </span>
                  <Button variant="ghost" size="sm" onClick={exitToplatform}>
                    <X className="w-3 h-3 mr-1" />
                    Exit
                  </Button>
                </div>
              )}

              {/* Global User Search - Support Mode only */}
              {isSupportModeActive && (
                <div className="hidden md:block ml-4">
                  <GlobalUserSearch />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isSupportModeActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEnterSupportModeDialog(true)}
                  className="hidden sm:flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30"
                >
                  <Headphones className="w-4 h-4" />
                  Enter Support Mode
                </Button>
              )}

              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="hidden sm:flex">
                  <Home className="w-4 h-4 mr-2" />
                  Main App
                </Button>
              </Link>

              <ThemeToggle />

              <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:flex">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex w-64 flex-col fixed left-0 bottom-0 border-r border-border/50 bg-card/50",
            isSupportModeActive ? "top-[104px]" : "top-16"
          )}
        >
          <nav className="flex-1 p-4 space-y-1">
            {platformNavItems.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== "/platform" && location.pathname.startsWith(item.href));
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border/50">
            <Link to="/dashboard">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Home className="w-5 h-5" />
                Back to Main App
              </Button>
            </Link>
          </div>
        </aside>

        {/* Mobile Nav Overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside
              className={cn(
                "absolute left-0 bottom-0 w-64 bg-card border-r border-border/50 p-4",
                isSupportModeActive ? "top-[104px]" : "top-16"
              )}
            >
              <nav className="space-y-1">
                {platformNavItems.map((item) => {
                  const isActive = location.pathname === item.href ||
                    (item.href !== "/platform" && location.pathname.startsWith(item.href));
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
                          isActive && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-border/50 space-y-2">
                  {!isSupportModeActive && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 border-purple-300 text-purple-700"
                      onClick={() => {
                        setMobileNavOpen(false);
                        setShowEnterSupportModeDialog(true);
                      }}
                    >
                      <Headphones className="w-5 h-5" />
                      Enter Support Mode
                    </Button>
                  )}

                  <Link to="/dashboard" onClick={() => setMobileNavOpen(false)}>
                    <Button variant="outline" className="w-full justify-start gap-3">
                      <Home className="w-5 h-5" />
                      Back to Main App
                    </Button>
                  </Link>
                </div>
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main
          className={cn(
            "flex-1 lg:ml-64 min-w-0 overflow-x-hidden",
            isSupportModeActive && "pt-10"
          )}
        >
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            {title && (
              <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Enter Support Mode Confirmation Dialog */}
      <Dialog open={showEnterSupportModeDialog} onOpenChange={setShowEnterSupportModeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-purple-600" />
              Enter Support Mode
            </DialogTitle>
            <DialogDescription>
              Support Mode enables privileged diagnostic tools and user impersonation capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-amber-800 dark:text-amber-200">
                  All actions will be logged
                </div>
                <div className="text-amber-700 dark:text-amber-300">
                  Every action taken in Support Mode is recorded in the audit log with your identity.
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>Support Mode will auto-expire after 30 minutes of inactivity</li>
                <li>You can exit at any time using the banner at the top</li>
                <li>User impersonation requires explicit activation</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnterSupportModeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnterSupportMode}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Headphones className="w-4 h-4 mr-2" />
              Enter Support Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
