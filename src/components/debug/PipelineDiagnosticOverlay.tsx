/**
 * Pipeline Diagnostic Overlay
 * 
 * Shows detailed pipeline health information for Super Admin / Support users.
 * Displays layer-by-layer status with timestamps and technical details.
 */

import { useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  Radio,
  Wifi,
  Code,
  Send,
  Database,
  Cloud,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PipelineHealthReport, PipelineCheckResult, PipelineLayer, LayerStatus } from "@/lib/pipeline/pipelineHealth";
import { cn } from "@/lib/utils";

interface PipelineDiagnosticOverlayProps {
  /** Pipeline health report to display */
  report: PipelineHealthReport;
  /** Callback when user closes the overlay */
  onClose: () => void;
  /** Callback to refresh the health check */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Unit name for display */
  unitName?: string;
}

/**
 * Icon for each pipeline layer.
 */
const LAYER_ICONS: Record<PipelineLayer, React.ElementType> = {
  sensor: Activity,
  gateway: Radio,
  ttn: Wifi,
  decoder: Code,
  webhook: Send,
  database: Database,
  external_api: Cloud,
};

/**
 * Display name for each pipeline layer.
 */
const LAYER_NAMES: Record<PipelineLayer, string> = {
  sensor: 'Sensor',
  gateway: 'Gateway',
  ttn: 'TTN Network',
  decoder: 'Decoder',
  webhook: 'Webhook',
  database: 'Database',
  external_api: 'External API',
};

/**
 * Status badge styling.
 */
function getStatusBadgeStyle(status: LayerStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-safe/20 text-safe border-safe/30';
    case 'degraded':
      return 'bg-warning/20 text-warning border-warning/30';
    case 'failed':
      return 'bg-alarm/20 text-alarm border-alarm/30';
    case 'not_applicable':
      return 'bg-muted text-muted-foreground border-muted';
    default:
      return 'bg-muted text-muted-foreground border-muted';
  }
}

/**
 * Status icon indicator.
 */
function StatusIcon({ status }: { status: LayerStatus }) {
  switch (status) {
    case 'healthy':
      return <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />;
    case 'degraded':
      return <span className="w-2 h-2 rounded-full bg-warning" />;
    case 'failed':
      return <span className="w-2 h-2 rounded-full bg-alarm animate-pulse" />;
    default:
      return <span className="w-2 h-2 rounded-full bg-muted-foreground" />;
  }
}

/**
 * Individual layer row component.
 */
function LayerRow({ check }: { check: PipelineCheckResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = LAYER_ICONS[check.layer];
  const hasTechnicalDetails = !!check.technicalDetails || !!check.error;

  return (
    <div className="border-b border-border/50 last:border-0">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button 
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors",
              hasTechnicalDetails && "cursor-pointer"
            )}
            disabled={!hasTechnicalDetails}
          >
            <StatusIcon status={check.status} />
            
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium">{LAYER_NAMES[check.layer]}</span>
            </div>

            <div className="flex items-center gap-2">
              {check.lastSuccess && (
                <span className="text-xs text-muted-foreground">
                  {format(check.lastSuccess, 'HH:mm:ss')}
                </span>
              )}
              
              <Badge 
                variant="outline" 
                className={cn("text-[10px] px-1.5 py-0 h-4", getStatusBadgeStyle(check.status))}
              >
                {check.status === 'not_applicable' ? 'N/A' : check.status}
              </Badge>

              {hasTechnicalDetails && (
                isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {hasTechnicalDetails && (
          <CollapsibleContent>
            <div className="px-3 py-2 bg-muted/30 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1">{check.message}</p>
              
              {check.error && (
                <p className="text-xs text-alarm font-mono mb-1">
                  Error: {check.error}
                </p>
              )}
              
              {check.technicalDetails && (
                <p className="text-xs text-muted-foreground font-mono">
                  {check.technicalDetails}
                </p>
              )}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export function PipelineDiagnosticOverlay({
  report,
  onClose,
  onRefresh,
  isRefreshing = false,
  unitName,
}: PipelineDiagnosticOverlayProps) {
  const hasIssue = report.overallStatus === 'failed' || report.overallStatus === 'degraded';

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pipeline Diagnostics</span>
          {unitName && (
            <span className="text-xs text-muted-foreground">— {unitName}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <div className={cn(
        "px-3 py-2 border-b border-border",
        hasIssue ? "bg-alarm/10" : "bg-safe/10"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon status={report.overallStatus} />
            <span className="text-sm">{report.userMessage}</span>
          </div>
          {report.failingLayer && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 h-4 bg-alarm/20 text-alarm border-alarm/30"
            >
              Issue: {LAYER_NAMES[report.failingLayer]}
            </Badge>
          )}
        </div>
      </div>

      {/* Layer Checks */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {report.checks.map((check) => (
            <LayerRow key={check.layer} check={check} />
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Checked at {format(report.checkedAt, 'HH:mm:ss')}
        </span>
        
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" asChild>
          <a href="/admin/health" target="_blank" rel="noopener noreferrer">
            <span>Full Health Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>
    </div>
  );
}
