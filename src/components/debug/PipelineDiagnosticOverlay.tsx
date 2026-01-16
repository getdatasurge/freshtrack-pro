/**
 * Pipeline Diagnostic Overlay
 * 
 * Shows detailed pipeline health information for Super Admin / Support users.
 * Displays layer-by-layer status with timestamps and technical details.
 * Includes payload binding comparison and schema validation results.
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
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileJson,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PipelineHealthReport, PipelineCheckResult, PipelineLayer, LayerStatus } from "@/lib/pipeline/pipelineHealth";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface PayloadBindingData {
  payloadType: string;
  schemaVersion: string;
  confidence: number;
  status: "active" | "review_required" | "overridden" | "pending";
  capabilities: string[];
  boundAt?: string;
  source?: "auto" | "manual";
}

export interface SchemaValidationResult {
  valid: boolean;
  missingRequired: string[];
  missingOptional: string[];
  unexpectedFields: string[];
  lastPayloadSample?: Record<string, unknown>;
}

export interface InferenceDetails {
  inferredPayloadType: string;
  confidence: number;
  reasons: string[];
  alternates?: string[];
  isAmbiguous?: boolean;
}

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
  /** Expected payload binding from sensor configuration */
  payloadBinding?: PayloadBindingData;
  /** Last received payload type from latest reading */
  lastReceivedPayloadType?: string;
  /** Schema validation result */
  schemaValidation?: SchemaValidationResult;
  /** Inference details from last payload */
  inferenceDetails?: InferenceDetails;
}

// ============================================================================
// Constants
// ============================================================================

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

// ============================================================================
// Helper Components
// ============================================================================

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

/**
 * Payload Binding Section - Shows expected vs received payload type
 */
