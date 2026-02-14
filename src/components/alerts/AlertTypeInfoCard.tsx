import { HelpCircle, CheckCircle2, Settings, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAlertDescription, type AlertDescription } from "@/lib/alertDescriptions";
import { getAlertTypeConfig } from "@/lib/alertConfig";

interface AlertTypeInfoCardProps {
  alertType: string;
  onClose?: () => void;
}

const severityBadgeClass: Record<string, string> = {
  Critical: "bg-alarm/10 text-alarm border-alarm/30",
  Warning: "bg-warning/10 text-warning border-warning/30",
  Info: "bg-accent/10 text-accent border-accent/30",
};

export function AlertTypeInfoCard({ alertType, onClose }: AlertTypeInfoCardProps) {
  const description = getAlertDescription(alertType);
  const typeConfig = getAlertTypeConfig(alertType);

  if (!description) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm animate-in fade-in-0 slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="font-semibold text-foreground">
            About: {typeConfig.label}
          </span>
          <Badge variant="outline" className={severityBadgeClass[description.severity] || ""}>
            {description.severity}
          </Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <span className="sr-only">Close</span>
            <span className="text-muted-foreground text-xs">x</span>
          </Button>
        )}
      </div>

      {/* What it means */}
      <p className="text-muted-foreground leading-relaxed">
        {description.whatItMeans}
      </p>

      {/* Triggered when */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          <span className="font-medium text-foreground">Triggered when</span>
        </div>
        <p className="text-muted-foreground ml-5">{description.triggeredWhen}</p>
      </div>

      {/* How to fix */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Settings className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium text-foreground">How to fix</span>
        </div>
        <ol className="list-decimal list-inside space-y-1 ml-5 text-muted-foreground">
          {description.howToFix.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Auto-resolves */}
      <div className="flex items-start gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-safe mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-medium text-foreground">Auto-resolves when: </span>
          <span className="text-muted-foreground">{description.autoResolvesWhen}</span>
        </div>
      </div>

      {/* Related settings */}
      <p className="text-xs text-muted-foreground/70">
        Configure thresholds in Settings &gt; {description.relatedSettings}
      </p>
    </div>
  );
}

/**
 * Small info toggle button to place next to alert type labels.
 */
export function AlertInfoToggle({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 w-5 p-0 rounded-full"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="What does this alert mean?"
    >
      <HelpCircle
        className={`w-3.5 h-3.5 ${isOpen ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
      />
    </Button>
  );
}
