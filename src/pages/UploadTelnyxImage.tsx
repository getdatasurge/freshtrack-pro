import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Copy, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface VerificationResult {
  accessible: boolean;
  status: number | null;
  statusText?: string;
  contentType: string | null;
  error: string | null;
}

/**
 * Utility page to view and verify the Telnyx opt-in verification image.
 * The image is hosted in the public folder and auto-deployed with the app.
 */
export default function UploadTelnyxImage() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [publicUrl, setPublicUrl] = useState<string>("");

  useEffect(() => {
    // Set the URL based on current origin
    setPublicUrl(`${window.location.origin}/telnyx/opt-in-verification.png`);
  }, []);

  const verifyUrl = async () => {
    if (!publicUrl) return;
    
    setIsVerifying(true);
    setVerificationResult(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-public-asset", {
        body: { url: publicUrl }
      });

      if (fnError) {
        throw fnError;
      }

      setVerificationResult(data as VerificationResult);
      
      if (data.accessible) {
        toast.success("URL is publicly accessible!");
      } else {
        toast.error(`URL check failed: ${data.error || "Not accessible"}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setVerificationResult({
        accessible: false,
        status: null,
        contentType: null,
        error: message
      });
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("URL copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Telnyx Opt-In Verification Image</CardTitle>
          <CardDescription>
            The opt-in verification image is automatically hosted with your app.
            Copy the URL below and paste it into your Telnyx toll-free verification form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Public URL Display */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500">Auto-Hosted</Badge>
              <p className="text-sm font-medium">Public URL:</p>
            </div>
            <code className="block p-2 bg-background rounded border text-xs break-all">
              {publicUrl || "Loading..."}
            </code>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard}
                disabled={!publicUrl}
              >
                <Copy className="mr-2 h-3 w-3" />
                Copy URL
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={verifyUrl}
                disabled={isVerifying || !publicUrl}
              >
                {isVerifying ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3 w-3" />
                )}
                Verify Accessibility
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                asChild
              >
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Open
                </a>
              </Button>
            </div>
          </div>

          {/* Verification Result */}
          {verificationResult && (
            <div className={`p-4 rounded-lg border ${
              verificationResult.accessible 
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                : "bg-destructive/10 border-destructive/20"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {verificationResult.accessible ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-200">URL is Publicly Accessible</span>
                    <Badge className="bg-green-500">200 OK</Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">URL Not Accessible</span>
                    {verificationResult.status && (
                      <Badge variant="destructive">{verificationResult.status}</Badge>
                    )}
                  </>
                )}
              </div>
              {verificationResult.error && (
                <p className="text-sm text-destructive">{verificationResult.error}</p>
              )}
              {verificationResult.contentType && (
                <p className="text-sm text-muted-foreground">
                  Content-Type: {verificationResult.contentType}
                </p>
              )}
            </div>
          )}

          {/* Image Preview */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground mb-2">Image Preview:</p>
            <img 
              src="/telnyx/opt-in-verification.png" 
              alt="FrostGuard Opt-In Verification" 
              className="w-full max-w-md mx-auto rounded-md shadow-sm"
            />
          </div>

          {/* Instructions */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Next Step:</strong> Copy the URL above and paste it into your Telnyx 
              toll-free verification form. The image is automatically deployed with your app,
              so no manual upload is needed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
