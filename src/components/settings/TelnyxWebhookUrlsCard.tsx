import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Webhook, 
  Copy, 
  Check, 
  ExternalLink,
  Radio
} from "lucide-react";
import { toast } from "sonner";

// Messaging Profile configuration - source of truth
const MESSAGING_PROFILE = {
  name: "frost guard",
  id: "40019baa-aa62-463c-b254-463c66f4b2d3",
} as const;

// Build webhook URL from Supabase project URL
const SUPABASE_PROJECT_URL = "https://mfwyiifehsvwnjwqoxht.supabase.co";
const WEBHOOK_URL = `${SUPABASE_PROJECT_URL}/functions/v1/telnyx-webhook`;

export function TelnyxWebhookUrlsCard() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCopyAll = async () => {
    const allUrls = `Primary Webhook URL:\n${WEBHOOK_URL}\n\nFailover Webhook URL:\n${WEBHOOK_URL}`;
    await handleCopy(allUrls, "All URLs");
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      onClick={() => handleCopy(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-3.5 w-3.5 text-safe" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Telnyx Webhook Configuration</CardTitle>
        </div>
        <CardDescription>
          Configure these URLs in your Telnyx Messaging Profile to receive delivery status updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messaging Profile Info */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Messaging Profile</span>
            </div>
            <Badge variant="outline" className="font-normal">
              {MESSAGING_PROFILE.name}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Profile ID</span>
            <div className="flex items-center gap-1">
              <code className="font-mono text-muted-foreground">
                {MESSAGING_PROFILE.id.slice(0, 18)}...
              </code>
              <CopyButton text={MESSAGING_PROFILE.id} field="Profile ID" />
            </div>
          </div>
        </div>

        {/* Webhook URLs */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Webhook URLs</h4>
          <p className="text-xs text-muted-foreground">
            Copy these URLs to your Telnyx Console → Messaging → Profiles → {MESSAGING_PROFILE.name}
          </p>

          {/* Primary Webhook */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Primary Webhook</span>
              <CopyButton text={WEBHOOK_URL} field="Primary Webhook" />
            </div>
            <code className="text-xs font-mono text-foreground break-all block">
              {WEBHOOK_URL}
            </code>
          </div>

          {/* Failover Webhook */}
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Failover Webhook</span>
              <CopyButton text={WEBHOOK_URL} field="Failover Webhook" />
            </div>
            <code className="text-xs font-mono text-foreground break-all block">
              {WEBHOOK_URL}
            </code>
          </div>
        </div>

        {/* Webhook Event Types */}
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
          <span className="text-xs font-medium">Recommended Webhook Events</span>
          <div className="flex flex-wrap gap-1.5">
            {["message.sent", "message.delivered", "message.failed", "message.received"].map((event) => (
              <Badge key={event} variant="secondary" className="text-xs font-mono">
                {event}
              </Badge>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy All URLs
          </Button>
          <a
            href="https://portal.telnyx.com/#/app/messaging/profiles"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Open Telnyx Console
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
