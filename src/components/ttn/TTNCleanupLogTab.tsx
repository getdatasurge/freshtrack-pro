import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, XCircle, MinusCircle, ChevronRight, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useTTNCleanupLogs, type TTNCleanupLogEntry } from "@/hooks/useTTNCleanupLog";

const actionLabels: Record<string, string> = {
  deprovision_is: "IS (Identity)",
  deprovision_ns: "NS (Network)",
  deprovision_as: "AS (Application)",
  deprovision_js: "JS (Join)",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <Badge variant="default" className="gap-1 bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Success
      </Badge>
    );
  }
  if (status === "skipped") {
    return (
      <Badge variant="secondary" className="gap-1">
        <MinusCircle className="h-3 w-3" /> Skipped
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" /> Failed
    </Badge>
  );
}

function CleanupLogRow({ entry }: { entry: TTNCleanupLogEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <>
        <CollapsibleTrigger asChild>
          <TableRow className="cursor-pointer hover:bg-muted/50">
            <TableCell>
              <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
            </TableCell>
            <TableCell className="font-medium">{entry.sensor_name || "—"}</TableCell>
            <TableCell className="font-mono text-xs">{entry.dev_eui}</TableCell>
            <TableCell>{actionLabels[entry.action] || entry.action}</TableCell>
            <TableCell><StatusBadge status={entry.status} /></TableCell>
            <TableCell className="text-muted-foreground text-xs">{entry.ttn_status_code ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground text-xs">{entry.cluster || "—"}</TableCell>
            <TableCell>
              <span className="text-sm" title={format(new Date(entry.created_at), "PPpp")}>
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <TableRow>
            <TableCell colSpan={8} className="bg-muted/30 p-4">
              <div className="space-y-2">
                {entry.error_message && (
                  <p className="text-sm text-destructive">{entry.error_message}</p>
                )}
                {entry.ttn_endpoint && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    Endpoint: {entry.ttn_endpoint}
                  </p>
                )}
                <pre className="text-xs font-mono bg-background p-3 rounded border overflow-auto max-h-48">
                  {JSON.stringify(entry.ttn_response, null, 2) || "No response body"}
                </pre>
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}

interface TTNCleanupLogTabProps {
  orgId: string | null | undefined;
}

export function TTNCleanupLogTab({ orgId }: TTNCleanupLogTabProps) {
  const { data: logs, isLoading } = useTTNCleanupLogs(orgId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No TTN cleanup logs found</p>
        <p className="text-xs mt-1">Logs appear after sensors are archived and TTN cleanup runs</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Sensor</TableHead>
          <TableHead>DevEUI</TableHead>
          <TableHead>Step</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>HTTP</TableHead>
          <TableHead>Cluster</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((entry) => (
          <CleanupLogRow key={entry.id} entry={entry} />
        ))}
      </TableBody>
    </Table>
  );
}
