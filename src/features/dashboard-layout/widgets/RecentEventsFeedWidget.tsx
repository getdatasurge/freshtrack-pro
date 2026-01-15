import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";
import type { WidgetProps } from "../types";

export function RecentEventsFeedWidget({ site }: WidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          Recent Events Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
        Live event feed coming soon
      </CardContent>
    </Card>
  );
}
