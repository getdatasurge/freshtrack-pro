/**
 * TTN Setup Wizard
 * Guides users through configuring The Things Network integration
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Check, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  Globe,
  Key,
  Radio,
  Webhook,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { TTN_REGIONS, TTN_WIZARD_STEPS, type TTNRegion, getTTNConsoleUrl } from "@/lib/ttnErrorConfig";
import { useTTNSetupWizard } from "@/hooks/useTTNSetupWizard";
import { cn } from "@/lib/utils";

interface TTNSetupWizardProps {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emulatorDevEui?: string;
  onComplete?: () => void;
}

export function TTNSetupWizard({ 
  organizationId, 
  open, 
  onOpenChange,
  emulatorDevEui,
  onComplete,
}: TTNSetupWizardProps) {
  const {
    state,
    isLoading,
    isTesting,
    loadSettings,
    setRegion,
    testConnection,
    saveApiKey,
    completeStep,
    goToStep,
  } = useTTNSetupWizard(organizationId);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [webhookSecretInput, setWebhookSecretInput] = useState("");

  useEffect(() => {
    if (open && organizationId) {
      loadSettings();
    }
  }, [open, organizationId, loadSettings]);

  const currentStepDef = TTN_WIZARD_STEPS[state.currentStep];
  const currentStepState = state.steps[state.currentStep];

  const handleTestConnection = async () => {
    const result = await testConnection(emulatorDevEui ? undefined : undefined);
    if (result?.success) {
      toast.success("Connection verified successfully!");
    } else {
      toast.error(result?.error || "Connection test failed");
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    const success = await saveApiKey(apiKeyInput);
    if (success) {
      toast.success("API key saved successfully!");
      setApiKeyInput("");
    }
  };

  const handleCopyDevEui = () => {
    if (emulatorDevEui) {
      navigator.clipboard.writeText(emulatorDevEui);
      toast.success("DevEUI copied to clipboard");
    }
  };

  const renderStepContent = () => {
    switch (state.currentStep) {
      case 0: // Select TTN Cluster
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the TTN cluster where your gateway and application are registered.
              This determines which TTN server we communicate with.
            </p>
            
            <RadioGroup 
              value={state.region} 
              onValueChange={(v) => setRegion(v as TTNRegion)}
              className="space-y-3"
            >
              {TTN_REGIONS.map((region) => (
                <div 
                  key={region.value}
                  className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <RadioGroupItem value={region.value} id={region.value} />
                  <Label 
                    htmlFor={region.value} 
                    className="flex-1 cursor-pointer flex items-center justify-between"
                  >
                    <span>{region.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {region.url.replace('https://', '')}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Globe className="w-4 h-4 text-blue-500" />
              <p className="text-sm text-blue-500">
                Most US users should select <strong>North America (nam1)</strong>
              </p>
            </div>
          </div>
        );

      case 1: // Validate Application
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              FrostGuard uses a shared TTN application for all sensors. 
              We'll verify that the application is accessible on your selected cluster.
            </p>

            <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Application ID</span>
                <Badge variant="outline" className="font-mono">
                  {state.applicationId || "Not configured"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cluster</span>
                <Badge variant="secondary">{state.region}</Badge>
              </div>
            </div>

            {state.lastTestResult && (
              <div className={cn(
                "p-4 rounded-lg border",
                state.lastTestResult.success 
                  ? "bg-green-500/10 border-green-500/20" 
                  : "bg-destructive/10 border-destructive/20"
              )}>
                <div className="flex items-start gap-3">
                  {state.lastTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {state.lastTestResult.success 
                        ? `Connected to ${state.lastTestResult.applicationName || state.applicationId}`
                        : state.lastTestResult.error}
                    </p>
                    {state.lastTestResult.hint && (
                      <p className="text-xs text-muted-foreground">
                        {state.lastTestResult.hint}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleTestConnection}
              disabled={isTesting || !state.hasApiKey}
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Test Application Access
            </Button>

            {!state.hasApiKey && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Configure API key first (Step 3)
              </p>
            )}
          </div>
        );

      case 2: // API Key
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create an API key in TTN Console with permissions for device management.
              The key is encrypted before storage.
            </p>

            <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
              <p className="text-sm font-medium">Required Permissions:</p>
              <ul className="space-y-2 text-sm">
                {[
                  "Read application information",
                  "View and edit application settings", 
                  "List end devices",
                  "View device keys (for provisioning)"
                ].map((perm, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>

            {state.hasApiKey && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">
                  API key configured (ending in <code className="font-mono">{state.apiKeyLast4}</code>)
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>TTN API Key</Label>
              <Input
                type="password"
                placeholder="NNSXS.XXXXXXXXXXXXXXXXX..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleSaveApiKey}
              disabled={isLoading || !apiKeyInput.trim()}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              {state.hasApiKey ? "Update API Key" : "Save API Key"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${getTTNConsoleUrl(state.region)}/console`, '_blank')}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open TTN Console
            </Button>
          </div>
        );

      case 3: // Device Registration
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your sensor device must be registered in TTN before it can send uplinks.
              Use the DevEUI below when creating the device.
            </p>

            {emulatorDevEui && (
              <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Emulator DevEUI</span>
                  <Button variant="ghost" size="sm" onClick={handleCopyDevEui}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <code className="block text-lg font-mono text-center p-3 bg-background rounded border">
                  {emulatorDevEui.match(/.{1,2}/g)?.join(':').toUpperCase() || emulatorDevEui}
                </code>
              </div>
            )}

            <div className="space-y-2 p-4 rounded-lg border bg-amber-500/10 border-amber-500/20">
              <p className="text-sm font-medium text-amber-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Manual Registration Required
              </p>
              <p className="text-sm text-muted-foreground">
                FrostGuard sensors must be manually registered in TTN Console using OTAA.
                The emulator simulates this behavior for testing.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Registration Steps:</p>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Go to TTN Console → Applications → End devices</li>
                <li>Click "Add end device"</li>
                <li>Select your sensor model or enter specs manually</li>
                <li>Enter the DevEUI shown above</li>
                <li>Complete registration with OTAA</li>
              </ol>
            </div>

            <Button
              variant="outline"
              onClick={() => completeStep(3)}
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              I've Registered the Device
            </Button>
          </div>
        );

      case 4: // Webhook Configuration
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure a webhook in TTN to send uplinks to FrostGuard.
              This enables real-time sensor data ingestion.
            </p>

            <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Webhook URL</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-webhook`);
                    toast.success("Webhook URL copied");
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <code className="block text-xs font-mono p-2 bg-background rounded border break-all">
                https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-webhook
              </code>
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret (Optional)</Label>
              <Input
                type="password"
                placeholder="Enter shared secret for signature verification"
                value={webhookSecretInput}
                onChange={(e) => setWebhookSecretInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If configured, TTN will sign webhook requests for additional security.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => completeStep(4)}
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              Webhook Configured
            </Button>
          </div>
        );

      case 5: // Final Verification
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review your configuration and run a final verification test.
            </p>

            <div className="space-y-2">
              {state.steps.map((step, i) => {
                const stepDef = TTN_WIZARD_STEPS[i];
                return (
                  <div 
                    key={step.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      step.isComplete ? "bg-green-500/5 border-green-500/20" : "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {step.isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : step.error ? (
                        <X className="w-5 h-5 text-destructive" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{stepDef.title}</span>
                    </div>
                    {step.error && (
                      <Badge variant="destructive" className="text-xs">
                        {step.error}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Run Final Verification
            </Button>

            {state.isComplete && (
              <Button
                onClick={() => {
                  onComplete?.();
                  onOpenChange(false);
                }}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete Setup
              </Button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const stepIcons = [Globe, Radio, Key, Radio, Webhook, CheckCircle2];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            TTN Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Configure The Things Network integration for LoRaWAN sensors
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center justify-between py-4">
          {TTN_WIZARD_STEPS.map((step, i) => {
            const stepState = state.steps[i];
            const Icon = stepIcons[i];
            return (
              <button
                key={step.id}
                onClick={() => goToStep(i)}
                className={cn(
                  "flex flex-col items-center gap-1 group transition-colors",
                  i === state.currentStep && "text-primary",
                  stepState.isComplete && "text-green-500",
                  stepState.error && "text-destructive"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                  i === state.currentStep && "border-primary bg-primary/10",
                  stepState.isComplete && "border-green-500 bg-green-500/10",
                  stepState.error && "border-destructive bg-destructive/10",
                  !stepState.isComplete && i !== state.currentStep && !stepState.error && "border-muted-foreground/30"
                )}>
                  {stepState.isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : stepState.error ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs text-center max-w-[60px] truncate group-hover:underline">
                  {step.title.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        <Separator />

        {/* Current Step */}
        <div className="py-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{currentStepDef?.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStepDef?.description}</p>
          </div>

          {currentStepState?.error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{currentStepState.error}</p>
            </div>
          )}

          {renderStepContent()}
        </div>

        <Separator />

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => goToStep(state.currentStep - 1)}
            disabled={state.currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Step {state.currentStep + 1} of {TTN_WIZARD_STEPS.length}
          </span>

          <Button
            onClick={() => goToStep(state.currentStep + 1)}
            disabled={state.currentStep === TTN_WIZARD_STEPS.length - 1}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
