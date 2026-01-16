/**
 * Binding Confirmation Dialog
 * 
 * Modal that appears when adding a widget that requires specific capabilities
 * and the sensor's payload type was detected with low confidence.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { WidgetDefinition } from "../types";
import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";
import { 
  PAYLOAD_TYPE_CAPABILITIES, 
  getCapabilityDisplayNames,
  hasCapabilities,
} from "@/lib/registry/capabilityRegistry";

// ============================================================================
// TYPES
// ============================================================================

interface BindingInfo {
  payloadType: string;
  confidence: number;
  capabilities: DeviceCapability[];
}

interface BindingConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  binding: BindingInfo;
  widget: WidgetDefinition;
  onConfirm: () => void;
  onChangeType: (newType: string) => void;
  onCancel: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BindingConfirmationDialog({
  open,
  onOpenChange,
  binding,
  widget,
  onConfirm,
  onChangeType,
  onCancel,
}: BindingConfirmationDialogProps) {
  const [selectedType, setSelectedType] = useState<string>(binding.payloadType);
  
  const requiredCapabilities = widget.requiredCapabilities ?? [];
  const requiredNames = getCapabilityDisplayNames(requiredCapabilities);
  const confidencePercent = Math.round(binding.confidence * 100);
  
  // Get payload types that would satisfy widget requirements
  const compatiblePayloadTypes = Object.entries(PAYLOAD_TYPE_CAPABILITIES)
    .filter(([_, caps]) => hasCapabilities(caps, requiredCapabilities))
    .map(([type]) => type);
  
  const handleConfirmClick = () => {
    if (selectedType !== binding.payloadType) {
      onChangeType(selectedType);
    } else {
      onConfirm();
    }
    onOpenChange(false);
  };
  
  const handleCancelClick = () => {
    onCancel();
    onOpenChange(false);
  };
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Confirm Sensor Type
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm">
              <p>
                The sensor's payload type was detected with{" "}
                <span className="font-medium text-warning">{confidencePercent}% confidence</span>.
              </p>
              
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Widget</span>
                  <span className="font-medium">{widget.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Requires</span>
                  <div className="flex gap-1">
                    {requiredNames.map(name => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Detected</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {binding.payloadType}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payload-type-select">
                  Confirm or select correct type:
                </Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id="payload-type-select">
                    <SelectValue placeholder="Select payload type" />
                  </SelectTrigger>
                  <SelectContent>
                    {compatiblePayloadTypes.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Compatible Types
                        </div>
                        {compatiblePayloadTypes.map(type => (
                          <SelectItem 
                            key={type} 
                            value={type}
                            className="font-mono"
                          >
                            {type}
                            {type === binding.payloadType && (
                              <span className="ml-2 text-muted-foreground">(detected)</span>
                            )}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      All Types
                    </div>
                    {Object.keys(PAYLOAD_TYPE_CAPABILITIES)
                      .filter(type => !compatiblePayloadTypes.includes(type))
                      .map(type => (
                        <SelectItem 
                          key={type} 
                          value={type}
                          className="font-mono text-muted-foreground"
                        >
                          {type}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelClick}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmClick}>
            {selectedType !== binding.payloadType ? 'Change & Add Widget' : 'Confirm & Add Widget'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
