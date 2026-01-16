import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DebugProvider } from "@/contexts/DebugContext";
import { TTNConfigProvider } from "@/contexts/TTNConfigContext";
import { SuperAdminProvider } from "@/contexts/SuperAdminContext";
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
import { PlatformGuard } from "./components/platform";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DebugProvider>
        <TTNConfigProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SuperAdminProvider>
            <RouteLogger />
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/organization" element={<OrganizationDashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/sites" element={<Sites />} />
            <Route path="/sites/:siteId/layout/:layoutKey" element={<SiteDetail />} />
            <Route path="/sites/:siteId" element={<SiteDetail />} />
            <Route path="/sites/:siteId/areas/:areaId" element={<AreaDetail />} />
            <Route path="/units" element={<Units />} />
            <Route path="/units/:unitId/layout/:layoutKey" element={<UnitDetail />} />
            <Route path="/units/:unitId" element={<UnitDetail />} />
            <Route path="/manual-log" element={<ManualLog />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/inspector" element={<Inspector />} />
            <Route path="/pilot-setup" element={<PilotSetup />} />
            <Route path="/events" element={<EventHistory />} />
            <Route path="/admin/recently-deleted" element={<RecentlyDeleted />} />
            <Route path="/admin/ttn-cleanup" element={<TTNCleanup />} />
            <Route path="/admin/data-maintenance" element={<DataMaintenance />} />
            <Route path="/admin/health" element={<HealthDashboard />} />
            <Route path="/admin/upload-telnyx-image" element={<UploadTelnyxImage />} />
            <Route path="/account-deleted" element={<AccountDeleted />} />
              {/* Platform Admin Routes (Super Admin only) */}
              <Route path="/platform" element={<PlatformGuard><PlatformOrganizations /></PlatformGuard>} />
              <Route path="/platform/organizations" element={<PlatformGuard><PlatformOrganizations /></PlatformGuard>} />
              <Route path="/platform/organizations/:orgId" element={<PlatformGuard><PlatformOrganizationDetail /></PlatformGuard>} />
              <Route path="/platform/users" element={<PlatformGuard><PlatformUsers /></PlatformGuard>} />
              <Route path="/platform/users/:userId" element={<PlatformGuard><PlatformUserDetail /></PlatformGuard>} />
              <Route path="/platform/audit" element={<PlatformGuard><PlatformAuditLog /></PlatformGuard>} />
              <Route path="/platform/developer-tools" element={<PlatformGuard><PlatformDeveloperTools /></PlatformGuard>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SuperAdminProvider>
          </BrowserRouter>
          <DebugTerminal />
        </TTNConfigProvider>
      </DebugProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
