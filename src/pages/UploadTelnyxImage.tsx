import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Upload, ExternalLink, Copy } from "lucide-react";
import telnyxOptInImage from "@/assets/telnyx-opt-in-verification.png";

/**
 * One-time utility to upload the Telnyx opt-in verification image
 * to Supabase Storage and get the public URL.
 * 
 * This can be deleted after the upload is complete.
 */
export default function UploadTelnyxImage() {
  const [isUploading, setIsUploading] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    setIsUploading(true);
    setError(null);
    
    try {
      // Fetch the image from the imported asset
      const response = await fetch(telnyxOptInImage);
      const blob = await response.blob();
      
      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success("URL copied to clipboard!");
    }
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
          {/* Image Preview */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground mb-2">Image Preview:</p>
            <img 
              src={telnyxOptInImage} 
              alt="FrostGuard Opt-In Verification" 
              className="w-full max-w-md mx-auto rounded-md shadow-sm"
            />
          </div>

          {/* Upload Button */}
          {!publicUrl && (
            <Button 
              onClick={handleUpload} 
              disabled={isUploading}
              className="w-full"
              size="lg"
            >
              {isUploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload to Storage
                </>
              )}
            </Button>
          )}

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
                <p className="text-sm text-muted-foreground">Public URL:</p>
                <code className="block p-2 bg-background rounded border text-xs break-all">
                  {publicUrl}
                </code>
              </div>

              <div className="flex gap-2">
                <Button onClick={copyToClipboard} variant="outline" className="flex-1">
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
                  opt-in verification form.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
