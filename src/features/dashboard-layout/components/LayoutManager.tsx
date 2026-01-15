import { useState } from "react";
import {
  Lock,
  Copy,
  Save,
  MoreHorizontal,
  Pencil,
  Star,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ActiveLayout } from "../types";

interface LayoutManagerProps {
  activeLayout: ActiveLayout;
  isDirty: boolean;
  isSaving: boolean;
  onSave: (name?: string) => Promise<unknown>;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetDefault: () => Promise<void>;
  onRevert: () => void;
  onDiscard: () => void;
  onCreateFromDefault: (name: string) => Promise<unknown>;
  canCreateNew: boolean;
}

export function LayoutManager({
  activeLayout,
  isDirty,
  isSaving,
  onSave,
  onRename,
  onDelete,
  onSetDefault,
  onRevert,
  onDiscard,
  onCreateFromDefault,
  canCreateNew,
}: LayoutManagerProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleRename = async () => {
    if (newName.trim()) {
      await onRename(newName.trim());
      setRenameDialogOpen(false);
      setNewName("");
    }
  };

  const handleCreate = async () => {
    if (newName.trim()) {
      await onCreateFromDefault(newName.trim());
      setCreateDialogOpen(false);
      setNewName("");
    }
  };

  const handleDelete = async () => {
    await onDelete();
    setDeleteDialogOpen(false);
  };

  const handleDiscard = () => {
    onDiscard();
    setDiscardDialogOpen(false);
  };

  // For default layout, show "Customize" button to create a copy
  if (activeLayout.isDefault) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          <Lock className="h-3 w-3 mr-1" />
          View Only
        </Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewName("My Layout");
                  setCreateDialogOpen(true);
                }}
                disabled={!canCreateNew}
              >
                <Copy className="h-4 w-4 mr-1" />
                Customize
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {canCreateNew
                ? "Create a custom layout based on Default"
                : "Maximum layouts reached"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Custom Layout</DialogTitle>
              <DialogDescription>
                Create a new layout based on the default configuration. You can then customize it.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="layout-name">Layout Name</Label>
              <Input
                id="layout-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Layout"
                maxLength={50}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || isSaving}>
                {isSaving ? "Creating..." : "Create Layout"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // For custom layouts
  return (
    <div className="flex items-center gap-2">
      {/* Save button (shows when dirty) */}
      {isDirty && (
        <Button size="sm" onClick={() => onSave()} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      )}

      {/* Discard button (shows when dirty) */}
      {isDirty && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDiscardDialogOpen(true)}
        >
          <X className="h-4 w-4 mr-1" />
          Discard
        </Button>
      )}

      {/* Dropdown menu for other actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setNewName(activeLayout.name);
              setRenameDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSetDefault}>
            <Star className="h-4 w-4 mr-2" />
            Set as Default
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRevert}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default Layout
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Layout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Layout</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input">Layout Name</Label>
            <Input
              id="rename-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={50}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{activeLayout.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard Confirmation */}
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this layout. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
