import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { useAccountDeletion, DeletionStatus } from '@/hooks/useAccountDeletion';
import { debugLog } from '@/lib/debugLogger';

interface AccountDeletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  isOwner: boolean;
  hasOtherUsers: boolean;
  sensorCount?: number;
  gatewayCount?: number;
}

const statusMessages: Record<DeletionStatus, string> = {
  idle: '',
  preparing: 'Preparing deletion...',
  deleting_sensors: 'Cleaning up sensors...',
  deleting_gateways: 'Removing gateways...',
  removing_membership: 'Removing organization membership...',
  anonymizing: 'Anonymizing account...',
  signing_out: 'Signing out...',
  complete: 'Account deleted successfully',
  error: 'Deletion failed',
};

export function AccountDeletionModal({
  open,
  onOpenChange,
  userId,
  userEmail,
  isOwner,
  hasOtherUsers,
  sensorCount = 0,
  gatewayCount = 0,
}: AccountDeletionModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const { progress, isDeleting, deleteAccount, reset } = useAccountDeletion();

  const isConfirmed = confirmText.toUpperCase() === 'DELETE';
  const canDelete = isConfirmed && !isDeleting;
  const showOwnerWarning = isOwner && hasOtherUsers;

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setConfirmText('');
      reset();
    }
  }, [open, reset]);

  const handleDelete = async () => {
    if (!canDelete) return;
    await deleteAccount(userId);
  };

  const handleExportSnapshot = () => {
    const snapshot = debugLog.exportSnapshot();
    const blob = new Blob([snapshot], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frostguard-deletion-snapshot-${progress.requestId || 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    // Error state
    if (progress.status === 'error') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-destructive">Deletion Failed</p>
              <p className="text-sm text-muted-foreground mt-1">{progress.error}</p>
              {progress.requestId && (
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Request ID: {progress.requestId}
                </p>
              )}
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleExportSnapshot}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Support Snapshot
          </Button>
        </div>
      );
    }

    // Deleting state
    if (isDeleting) {
      return (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-destructive" />
          <div className="text-center">
            <p className="font-medium">{statusMessages[progress.status]}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please do not close this window...
            </p>
          </div>
        </div>
      );
    }

    // Owner warning
    if (showOwnerWarning) {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-6 w-6 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning">Ownership Transfer Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                You are the owner of an organization with other users. You must transfer 
                ownership to another user before you can delete your account.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Confirmation form
    return (
      <div className="space-y-6">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">This action is permanent</p>
            <p className="text-sm text-muted-foreground mt-1">
              Once deleted, your account and data cannot be recovered.
            </p>
          </div>
        </div>

        {/* What will be deleted */}
        <div className="space-y-2">
          <p className="text-sm font-medium">The following will be deleted:</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-destructive" />
              Your profile and personal information
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-destructive" />
              Your notification preferences
            </li>
            {!hasOtherUsers ? (
              <>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-destructive" />
                  Your entire organization and all its data
                </li>
                {sensorCount > 0 && (
                  <li className="flex items-center gap-2 ml-4">
                    <CheckCircle2 className="h-4 w-4 text-destructive" />
                    {sensorCount} sensor{sensorCount !== 1 ? 's' : ''} (TTN devices will be deprovisioned)
                  </li>
                )}
                {gatewayCount > 0 && (
                  <li className="flex items-center gap-2 ml-4">
                    <CheckCircle2 className="h-4 w-4 text-destructive" />
                    {gatewayCount} gateway{gatewayCount !== 1 ? 's' : ''}
                  </li>
                )}
                <li className="flex items-center gap-2 ml-4">
                  <CheckCircle2 className="h-4 w-4 text-destructive" />
                  All sites, areas, units, and readings
                </li>
              </>
            ) : (
              <li className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Organization data will be kept (other users remain)
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* User email confirmation */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm">
            <span className="text-muted-foreground">Account email: </span>
            <span className="font-medium">{userEmail}</span>
          </p>
        </div>

        {/* Type DELETE to confirm */}
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canDelete) {
                handleDelete();
              }
            }}
            placeholder="Type DELETE"
            className="font-mono"
            autoComplete="off"
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Prevent closing during deletion
        if (isDeleting && !newOpen) return;
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Your Account
          </DialogTitle>
          <DialogDescription>
            This will permanently delete your account and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        <DialogFooter className="gap-2 sm:gap-0">
          {progress.status === 'error' ? (
            <>
              <Button variant="outline" onClick={() => reset()}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          ) : showOwnerWarning ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : !isDeleting ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!canDelete}
              >
                Delete My Account
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
