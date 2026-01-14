/**
 * Quick Actions Widget
 * 
 * Provides quick action buttons for common operations.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Thermometer, BellOff, MessageSquare, CheckCircle2 } from "lucide-react";
import type { WidgetProps } from "../types";
import { toast } from "sonner";

export function QuickActionsWidget({ onLogTemp, alerts = [] }: WidgetProps) {
  const hasActiveAlerts = alerts.length > 0;

  const handleLogTemp = () => {
    if (onLogTemp) {
      onLogTemp();
    } else {
      toast.info("Log temperature modal not available");
    }
  };

  const handleAcknowledge = () => {
    toast.info("Alert acknowledgement coming soon");
  };

  const handleSnooze = () => {
    toast.info("Alert snooze coming soon");
  };

  const handleAddNote = () => {
    toast.info("Add note coming soon");
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-auto py-3"
            onClick={handleLogTemp}
          >
            <Thermometer className="h-4 w-4" />
            <span className="text-xs">Log Temp</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-auto py-3"
            onClick={handleAcknowledge}
            disabled={!hasActiveAlerts}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Acknowledge</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-auto py-3"
            onClick={handleSnooze}
            disabled={!hasActiveAlerts}
          >
            <BellOff className="h-4 w-4" />
            <span className="text-xs">Snooze</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-auto py-3"
            onClick={handleAddNote}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Add Note</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