function PayloadBindingSection({
  payloadBinding,
  lastReceivedPayloadType,
  inferenceDetails,
}: {
  payloadBinding?: PayloadBindingData;
  lastReceivedPayloadType?: string;
  inferenceDetails?: InferenceDetails;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!payloadBinding) return null;

  const typesMatch = lastReceivedPayloadType === payloadBinding.payloadType;
  const hasInferenceDetails = !!inferenceDetails;

  return (
    <div className="border-b border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors">
            <FileJson className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium flex-1 text-left">Payload Binding</span>
            {typesMatch ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-safe" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-alarm" />
            )}
            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 py-2 bg-muted/30 border-t border-border/50 space-y-2">
            {/* Expected vs Received */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Expected Type</span>
                <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                  {payloadBinding.payloadType}
                </code>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Last Received</span>
                <div className="flex items-center gap-1.5">
                  <code className={cn(
                    "font-mono px-1.5 py-0.5 rounded",
                    typesMatch 
                      ? "text-foreground bg-muted" 
                      : "text-alarm bg-alarm/10"
                  )}>
                    {lastReceivedPayloadType ?? "—"}
                  </code>
                  {typesMatch ? (
                    <CheckCircle2 className="w-3 h-3 text-safe" />
                  ) : (
                    <XCircle className="w-3 h-3 text-alarm" />
                  )}
                </div>
              </div>
            </div>

            {/* Binding Metadata */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="text-[10px] h-4">
                Confidence: {Math.round(payloadBinding.confidence * 100)}%
              </Badge>
              <Badge variant="outline" className="text-[10px] h-4">
                Status: {payloadBinding.status}
              </Badge>
              {payloadBinding.source && (
                <Badge variant="outline" className="text-[10px] h-4">
                  Source: {payloadBinding.source}
                </Badge>
              )}
            </div>

            {/* Capabilities */}
            {payloadBinding.capabilities.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">Capabilities: </span>
                <span className="font-mono">{payloadBinding.capabilities.join(', ')}</span>
              </div>
            )}

            {/* Inference Details */}
            {hasInferenceDetails && inferenceDetails && (
              <div className="pt-2 border-t border-border/50 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Inference Result</span>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Inferred:</span>
                    <code className="font-mono">{inferenceDetails.inferredPayloadType}</code>
                    <span className="text-muted-foreground">
                      ({Math.round(inferenceDetails.confidence * 100)}%)
                    </span>
                    {inferenceDetails.isAmbiguous && (
                      <Badge variant="outline" className="text-[10px] h-4 text-warning border-warning/30">
                        Ambiguous
                      </Badge>
                    )}
                  </div>
                  {inferenceDetails.reasons.length > 0 && (
                    <div className="text-muted-foreground font-mono text-[10px]">
                      Reasons: {inferenceDetails.reasons.join(' → ')}
                    </div>
                  )}
                  {inferenceDetails.alternates && inferenceDetails.alternates.length > 0 && (
                    <div className="text-muted-foreground font-mono text-[10px]">
                      Alternates: {inferenceDetails.alternates.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Schema Validation Section - Shows validation results and missing fields
 */
function SchemaValidationSection({
  schemaValidation,
}: {
  schemaValidation?: SchemaValidationResult;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  
  if (!schemaValidation) return null;

  const hasIssues = 
    schemaValidation.missingRequired.length > 0 ||
    schemaValidation.missingOptional.length > 0 ||
    schemaValidation.unexpectedFields.length > 0;

  return (
    <div className="border-b border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors">
            <Code className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium flex-1 text-left">Schema Validation</span>
            {schemaValidation.valid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-safe" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-alarm" />
            )}
            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 py-2 bg-muted/30 border-t border-border/50 space-y-2">
            {/* Overall Status */}
            <div className="flex items-center gap-2 text-xs">
              {schemaValidation.valid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-safe" />
                  <span className="text-safe">Validation Passed</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-alarm" />
                  <span className="text-alarm">Validation Failed</span>
                </>
              )}
            </div>

            {/* Missing Required Fields */}
            {schemaValidation.missingRequired.length > 0 && (
              <div className="text-xs">
                <span className="text-alarm font-medium">Missing Required: </span>
                <code className="font-mono text-alarm">
                  {schemaValidation.missingRequired.join(', ')}
                </code>
              </div>
            )}

            {/* Missing Optional Fields */}
            {schemaValidation.missingOptional.length > 0 && (
              <div className="text-xs">
                <span className="text-warning font-medium">Missing Optional: </span>
                <code className="font-mono text-warning">
                  {schemaValidation.missingOptional.join(', ')}
                </code>
              </div>
            )}

            {/* Unexpected Fields */}
            {schemaValidation.unexpectedFields.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground font-medium">Unexpected Fields: </span>
                <code className="font-mono text-muted-foreground">
                  {schemaValidation.unexpectedFields.join(', ')}
                </code>
              </div>
            )}

            {/* No Issues */}
            {!hasIssues && schemaValidation.valid && (
              <p className="text-xs text-muted-foreground">
                All required and optional fields present and valid.
              </p>
            )}

            {/* Last Payload Sample (Collapsible) */}
            {schemaValidation.lastPayloadSample && (
              <div className="pt-2 border-t border-border/50">
                <button 
                  onClick={() => setShowPayload(!showPayload)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {showPayload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Last Payload Sample
                </button>
                {showPayload && (
                  <pre className="mt-1 p-2 bg-muted rounded text-[10px] font-mono overflow-x-auto max-h-32">
                    {JSON.stringify(schemaValidation.lastPayloadSample, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PipelineDiagnosticOverlay({
  report,
  onClose,
  onRefresh,
  isRefreshing = false,
  unitName,
  payloadBinding,
  lastReceivedPayloadType,
  schemaValidation,
  inferenceDetails,
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

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        {/* Payload Binding Section */}
        <PayloadBindingSection
          payloadBinding={payloadBinding}
          lastReceivedPayloadType={lastReceivedPayloadType}
          inferenceDetails={inferenceDetails}
        />

        {/* Schema Validation Section */}
        <SchemaValidationSection schemaValidation={schemaValidation} />

        {/* Layer Checks */}
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
