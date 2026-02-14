import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useAlertAuditLog } from "@/hooks/useAlertAuditLog";

interface AuditLogTimelineProps {
  alertId: string;
}

interface AuditLogEntry {
  id: string;
  alert_id: string;
  organization_id: string;
  event_type: string;
  actor_user_id: string;
  actor_type: string;
  details: Record<string, any>;
  created_at: string;
  actor?: { full_name: string; email: string } | null;
}

const EVENT_TYPE_STYLES: Record<string, { dotColor: string; badgeColor: string; label: string }> = {
  created: {
    dotColor: "bg-blue-500",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    label: "Created",
  },
  acknowledged: {
    dotColor: "bg-green-500",
    badgeColor: "bg-green-500/10 text-green-600 border-green-500/20",
    label: "Acknowledged",
  },
  escalation_triggered: {
    dotColor: "bg-orange-500",
    badgeColor: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    label: "Escalation Triggered",
  },
  resolved: {
    dotColor: "bg-emerald-600",
    badgeColor: "bg-emerald-600/10 text-emerald-700 border-emerald-600/20",
    label: "Resolved",
  },
  expired: {
    dotColor: "bg-gray-400",
    badgeColor: "bg-gray-400/10 text-gray-500 border-gray-400/20",
    label: "Expired",
  },
  suppressed: {
    dotColor: "bg-yellow-500",
    badgeColor: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    label: "Suppressed",
  },
  correlated: {
    dotColor: "bg-purple-500",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    label: "Correlated",
  },
};

const DEFAULT_STYLE = {
  dotColor: "bg-gray-400",
  badgeColor: "bg-gray-400/10 text-gray-500 border-gray-400/20",
  label: "Unknown",
};

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getActorName(entry: AuditLogEntry): string {
  if (entry.actor?.full_name) return entry.actor.full_name;
  if (entry.actor?.email) return entry.actor.email;
  if (entry.actor_type === "system") return "System";
  return "Unknown";
}

function renderDetails(details: Record<string, any>): React.ReactNode {
  if (!details || Object.keys(details).length === 0) return null;

  const parts: string[] = [];

  if (details.notes) {
    parts.push(`Notes: ${details.notes}`);
  }
  if (details.escalation_level != null) {
    parts.push(`Escalation level: ${details.escalation_level}`);
  }
  if (details.reason) {
    parts.push(`Reason: ${details.reason}`);
  }
  if (details.resolution) {
    parts.push(`Resolution: ${details.resolution}`);
  }
  if (details.correlated_with) {
    parts.push(`Correlated with: ${details.correlated_with}`);
  }
  if (details.suppression_id) {
    parts.push(`Suppression ID: ${details.suppression_id}`);
  }
  if (details.severity) {
    parts.push(`Severity: ${details.severity}`);
  }

  // Catch any remaining keys not already handled
  const handledKeys = new Set([
    "notes",
    "escalation_level",
    "reason",
    "resolution",
    "correlated_with",
    "suppression_id",
    "severity",
  ]);
  for (const [key, value] of Object.entries(details)) {
    if (!handledKeys.has(key) && value != null && value !== "") {
      parts.push(`${key.replace(/_/g, " ")}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
    }
  }

  if (parts.length === 0) return null;

  return (
    <p className="text-xs text-muted-foreground mt-0.5 break-words">
      {parts.join(" \u00B7 ")}
    </p>
  );
}

export function AuditLogTimeline({ alertId }: AuditLogTimelineProps) {
  const { data: entries = [], isLoading, isError } = useAlertAuditLog(alertId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-4">
        Failed to load audit log. Please try again later.
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No audit events recorded for this alert.
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[28rem]">
      <div className="relative pl-6 pb-2">
        {/* Vertical timeline line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {(entries as AuditLogEntry[]).map((entry) => {
            const style = EVENT_TYPE_STYLES[entry.event_type] ?? DEFAULT_STYLE;
            const label = EVENT_TYPE_STYLES[entry.event_type]?.label ?? entry.event_type;

            return (
              <div key={entry.id} className="relative flex gap-3 items-start">
                {/* Timeline dot */}
                <div
                  className={`absolute -left-6 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-background ${style.dotColor} ring-2 ring-background`}
                />

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[11px] px-1.5 py-0 font-medium ${style.badgeColor}`}
                    >
                      {label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.created_at)}
                    </span>
                  </div>

                  <p className="text-sm text-foreground mt-0.5">
                    {getActorName(entry)}
                  </p>

                  {renderDetails(entry.details)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
