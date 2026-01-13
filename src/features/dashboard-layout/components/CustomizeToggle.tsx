import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CustomizeToggleProps {
  isCustomizing: boolean;
  onToggle: (value: boolean) => void;
  disabled: boolean;
  isDirty: boolean;
  disabledReason?: string;
}

export function CustomizeToggle({
  isCustomizing,
  onToggle,
  disabled,
  isDirty,
  disabledReason,
}: CustomizeToggleProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);

  const handleToggle = (value: boolean) => {
    // If exiting customize mode with unsaved changes, confirm
    if (!value && isDirty) {
      setPendingValue(value);
      setConfirmDialogOpen(true);
      return;
    }
    onToggle(value);
  };

  const handleConfirm = () => {
    onToggle(pendingValue);
    setConfirmDialogOpen(false);
  };

  const toggle = (
    <div className="flex items-center gap-2">
      <Switch
        id="customize-mode"
        checked={isCustomizing}
        onCheckedChange={handleToggle}
        disabled={disabled}
      />
      <Label
        htmlFor="customize-mode"
        className={`text-sm flex items-center gap-1 ${
          disabled ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <Settings2 className="h-4 w-4" />
        {isCustomizing ? "Customizing" : "Customize"}
      </Label>
    </div>
  );

  return (
    <>
      {disabled && disabledReason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{toggle}</TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        toggle
      )}

      {/* Unsaved changes confirmation */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Customize Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to exit customize mode anyway?
              Your changes will be preserved but not saved until you click Save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Customizing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Exit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
