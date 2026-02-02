/**
 * Layout Validation Banner
 * 
 * Displays validation warnings and errors during layout customization.
 * Shows actionable messages to help users fix layout issues.
 */

import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LayoutValidationResult, ValidationIssue } from "../hooks/useLayoutValidation";
import type { EntityType } from "../hooks/useEntityLayoutStorage";

interface LayoutValidationBannerProps {
  validation: LayoutValidationResult;
  entityId: string;
  entityType: EntityType;
  className?: string;
}

/**
 * Resolves relative action hrefs (e.g., "#sensors") into full navigation paths
 */
function resolveActionHref(
  href: string | undefined,
  entityId: string,
  entityType: EntityType
): string {
  if (!href) return "#";

  // Handle hash anchors like "#sensors"
  if (href.startsWith("#sensors")) {
    return entityType === "unit"
      ? `/units/${entityId}?tab=settings`
      : `/sites/${entityId}?tab=settings`;
  }

  // Handle settings paths
  if (href.startsWith("/settings")) {
    return entityType === "unit"
      ? `/units/${entityId}${href.replace("/settings", "")}?tab=settings`
      : href;
  }

  return href;
}

function getSeverityIcon(severity: ValidationIssue["severity"]) {
  switch (severity) {
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case "info":
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function getSeverityBadgeVariant(severity: ValidationIssue["severity"]) {
  switch (severity) {
    case "error":
      return "destructive";
    case "warning":
      return "outline";
    case "info":
      return "secondary";
  }
}

export function LayoutValidationBanner({ validation, entityId, entityType, className }: LayoutValidationBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Don't render if no issues
  if (validation.issues.length === 0) return null;

  // Determine overall banner styling based on most severe issue
  const hasCriticalIssues = validation.hasErrors;
  const bannerVariant = hasCriticalIssues ? "destructive" : "default";

  // Show first 2 issues collapsed, all when expanded
  const visibleIssues = isExpanded ? validation.issues : validation.issues.slice(0, 2);
  const hiddenCount = validation.issues.length - 2;

  return (
    <Alert
      variant={bannerVariant}
      className={cn(
        "border",
        hasCriticalIssues 
          ? "bg-destructive/10 border-destructive/30" 
          : "bg-warning/10 border-warning/30",
        className
      )}
    >
      <AlertDescription className="space-y-2">
        {/* Summary line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {hasCriticalIssues ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning" />
            )}
            <span>
              {validation.errorCount > 0 && (
                <span className="text-destructive">
                  {validation.errorCount} error{validation.errorCount > 1 ? "s" : ""}
                </span>
              )}
              {validation.errorCount > 0 && validation.warningCount > 0 && ", "}
              {validation.warningCount > 0 && (
                <span className="text-warning">
                  {validation.warningCount} warning{validation.warningCount > 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>
          {hasCriticalIssues && (
            <Badge variant="destructive" className="text-xs">
              Cannot save
            </Badge>
          )}
        </div>

        {/* Issue list */}
        <div className="space-y-1.5">
          {visibleIssues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-start gap-2 text-sm pl-1"
            >
              {getSeverityIcon(issue.severity)}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{issue.widgetName}:</span>{" "}
                <span className="text-muted-foreground">{issue.message}</span>
              </div>
              {issue.action && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs shrink-0"
                >
                  <Link
                    to={resolveActionHref(issue.action.href, entityId, entityType)}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {issue.action.label}
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Expand/collapse for many issues */}
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {hiddenCount} more
              </>
            )}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
