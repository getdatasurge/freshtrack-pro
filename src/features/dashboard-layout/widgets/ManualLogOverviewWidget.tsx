import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";
import type { WidgetProps } from "../types";

export function ManualLogOverviewWidget({ site }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Manual Log Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
        Site-wide manual log status coming soon
      </CardContent>
    </Card>
  );
}
