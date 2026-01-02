import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import type { ActionEligibility } from "@/lib/actions/types";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";
type DisabledVariant = "button" | "text" | "badge";

interface ActionButtonProps {
  /** Eligibility result from a canXxx helper */
  eligibility: ActionEligibility;
  /** Click handler (only called when allowed) */
  onClick: () => void;
  /** Button label text */
  label: string;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Button variant when enabled */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Loading state */
  isLoading?: boolean;
  /** Loading label text */
  loadingLabel?: string;
  /** How to render disabled state */
  disabledVariant?: DisabledVariant;
  /** Additional class names */
  className?: string;
  /** Text hint to show when disabled (overrides eligibility.reason in inline display) */
  disabledHint?: string;
}

/**
 * ActionButton enforces "disabled requires reason" pattern.
 * When eligibility.allowed is false, it always shows a visible reason.
 */
export function ActionButton({
  eligibility,
  onClick,
  label,
  icon,
  variant = "outline",
  size = "sm",
  isLoading = false,
  loadingLabel,
  disabledVariant = "button",
  className = "",
  disabledHint,
}: ActionButtonProps) {
  const displayReason = disabledHint || eligibility.reason || "Action not available";

  // Loading state (always shows as button)
  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {loadingLabel && <span className="ml-1.5">{loadingLabel}</span>}
      </Button>
    );
  }

  // Disabled state
  if (!eligibility.allowed) {
    switch (disabledVariant) {
      case "text":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-help">
                {icon}
                <span>{disabledHint || label}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{displayReason}</p>
            </TooltipContent>
          </Tooltip>
        );

      case "badge":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-warning border-warning/30 bg-warning/10 cursor-help"
              >
                {disabledHint || label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{displayReason}</p>
            </TooltipContent>
          </Tooltip>
        );

      case "button":
      default:
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="ghost"
                  size={size}
                  disabled
                  className={`cursor-not-allowed ${className}`}
                >
                  {icon}
                  {label && <span className="ml-1.5">{label}</span>}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{displayReason}</p>
            </TooltipContent>
          </Tooltip>
        );
    }
  }

  // Enabled state
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={className}
    >
      {icon}
      {label && <span className={icon ? "ml-1.5" : ""}>{label}</span>}
    </Button>
  );
}
