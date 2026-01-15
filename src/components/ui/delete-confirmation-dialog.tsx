import * as React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeleteEntityType = "unit" | "area" | "site" | "device" | "sensor";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  entityType: DeleteEntityType;
  warningMessage?: string;
  onConfirm: () => Promise<void>;
  isPermanent?: boolean;
  hasChildren?: boolean;
  childrenCount?: number;
}

const entityTypeLabels: Record<DeleteEntityType, string> = {
  unit: "Unit",
  area: "Area",
  site: "Site",
  device: "Device",
  sensor: "Sensor",
};

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  entityName,
  entityType,
  warningMessage,
  onConfirm,
  isPermanent = false,
  hasChildren = false,
  childrenCount = 0,
}: DeleteConfirmationDialogProps) {
  const [confirmInput, setConfirmInput] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);

  const nameMatches = confirmInput === entityName;
  const typeLabel = entityTypeLabels[entityType];

  const defaultWarning = isPermanent
    ? `This will permanently delete "${entityName}" and all associated data. This action cannot be undone.`
    : `This will move "${entityName}" to Recently Deleted. Historical data will be preserved and can be restored by an admin.`;

  const childWarning = hasChildren
    ? ` This ${typeLabel.toLowerCase()} contains ${childrenCount} active item${childrenCount !== 1 ? "s" : ""} that will also be deleted.`
    : "";

  React.useEffect(() => {
    if (!open) {
      setConfirmInput("");
      setIsDeleting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!nameMatches || isDeleting) return;
    
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {isPermanent ? "Permanently Delete" : "Delete"} {typeLabel}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              {warningMessage || defaultWarning}
              {childWarning}
            </p>
            {isPermanent && (
              <p className="font-semibold text-destructive">
                ⚠️ This action is irreversible!
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="confirm-delete" className="text-sm text-muted-foreground">
            Type <span className="font-mono font-semibold text-foreground">{entityName}</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={entityName}
            className={cn(
              "font-mono",
              confirmInput.length > 0 && (nameMatches 
                ? "border-green-500 focus-visible:ring-green-500" 
                : "border-destructive focus-visible:ring-destructive")
            )}
            disabled={isDeleting}
            autoComplete="off"
          />
          {confirmInput.length > 0 && !nameMatches && (
            <p className="text-xs text-destructive">
              Name doesn't match. Check for exact spelling and case.
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!nameMatches || isDeleting}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              (!nameMatches || isDeleting) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                {isPermanent ? "Permanently Delete" : "Delete"}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
