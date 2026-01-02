/**
 * TTN Operation Guard Display
 * Shows blockers and warnings before TTN operations
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertTriangle, XCircle, ChevronDown, ExternalLink } from "lucide-react";
import type { TTNGuardResult, TTNBlocker } from "@/lib/ttn/guards";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TTNGuardDisplayProps {
  result: TTNGuardResult;
  className?: string;
  showWarnings?: boolean;
}

export function TTNGuardDisplay({
  result,
  className,
  showWarnings = true,
}: TTNGuardDisplayProps) {
  const [expandedBlocker, setExpandedBlocker] = useState<number | null>(0);

  if (result.allowed && result.warnings.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Blockers */}
      {result.blockers.map((blocker, index) => (
        <BlockerCard
          key={blocker.code}
          blocker={blocker}
          expanded={expandedBlocker === index}
          onToggle={() => setExpandedBlocker(expandedBlocker === index ? null : index)}
        />
      ))}

      {/* Warnings */}
      {showWarnings && result.warnings.length > 0 && (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              {result.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function BlockerCard({
  blocker,
  expanded,
  onToggle,
}: {
  blocker: TTNBlocker;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Alert variant="destructive" className="pr-2">
      <XCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{blocker.message}</span>
        <Collapsible open={expanded} onOpenChange={onToggle}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </AlertTitle>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleContent>
          <AlertDescription className="mt-2">
            <p className="font-medium text-foreground mb-2">{blocker.howToFix}</p>
            <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
              {blocker.fixSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {blocker.code.includes('TTN') && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0 text-primary"
                asChild
              >
                <a
                  href="https://console.thethings.network"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open TTN Console
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </AlertDescription>
        </CollapsibleContent>
      </Collapsible>
    </Alert>
  );
}

/**
 * Compact inline blocker display for button tooltips
 */
export function TTNBlockerSummary({ 
  blockers 
}: { 
  blockers: TTNBlocker[] 
}) {
  if (blockers.length === 0) return null;

  return (
    <div className="text-sm space-y-1">
      {blockers.slice(0, 2).map((b, i) => (
        <p key={i} className="text-destructive">{b.message}</p>
      ))}
      {blockers.length > 2 && (
        <p className="text-muted-foreground">+{blockers.length - 2} more issues</p>
      )}
    </div>
  );
}
