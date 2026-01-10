import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SecretFieldProps {
  label: string;
  value: string | null;
  last4?: string | null;
  status: "provisioned" | "missing" | "invalid" | "decryption_failed";
  isSecret?: boolean;
  description?: string;
  className?: string;
}

export function SecretField({
  label,
  value,
  last4,
  status,
  isSecret = true,
  description,
  className,
}: SecretFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const getMaskedValue = () => {
    if (!value && !last4) return "Not configured";
    if (isRevealed && value) return value;
    if (last4) return `••••••••••••${last4}`;
    return "••••••••••••••••";
  };

  const getStatusBadge = () => {
    switch (status) {
      case "provisioned":
        return <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30">Provisioned</Badge>;
      case "missing":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Missing</Badge>;
      case "invalid":
        return <Badge variant="outline" className="bg-alarm/10 text-alarm border-alarm/30">Invalid</Badge>;
      case "decryption_failed":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Stored (Unreadable)</Badge>;
    }
  };

  const hasValue = Boolean(value || last4);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {getStatusBadge()}
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted/50 border border-border rounded-md px-3 py-2 font-mono text-sm overflow-hidden">
          <span className={cn(
            "break-all",
            !hasValue && "text-muted-foreground italic"
          )}>
            {getMaskedValue()}
          </span>
        </div>
        
        <div className="flex gap-1">
          {isSecret && hasValue && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsRevealed(!isRevealed)}
              disabled={!value}
              title={isRevealed ? "Hide" : "Reveal"}
            >
              {isRevealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleCopy}
            disabled={!value}
            title="Copy to clipboard"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-safe" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
