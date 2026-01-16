/**
 * Preview Mode Selector
 * 
 * Allows users to preview how the dashboard looks in different data states
 * during layout customization. Helps designers verify edge cases.
 */

import { Eye, WifiOff, AlertTriangle, CheckCircle, Database } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PreviewMode } from "../types";

interface PreviewModeSelectorProps {
  value: PreviewMode;
  onChange: (mode: PreviewMode) => void;
  className?: string;
}

const PREVIEW_MODES: Array<{
  value: PreviewMode;
  label: string;
  description: string;
  icon: typeof Eye;
  color: string;
}> = [
  {
    value: "live",
    label: "Live Data",
    description: "Real sensor data",
    icon: Eye,
    color: "text-foreground",
  },
  {
    value: "normal",
    label: "Normal State",
    description: "Healthy sensors, good readings",
    icon: CheckCircle,
    color: "text-safe",
  },
  {
    value: "no_data",
    label: "No Data",
    description: "Sensor assigned, no readings",
    icon: Database,
    color: "text-muted-foreground",
  },
  {
    value: "offline",
    label: "Offline",
    description: "Sensor not reporting",
    icon: WifiOff,
    color: "text-warning",
  },
  {
    value: "alerting",
    label: "Alerting",
    description: "Active temperature alert",
    icon: AlertTriangle,
    color: "text-alarm",
  },
];

export function PreviewModeSelector({ value, onChange, className }: PreviewModeSelectorProps) {
  const selectedMode = PREVIEW_MODES.find((m) => m.value === value) || PREVIEW_MODES[0];
  const Icon = selectedMode.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">Preview:</span>
      <Select value={value} onValueChange={(v) => onChange(v as PreviewMode)}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue>
            <div className="flex items-center gap-2">
              <Icon className={cn("h-3.5 w-3.5", selectedMode.color)} />
              <span>{selectedMode.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PREVIEW_MODES.map((mode) => {
            const ModeIcon = mode.icon;
            return (
              <SelectItem key={mode.value} value={mode.value}>
                <div className="flex items-center gap-2">
                  <ModeIcon className={cn("h-4 w-4", mode.color)} />
                  <div className="flex flex-col">
                    <span className="font-medium">{mode.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {mode.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {value !== "live" && (
        <Badge variant="secondary" className="text-xs">
          Mock Data
        </Badge>
      )}
    </div>
  );
}
