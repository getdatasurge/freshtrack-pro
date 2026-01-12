import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Upload, ExternalLink, Copy, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import telnyxOptInImage from "@/assets/telnyx-opt-in-verification.png";

// Expected public URL for the opt-in image
const EXPECTED_PUBLIC_URL = "https://mfwyiifehsvwnjwqoxht.supabase.co/storage/v1/object/public/public-assets/telnyx/opt-in-verification.png";

interface VerificationResult {
  accessible: boolean;
  status: number | null;
  statusText?: string;
  contentType: string | null;
  error: string | null;
}

/**
 * One-time utility to upload the Telnyx opt-in verification image
 * to Supabase Storage and get the public URL.
 */
export default function UploadTelnyxImage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const handleUpload = async () => {
    setIsUploading(true);
    setError(null);
    
    try {
      // Fetch the image from the imported asset
      const response = await fetch(telnyxOptInImage);
      const blob = await response.blob();
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload("telnyx/opt-in-verification.png", blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("public-assets")
        .getPublicUrl("telnyx/opt-in-verification.png");

      setPublicUrl(urlData.publicUrl);
      toast.success("Image uploaded successfully!");
      
      // Auto-verify after upload
      await verifyUrl(urlData.publicUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const verifyUrl = async (urlToVerify?: string) => {
    const url = urlToVerify || publicUrl || EXPECTED_PUBLIC_URL;
    setIsVerifying(true);
    setVerificationResult(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-public-asset", {
        body: { url }
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

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Telnyx Opt-In Image Upload</CardTitle>
          <CardDescription>
            Upload the FrostGuard opt-in verification image for Telnyx compliance verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Expected URL Display */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Expected Public URL:</p>
            <code className="block p-2 bg-background rounded border text-xs break-all">
              {EXPECTED_PUBLIC_URL}
            </code>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => copyToClipboard(EXPECTED_PUBLIC_URL)}
              >
                <Copy className="mr-2 h-3 w-3" />
                Copy
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => verifyUrl(EXPECTED_PUBLIC_URL)}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3 w-3" />
                )}
                Verify
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
            <p className="text-sm text-muted-foreground mb-2">Image Preview (from local assets):</p>
            <img 
              src={telnyxOptInImage} 
              alt="FrostGuard Opt-In Verification" 
              className="w-full max-w-md mx-auto rounded-md shadow-sm"
            />
          </div>

          {/* Upload Button */}
          <Button 
            onClick={handleUpload} 
            disabled={isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {publicUrl ? "Re-upload to Storage" : "Upload to Storage"}
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              {error}
            </div>
          )}

          {/* Success State */}
          {publicUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">Upload Complete!</span>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Uploaded to:</p>
                <code className="block p-2 bg-background rounded border text-xs break-all">
                  {publicUrl}
                </code>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => copyToClipboard(publicUrl)} variant="outline" className="flex-1">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in New Tab
                  </a>
                </Button>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Next Step:</strong> Copy the URL above and paste it into your Telnyx 
                  toll-free verification form.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
