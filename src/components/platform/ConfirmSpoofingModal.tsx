import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, User, Building2, Shield, Loader2 } from 'lucide-react';

export interface ImpersonationTarget {
  user_id: string;
  email: string;
  full_name?: string | null;
  organization_id: string;
  organization_name: string;
}

interface ConfirmSpoofingModalProps {
  target: ImpersonationTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (target: ImpersonationTarget, reason?: string) => Promise<boolean>;
  isLoading?: boolean;
}

export function ConfirmSpoofingModal({
  target,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ConfirmSpoofingModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!target) return;

    setIsSubmitting(true);
    try {
      const success = await onConfirm(target, reason || undefined);
      if (success) {
        setReason('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      onClose();
    }
  };

  const loading = isLoading || isSubmitting;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Confirm User Impersonation
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {/* Target User Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">
                      {target?.full_name || target?.email}
                    </div>
                    {target?.full_name && (
                      <div className="text-sm">{target.email}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">
                      {target?.organization_name}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {target?.organization_id}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Box */}
              <div className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">You will see exactly what this user sees.</p>
                  <p className="mt-1">All actions performed during this session are logged and auditable.</p>
                </div>
              </div>

              {/* Reason Field */}
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-foreground">
                  Reason for impersonation <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Investigating support ticket #1234"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={loading}
                  className="resize-none"
                  rows={2}
                />
              </div>

              {/* Session Info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Session expires in: 4 hours</span>
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  Support Mode
                </Badge>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={handleClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              'Confirm & Continue'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
