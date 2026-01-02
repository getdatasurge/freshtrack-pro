/**
 * TTN Validation Result Panel
 * Displays rich validation results with actionable guidance for fixing issues
 */

import React, { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Copy, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ValidationError {
  code: string;
  message: string;
  hint?: string;
}

export interface ValidationPermissions {
  valid: boolean;
  rights: string[];
  missing_core: string[];
  missing_webhook: string[];
  can_configure_webhook: boolean;
  can_manage_devices: boolean;
}

export interface TTNValidationResult {
  valid: boolean;
  warnings: string[];
  permissions?: ValidationPermissions;
  error?: ValidationError;
  request_id?: string;
  applicationId?: string;
}

interface TTNValidationResultPanelProps {
  result: TTNValidationResult;
  applicationId: string;
}

// Required scopes for full TTN integration
const REQUIRED_SCOPES = [
  { id: "info", label: "Application: Read", right: "RIGHT_APPLICATION_INFO" },
  { id: "devices_read", label: "Devices: Read", right: "RIGHT_APPLICATION_DEVICES_READ" },
  { id: "devices_write", label: "Devices: Write", right: "RIGHT_APPLICATION_DEVICES_WRITE" },
  { id: "traffic_read", label: "Traffic: Read (uplinks)", right: "RIGHT_APPLICATION_TRAFFIC_READ" },
  { id: "traffic_down", label: "Traffic: Write (downlinks)", right: "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE" },
  { id: "settings", label: "Settings: Write (webhooks)", right: "RIGHT_APPLICATION_SETTINGS_BASIC" },
];

const TTN_CONSOLE_URL = "https://console.cloud.thethings.network";

export function TTNValidationResultPanel({ result, applicationId }: TTNValidationResultPanelProps) {
  const [isHowToFixOpen, setIsHowToFixOpen] = useState(!result.valid);

  const copyRequestId = () => {
    if (result.request_id) {
      navigator.clipboard.writeText(result.request_id);
      toast.success("Request ID copied");
    }
  };

  // Success state
  if (result.valid) {
    return (
      <div className="p-3 rounded-lg bg-safe/10 border border-safe/30">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-safe shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-safe">Configuration Valid</span>
              {result.request_id && (
                <Badge variant="outline" className="text-xs font-mono">
                  {result.request_id}
                </Badge>
              )}
            </div>
            
            {/* Permission Matrix (success) */}
            {result.permissions && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">Granted permissions:</p>
                <div className="flex flex-wrap gap-1">
                  {REQUIRED_SCOPES.filter(scope => 
                    result.permissions?.rights.includes(scope.right)
                  ).map(scope => (
                    <Badge key={scope.id} variant="outline" className="text-xs bg-safe/5 text-safe border-safe/20">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {scope.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                  <ul className="text-xs text-warning space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Failure state
  return (
    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
      <div className="space-y-3">
        {/* Error Header */}
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-medium text-destructive">Configuration Invalid</span>
              <div className="flex items-center gap-2">
                {result.error?.code && (
                  <Badge variant="outline" className="text-xs font-mono text-destructive border-destructive/30">
                    {result.error.code}
                  </Badge>
                )}
                {result.request_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={copyRequestId}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {result.request_id}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Error Message */}
            <p className="text-sm text-destructive mt-1">
              {result.error?.message || "Validation failed"}
            </p>
            
            {/* Error Hint */}
            {result.error?.hint && (
              <p className="text-xs text-muted-foreground mt-1">
                {result.error.hint}
              </p>
            )}
          </div>
        </div>

        {/* Application ID Callout */}
        {applicationId && (
          <div className="flex items-center gap-2 p-2 rounded bg-muted/50 border border-border">
            <span className="text-xs text-muted-foreground">Key must belong to app:</span>
            <code className="text-xs font-mono font-medium">{applicationId}</code>
          </div>
        )}

        {/* How to Fix Section */}
        <Collapsible open={isHowToFixOpen} onOpenChange={setIsHowToFixOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
              <span className="text-xs font-medium">How to fix in TTN Console</span>
              {isHowToFixOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            {/* Step-by-step Instructions */}
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>
                Go to{" "}
                <a 
                  href={TTN_CONSOLE_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  TTN Console
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Navigate to <strong>Applications → {applicationId || "<your-app>"}</strong></li>
              <li>Click <strong>API Keys</strong> in the left sidebar</li>
              <li>Click <strong>"+ Add API Key"</strong></li>
              <li>Name it <strong>"FrostGuard Integration"</strong></li>
              <li>Select <strong>"Grant all current and future rights"</strong> OR add specific rights below</li>
              <li>Click <strong>"Create API Key"</strong> and copy it immediately</li>
              <li>Paste the key here and click <strong>Validate</strong></li>
            </ol>

            {/* Required Scopes Checklist */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Required permissions:</p>
              <div className="grid grid-cols-2 gap-1">
                {REQUIRED_SCOPES.map(scope => {
                  const hasPermission = result.permissions?.rights.includes(scope.right);
                  return (
                    <div 
                      key={scope.id}
                      className={cn(
                        "flex items-center gap-1.5 p-1.5 rounded text-xs",
                        hasPermission 
                          ? "bg-safe/5 text-safe" 
                          : "bg-destructive/5 text-destructive"
                      )}
                    >
                      {hasPermission ? (
                        <CheckCircle className="h-3 w-3 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 shrink-0" />
                      )}
                      <span>{scope.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Important Note */}
            <div className="p-2 rounded bg-warning/10 border border-warning/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-warning">
                  The API key must be created <strong>inside</strong> the application "{applicationId || "<your-app>"}", 
                  not as a personal/user-level key.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
