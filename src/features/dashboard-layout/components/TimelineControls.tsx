import { useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  GitCompare,
  Info,
  ZoomIn,
  ZoomOut,
  X,
  Check,
  AlertCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { TimelineState } from "../types";
import type { DateRange } from "../hooks/useTimelineState";

const QUICK_RANGES = ["1h", "6h", "24h", "7d", "30d"] as const;

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

interface TimelineControlsProps {
  state: TimelineState;
  onChange: (updates: Partial<TimelineState>) => void;
  isDefaultLayout: boolean;
  dateRange: DateRange;
  isComparing: boolean;
  saveStatus?: SaveStatus;
  saveError?: string | null;
}

export function TimelineControls({
  state,
  onChange,
  isDefaultLayout,
  dateRange,
  isComparing,
  saveStatus = 'saved',
  saveError,
}: TimelineControlsProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  const getSaveStatusBadge = () => {
    switch (saveStatus) {
      case 'saved':
        return (
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800">
            <Check className="h-3 w-3 mr-1" />
            Saved
          </Badge>
        );
      case 'dirty':
        return (
          <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unsaved changes
          </Badge>
        );
      case 'saving':
        return (
          <Badge variant="secondary" className="text-xs">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Saving...
          </Badge>
        );
      case 'error':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="text-xs cursor-help">
                  <XCircle className="h-3 w-3 mr-1" />
                  Save failed
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {saveError || "An error occurred while saving"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return null;
    }
  };

  const handleQuickRange = (range: typeof QUICK_RANGES[number]) => {
    onChange({
      range,
      customFrom: undefined,
      customTo: undefined,
    });
  };

  const handleCustomRange = () => {
    if (selectedRange.from && selectedRange.to) {
      onChange({
        range: "custom",
        customFrom: selectedRange.from.toISOString(),
        customTo: selectedRange.to.toISOString(),
      });
      setDatePickerOpen(false);
    }
  };

  const handleCompare = (type: "previous_period" | "custom") => {
    if (type === "previous_period") {
      onChange({ compare: "previous_period" });
      setComparePickerOpen(false);
    }
    // Custom comparison would need another date picker flow
  };

  const clearCompare = () => {
    onChange({ compare: null });
  };

  const handleZoom = (direction: "in" | "out") => {
    const newZoom = direction === "in" 
      ? Math.min(4, state.zoomLevel + 1)
      : Math.max(1, state.zoomLevel - 1);
    onChange({ zoomLevel: newZoom });
  };

  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Left: Quick Range Buttons */}
        <div className="flex items-center gap-1">
          {QUICK_RANGES.map((range) => (
            <Button
              key={range}
              variant={state.range === range ? "default" : "ghost"}
              size="sm"
              onClick={() => handleQuickRange(range)}
              className="px-3"
            >
              {range}
            </Button>
          ))}

          {/* Custom date picker */}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={state.range === "custom" ? "default" : "ghost"}
                size="sm"
                className="px-3"
              >
                <Calendar className="h-4 w-4 mr-1" />
                {state.range === "custom" ? (
                  <span className="text-xs">
                    {state.customFrom &&
                      format(new Date(state.customFrom), "MMM d")}
                    {" - "}
                    {state.customTo &&
                      format(new Date(state.customTo), "MMM d")}
                  </span>
                ) : (
                  "Custom"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={{
                  from: selectedRange.from,
                  to: selectedRange.to,
                }}
                onSelect={(range) => {
                  setSelectedRange({
                    from: range?.from,
                    to: range?.to,
                  });
                }}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
              />
              <div className="flex justify-end gap-2 p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDatePickerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCustomRange}
                  disabled={!selectedRange.from || !selectedRange.to}
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Center/Right: Comparison and Zoom */}
        <div className="flex items-center gap-2">
          {/* Comparison Controls */}
          {isComparing ? (
            <Badge variant="secondary" className="flex items-center gap-1">
              <GitCompare className="h-3 w-3" />
              <span className="text-xs">
                {state.compare === "previous_period"
                  ? "vs Previous Period"
                  : "Comparing"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:bg-destructive/20"
                onClick={clearCompare}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ) : (
            <Popover open={comparePickerOpen} onOpenChange={setComparePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <GitCompare className="h-4 w-4 mr-1" />
                  Compare
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="end">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => handleCompare("previous_period")}
                  >
                    Previous Period
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    disabled // TODO: Implement custom comparison
                  >
                    Custom Range...
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Separator orientation="vertical" className="h-6" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleZoom("out")}
                    disabled={state.zoomLevel <= 1}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-xs text-muted-foreground w-8 text-center">
              {state.zoomLevel}x
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleZoom("in")}
                    disabled={state.zoomLevel >= 4}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Save Status Indicator */}
          {isDefaultLayout ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-help">
                    <Info className="h-3 w-3 mr-1" />
                    Not saved
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Timeline settings are not saved with the default layout.
                  Create a custom layout to save your preferences.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            getSaveStatusBadge()
          )}
        </div>
      </div>

      {/* Current range display */}
      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
        Showing: {format(dateRange.from, "MMM d, yyyy h:mm a")} -{" "}
        {format(dateRange.to, "MMM d, yyyy h:mm a")}
      </div>
    </Card>
  );
}
