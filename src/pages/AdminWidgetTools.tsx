import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Eye, Settings } from "lucide-react";
import { LayoutManager } from "@/components/frostguard/layouts/LayoutManager";
import { WidgetPreview } from "@/components/frostguard/layouts/WidgetPreview";

const AdminWidgetTools = () => {
  const [activeTab, setActiveTab] = useState("layout-manager");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Widget Tools</h1>
          <p className="text-muted-foreground">
            Design default widget layouts and preview widgets
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="layout-manager">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Layout Manager
            </TabsTrigger>
            <TabsTrigger value="widget-preview">
              <Eye className="w-4 h-4 mr-2" />
              Widget Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="layout-manager" className="mt-4">
            <LayoutManager
              layouts={[]}
              onSave={(layout) => {
                // TODO: Wire to Supabase default_widget_layouts table
              }}
              onDelete={(layoutId) => {
                // TODO: Wire to Supabase
              }}
            />
          </TabsContent>

          <TabsContent value="widget-preview" className="mt-4">
            <WidgetPreview />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminWidgetTools;
