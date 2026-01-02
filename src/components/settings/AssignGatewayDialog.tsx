import { useState } from "react";
import { useUpdateGateway } from "@/hooks/useGateways";
import { Gateway } from "@/types/ttn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Radio } from "lucide-react";

interface AssignGatewayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteName: string;
  unassignedGateways: Gateway[];
}

export function AssignGatewayDialog({
  open,
  onOpenChange,
  siteId,
  siteName,
  unassignedGateways,
}: AssignGatewayDialogProps) {
  const updateGateway = useUpdateGateway();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatEUI = (eui: string) => {
    return eui.match(/.{1,2}/g)?.join(":") || eui;
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    
    setIsSubmitting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          updateGateway.mutateAsync({
            id,
            updates: { site_id: siteId, status: "pending" },
          })
        )
      );
      setSelectedIds(new Set());
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedIds(new Set());
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Gateways</DialogTitle>
          <DialogDescription>
            Select gateways to assign to {siteName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
          {unassignedGateways.length > 0 ? (
            unassignedGateways.map((gateway) => (
              <div
                key={gateway.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleSelection(gateway.id)}
              >
                <Checkbox
                  checked={selectedIds.has(gateway.id)}
                  onCheckedChange={() => toggleSelection(gateway.id)}
                />
                <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{gateway.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {formatEUI(gateway.gateway_eui)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Radio className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No unassigned gateways available
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                Sync from emulator or register a new gateway in Settings → Gateways
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedIds.size === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedIds.size > 0 ? `(${selectedIds.size})` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
