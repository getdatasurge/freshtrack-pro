import DashboardLayout from "@/components/DashboardLayout";
import { WidgetPreview } from "@/components/frostguard/layouts/WidgetPreview";

/**
 * Admin page for previewing individual widgets with mock data.
 * Select any widget from the registry and see it rendered at various states.
 */
const WidgetPreviewPage = () => {
  return (
    <DashboardLayout>
      <WidgetPreview />
    </DashboardLayout>
  );
};

export default WidgetPreviewPage;
