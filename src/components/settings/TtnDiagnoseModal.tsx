import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Server, Key, Radio, Database, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TtnDiagnoseResult {
  success: boolean;
  clusterBaseUrl: string;
  region: string;
  appId: string;
  deviceId: string;
  sensorName?: string;
  devEui?: string;
  checks: {
    appProbe: { ok: boolean; status: number; error?: string };
    is: { ok: boolean; status: number; error?: string };
    js: { ok: boolean; status: number; error?: string };
    ns: { ok: boolean; status: number; error?: string };
    as: { ok: boolean; status: number; error?: string };
  };
  diagnosis: string;
  hint: string;
  diagnosedAt: string;
  error?: string;
  details?: string;
}

interface TtnDiagnoseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: TtnDiagnoseResult | null;
  isLoading?: boolean;
  onRetry?: () => void;
  sensorName?: string;
}

const CheckRow = ({ 
  label, 
  icon: Icon, 
  check 
}: { 
  label: string; 
  icon: React.ElementType;
  check: { ok: boolean; status: number; error?: string } | undefined;
}) => {
  if (!check) return null;
  
  const is404 = check.status === 404;
  const isOk = check.ok;
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge 
          variant={isOk ? "default" : is404 ? "secondary" : "destructive"}
          className={cn(
            "text-xs",
            isOk && "bg-safe text-safe-foreground",
            is404 && "bg-muted text-muted-foreground"
          )}
        >
          {check.status}
        </Badge>
        {isOk ? (
          <CheckCircle2 className="h-4 w-4 text-safe" />
        ) : is404 ? (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-alarm" />
        )}
      </div>
    </div>
  );
};

export function TtnDiagnoseModal({ 
  open, 
  onOpenChange, 
  result, 
  isLoading,
  onRetry,
  sensorName 
}: TtnDiagnoseModalProps) {
  const getDiagnosisBadge = (diagnosis: string) => {
    switch (diagnosis) {
      case "fully_provisioned":
        return <Badge className="bg-safe text-safe-foreground">Fully Provisioned</Badge>;
      case "not_provisioned":
        return <Badge variant="secondary">Not Provisioned</Badge>;
      case "split_brain_no_keys":
        return <Badge className="bg-alarm text-alarm-foreground">Split Brain (No Keys)</Badge>;
      case "split_brain_orphaned":
        return <Badge className="bg-alarm text-alarm-foreground">Split Brain (Orphaned)</Badge>;
      case "partial":
        return <Badge className="bg-warning text-warning-foreground">Partial</Badge>;
      default:
        return <Badge variant="outline">{diagnosis}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            TTN Device Diagnostics
            {result && onRetry && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={onRetry}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {sensorName || result?.sensorName || "Sensor"} TTN registration status
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking TTN planes...</p>
          </div>
        ) : result?.error ? (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Diagnostics Failed</span>
            </div>
            <p className="text-sm text-muted-foreground">{result.error}</p>
            {result.details && (
              <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                {result.details}
              </p>
            )}
          </div>
        ) : result ? (
          <div className="space-y-4">
            {/* Cluster Info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cluster</span>
                <span className="font-mono text-xs">{result.region.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Base URL</span>
                <span className="font-mono text-xs truncate max-w-[200px]">{result.clusterBaseUrl}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">App ID</span>
                <span className="font-mono text-xs">{result.appId}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Device ID</span>
                <span className="font-mono text-xs">{result.deviceId}</span>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Diagnosis</span>
              {getDiagnosisBadge(result.diagnosis)}
            </div>
            
            {result.hint && (
              <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                {result.hint}
              </p>
            )}

            {/* Plane Checks */}
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2">TTN Plane Status</h4>
              <CheckRow label="Application" icon={Server} check={result.checks.appProbe} />
              <CheckRow label="Identity Server (IS)" icon={Database} check={result.checks.is} />
              <CheckRow label="Join Server (JS)" icon={Key} check={result.checks.js} />
              <CheckRow label="Network Server (NS)" icon={Radio} check={result.checks.ns} />
              <CheckRow label="Application Server (AS)" icon={Server} check={result.checks.as} />
            </div>

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground text-center">
              Diagnosed at {new Date(result.diagnosedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No diagnostics data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
