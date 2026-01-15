/**
 * TTN Diagnostics Download Button
 * One-click download of support-ready TTN diagnostics
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Copy, Loader2, FileJson, Check } from "lucide-react";
import { toast } from "sonner";
import type { TTNConfigContext } from "@/types/ttnState";
import { 
  buildTTNDiagnostics, 
  downloadDiagnostics, 
  copyDiagnosticsToClipboard,
} from "@/lib/ttn/diagnosticsBuilder";

interface TTNDiagnosticsDownloadProps {
  context: TTNConfigContext | null;
  organizationId: string | null;
  settings?: {
    cluster?: string;
    application_id?: string;
    api_key_last4?: string;
    webhook_url?: string;
    is_enabled?: boolean;
  };
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
}

export function TTNDiagnosticsDownload({
  context,
  organizationId,
  settings,
  variant = 'outline',
  size = 'sm',
}: TTNDiagnosticsDownloadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const diagnostics = await buildTTNDiagnostics(context, organizationId, settings);
      downloadDiagnostics(diagnostics);
      toast.success("Diagnostics downloaded");
    } catch (error) {
      console.error("[TTNDiagnosticsDownload] Error:", error);
      toast.error("Failed to generate diagnostics");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    setIsLoading(true);
    try {
      const diagnostics = await buildTTNDiagnostics(context, organizationId, settings);
      const success = await copyDiagnosticsToClipboard(diagnostics);
      
      if (success) {
        setCopied(true);
        toast.success("Diagnostics copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("Failed to copy to clipboard");
      }
    } catch (error) {
      console.error("[TTNDiagnosticsDownload] Error:", error);
      toast.error("Failed to generate diagnostics");
    } finally {
      setIsLoading(false);
    }
  };

  if (size === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size="icon" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copy to Clipboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          TTN Diagnostics
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy to Clipboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
