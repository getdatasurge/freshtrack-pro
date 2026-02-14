import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DebugProvider } from "@/contexts/DebugContext";
import { TTNConfigProvider } from "@/contexts/TTNConfigContext";
import { SuperAdminProvider } from "@/contexts/SuperAdminContext";
import { UnitsProvider } from "@/contexts/UnitsContext";
import { DebugTerminal, RouteLogger } from "@/components/debug";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import OrganizationDashboard from "./pages/OrganizationDashboard";
import Onboarding from "./pages/Onboarding";
import Sites from "./pages/Sites";
import SiteDetail from "./pages/SiteDetail";
import AreaDetail from "./pages/AreaDetail";
import ManualLog from "./pages/ManualLog";
import Alerts from "./pages/Alerts";
import AlertAnalytics from "./pages/AlertAnalytics";
import UnitDetail from "./pages/UnitDetail";
import Units from "./pages/Units";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Inspector from "./pages/Inspector";
import PilotSetup from "./pages/PilotSetup";
import EventHistory from "./pages/EventHistory";
import RecentlyDeleted from "./pages/RecentlyDeleted";
import TTNCleanup from "./pages/TTNCleanup";
import DataMaintenance from "./pages/DataMaintenance";
import AccountDeleted from "./pages/AccountDeleted";
import HealthDashboard from "./pages/HealthDashboard";
import UploadTelnyxImage from "./pages/UploadTelnyxImage";
import AdminWidgetTools from "./pages/AdminWidgetTools";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import NotFound from "./pages/NotFound";
// Platform Admin pages (Super Admin only)
import PlatformOrganizations from "./pages/platform/PlatformOrganizations";
import PlatformOrganizationDetail from "./pages/platform/PlatformOrganizationDetail";
import PlatformUsers from "./pages/platform/PlatformUsers";
import PlatformUserDetail from "./pages/platform/PlatformUserDetail";
import PlatformAuditLog from "./pages/platform/PlatformAuditLog";
import PlatformDeveloperTools from "./pages/platform/PlatformDeveloperTools";
import PlatformSensorLibrary from "./pages/platform/PlatformSensorLibrary";
import PlatformDecoderConfidence from "./pages/platform/PlatformDecoderConfidence";
import PlatformQRProvisioning from "./pages/platform/PlatformQRProvisioning";
import PlatformGateways from "./pages/platform/PlatformGateways";
import { PlatformGuard, ImpersonationCacheSync } from "./components/platform";
import { RequireImpersonationGuard } from "./components/guards/RequireImpersonationGuard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus - prevents cascade of refetches when switching tabs
      refetchOnWindowFocus: false,
      // Keep data fresh for 30 seconds before considering it stale
      staleTime: 30 * 1000,
      // Retry failed requests once
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DebugProvider>
        <TTNConfigProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SuperAdminProvider>
            <UnitsProvider>
            <ImpersonationCacheSync />
            <RouteLogger />
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Main App Routes - Protected by RequireImpersonationGuard for Super Admins */}
            <Route path="/dashboard" element={<RequireImpersonationGuard><Dashboard /></RequireImpersonationGuard>} />
            <Route path="/organization" element={<RequireImpersonationGuard><OrganizationDashboard /></RequireImpersonationGuard>} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/sites" element={<RequireImpersonationGuard><Sites /></RequireImpersonationGuard>} />
            <Route path="/sites/:siteId/layout/:layoutKey" element={<RequireImpersonationGuard><SiteDetail /></RequireImpersonationGuard>} />
            <Route path="/sites/:siteId" element={<RequireImpersonationGuard><SiteDetail /></RequireImpersonationGuard>} />
            <Route path="/sites/:siteId/areas/:areaId" element={<RequireImpersonationGuard><AreaDetail /></RequireImpersonationGuard>} />
            <Route path="/units" element={<RequireImpersonationGuard><Units /></RequireImpersonationGuard>} />
            <Route path="/units/:unitId/layout/:layoutKey" element={<RequireImpersonationGuard><UnitDetail /></RequireImpersonationGuard>} />
            <Route path="/units/:unitId" element={<RequireImpersonationGuard><UnitDetail /></RequireImpersonationGuard>} />
            <Route path="/manual-log" element={<RequireImpersonationGuard><ManualLog /></RequireImpersonationGuard>} />
            <Route path="/alerts" element={<RequireImpersonationGuard><Alerts /></RequireImpersonationGuard>} />
            <Route path="/alert-analytics" element={<RequireImpersonationGuard><AlertAnalytics /></RequireImpersonationGuard>} />
            <Route path="/reports" element={<RequireImpersonationGuard><Reports /></RequireImpersonationGuard>} />
            <Route path="/settings" element={<RequireImpersonationGuard><Settings /></RequireImpersonationGuard>} />
            <Route path="/inspector" element={<RequireImpersonationGuard><Inspector /></RequireImpersonationGuard>} />
            <Route path="/pilot-setup" element={<RequireImpersonationGuard><PilotSetup /></RequireImpersonationGuard>} />
            <Route path="/events" element={<RequireImpersonationGuard><EventHistory /></RequireImpersonationGuard>} />
            <Route path="/admin/recently-deleted" element={<RequireImpersonationGuard><RecentlyDeleted /></RequireImpersonationGuard>} />
            <Route path="/admin/ttn-cleanup" element={<RequireImpersonationGuard><TTNCleanup /></RequireImpersonationGuard>} />
            <Route path="/admin/data-maintenance" element={<RequireImpersonationGuard><DataMaintenance /></RequireImpersonationGuard>} />
            <Route path="/admin/health" element={<RequireImpersonationGuard><HealthDashboard /></RequireImpersonationGuard>} />
            <Route path="/admin/upload-telnyx-image" element={<RequireImpersonationGuard><UploadTelnyxImage /></RequireImpersonationGuard>} />
            <Route path="/admin/widget-tools" element={<RequireImpersonationGuard><AdminWidgetTools /></RequireImpersonationGuard>} />
            <Route path="/account-deleted" element={<AccountDeleted />} />
              {/* Platform Admin Routes (Super Admin only) */}
              <Route path="/platform" element={<PlatformGuard><PlatformOrganizations /></PlatformGuard>} />
              <Route path="/platform/organizations" element={<PlatformGuard><PlatformOrganizations /></PlatformGuard>} />
              <Route path="/platform/organizations/:orgId" element={<PlatformGuard><PlatformOrganizationDetail /></PlatformGuard>} />
              <Route path="/platform/users" element={<PlatformGuard><PlatformUsers /></PlatformGuard>} />
              <Route path="/platform/users/:userId" element={<PlatformGuard><PlatformUserDetail /></PlatformGuard>} />
              <Route path="/platform/audit" element={<PlatformGuard><PlatformAuditLog /></PlatformGuard>} />
              <Route path="/platform/developer-tools" element={<PlatformGuard><PlatformDeveloperTools /></PlatformGuard>} />
              <Route path="/platform/sensor-library" element={<PlatformGuard><PlatformSensorLibrary /></PlatformGuard>} />
              <Route path="/platform/qr-provisioning" element={<PlatformGuard><PlatformQRProvisioning /></PlatformGuard>} />
              <Route path="/platform/gateways" element={<PlatformGuard><PlatformGateways /></PlatformGuard>} />
              <Route path="/platform/decoder-confidence" element={<PlatformGuard><PlatformDecoderConfidence /></PlatformGuard>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <DebugTerminal />
            </UnitsProvider>
            </SuperAdminProvider>
          </BrowserRouter>
        </TTNConfigProvider>
      </DebugProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
