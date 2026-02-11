import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface SensorCleanupBadgeProps {
  status: string | undefined;
}

export function SensorCleanupBadge({ status }: SensorCleanupBadgeProps) {
  if (!status) return null;

  if (status === "SUCCEEDED") {
    return (
      <Badge variant="default" className="gap-1 bg-emerald-600 text-xs">
        <CheckCircle2 className="h-3 w-3" /> TTN Cleaned
      </Badge>
    );
  }

  if (status === "FAILED" || status === "BLOCKED") {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <XCircle className="h-3 w-3" /> TTN Cleanup Failed
      </Badge>
    );
  }

  if (status === "PENDING" || status === "RUNNING" || status === "RETRYING") {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" /> Cleanup In Progress
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <AlertTriangle className="h-3 w-3" /> {status}
    </Badge>
  );
}
