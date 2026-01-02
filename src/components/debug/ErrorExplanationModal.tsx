import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Copy, 
  Download, 
  ExternalLink, 
  AlertTriangle, 
  AlertCircle,
  Clock,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { DebugLogEntry } from '@/lib/debugLogger';
import { 
  explainError, 
  getRelatedLogs, 
  formatExplanationAsMarkdown,
  ErrorExplanation 
} from '@/lib/errorExplainer';
import { buildSupportSnapshot, downloadSnapshot } from '@/lib/snapshotBuilder';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ErrorExplanationModalProps {
  entry: DebugLogEntry | null;
  allLogs: DebugLogEntry[];
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  orgId?: string;
}

export function ErrorExplanationModal({
  entry,
  allLogs,
  isOpen,
  onClose,
  userEmail,
  orgId,
}: ErrorExplanationModalProps) {
  const { toast } = useToast();

  const explanation = useMemo(() => {
    if (!entry) return null;
    return explainError(entry);
  }, [entry]);

  const relatedLogs = useMemo(() => {
    if (!entry || !explanation) return [];
    const windowSeconds = explanation.relatedFilters?.timeWindowSeconds || 30;
    return getRelatedLogs(allLogs, entry, windowSeconds).slice(0, 10);
  }, [entry, explanation, allLogs]);

  if (!entry || !explanation) return null;

  const handleCopyExplanation = async () => {
    const markdown = formatExplanationAsMarkdown(entry, explanation);
    try {
      await navigator.clipboard.writeText(markdown);
      toast({
        title: 'Copied to clipboard',
        description: 'Explanation copied as Markdown',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleExportSnapshot = async () => {
    try {
      const snapshot = await buildSupportSnapshot({
        logs: allLogs,
        focusEntry: entry,
        userEmail,
        orgId,
        currentRoute: window.location.pathname,
      });
      downloadSnapshot(snapshot);
      toast({
        title: 'Snapshot exported',
        description: 'Redacted diagnostic file downloaded. Safe to share with support.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not generate snapshot',
        variant: 'destructive',
      });
    }
  };

  const SeverityIcon = explanation.severity === 'error' ? AlertCircle : AlertTriangle;
  const severityColor = explanation.severity === 'error' ? 'text-destructive' : 'text-warning';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <SeverityIcon className={`h-5 w-5 ${severityColor}`} />
            Error Explanation
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Error Title & Meta */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{explanation.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{format(entry.timestamp, 'yyyy-MM-dd HH:mm:ss.SSS')}</span>
                <Separator orientation="vertical" className="h-4" />
                <Tag className="h-3.5 w-3.5" />
                <Badge variant="outline" className="text-xs">
                  {entry.category}
                </Badge>
                <Badge 
                  variant={entry.level === 'error' ? 'destructive' : 'secondary'} 
                  className="text-xs"
                >
                  {entry.level}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* What Happened */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                What Happened
              </h4>
              <p className="text-sm">{explanation.summary}</p>
            </div>

            {/* Likely Causes */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                Likely Causes
              </h4>
              <ul className="space-y-1.5">
                {explanation.likelyCauses.map((cause, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Actions */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                Recommended Actions
              </h4>
              <ol className="space-y-1.5">
                {explanation.recommendedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <span>{action}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Original Error Message */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                Original Error
              </h4>
              <div className="bg-muted/50 rounded-md p-3 font-mono text-xs overflow-x-auto">
                {entry.message}
              </div>
              {entry.payload && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Show error details
                  </summary>
                  <pre className="mt-2 bg-muted/50 rounded-md p-3 overflow-x-auto">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Related Logs */}
            {relatedLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                  Related Logs (±{explanation.relatedFilters?.timeWindowSeconds || 30}s)
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {relatedLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1"
                    >
                      <Badge variant="outline" className="text-[10px] px-1">
                        {log.category}
                      </Badge>
                      <span className="text-muted-foreground">
                        {format(log.timestamp, 'HH:mm:ss.SSS')}
                      </span>
                      <span className="truncate flex-1">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documentation Link */}
            {explanation.documentationUrl && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ExternalLink className="h-4 w-4" />
                <a 
                  href={explanation.documentationUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary underline"
                >
                  View related documentation
                </a>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t mt-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyExplanation}>
              <Copy className="h-4 w-4 mr-1" />
              Copy Explanation
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSnapshot}>
              <Download className="h-4 w-4 mr-1" />
              Export Snapshot
            </Button>
          </div>
          <Button variant="default" size="sm" onClick={onClose}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
