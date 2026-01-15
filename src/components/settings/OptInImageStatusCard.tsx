import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Copy, 
  ExternalLink,
  ImageIcon,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

// Expected public URL for the opt-in image (hosted in public folder, auto-deployed with app)
const getExpectedImageUrl = () => {
  // Use the app's origin for the public folder path
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/telnyx/opt-in-verification.png`;
  }
  return "/telnyx/opt-in-verification.png";
};

interface VerificationResult {
  accessible: boolean;
  status: number | null;
  statusText?: string;
  contentType: string | null;
  contentLength: number | null;
  isImage: boolean;
  checkedAt: string;
  error: string | null;
}

export function OptInImageStatusCard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const expectedImageUrl = getExpectedImageUrl();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["opt-in-image-status", expectedImageUrl],
    queryFn: async (): Promise<VerificationResult> => {
      const { data, error } = await supabase.functions.invoke("verify-public-asset", {
        body: { url: expectedImageUrl }
      });

      if (error) {
        throw error;
      }

      return data as VerificationResult;
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(expectedImageUrl);
    toast.success("URL copied to clipboard");
  };

  const formatBytes = (bytes: number | null) => {
    if (bytes === null) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="secondary">Checking...</Badge>;
    }
    if (error) {
      return <Badge variant="destructive">Check Failed</Badge>;
    }
    if (!data) {
      return <Badge variant="secondary">Unknown</Badge>;
    }
    if (data.accessible && data.isImage) {
      return <Badge className="bg-green-500 hover:bg-green-600">Accessible</Badge>;
    }
    if (data.accessible && !data.isImage) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Wrong Content Type</Badge>;
    }
    return <Badge variant="destructive">Not Accessible</Badge>;
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
    if (error || !data) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    if (data.accessible && data.isImage) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Opt-In Verification Image</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Image URL required for Telnyx toll-free verification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Display */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            {getStatusIcon()}
            <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
              {expectedImageUrl}
            </code>
          </div>
        </div>

        {/* Status Details */}
        {data && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">HTTP Status:</div>
            <div className={data.accessible ? "text-green-600" : "text-destructive"}>
              {data.status ? `${data.status} ${data.statusText || ""}` : "N/A"}
            </div>
            
            <div className="text-muted-foreground">Content Type:</div>
            <div className={data.isImage ? "text-green-600" : "text-yellow-600"}>
              {data.contentType || "Unknown"}
            </div>
            
            <div className="text-muted-foreground">File Size:</div>
            <div>{formatBytes(data.contentLength)}</div>
            
            <div className="text-muted-foreground">Last Checked:</div>
            <div>{data.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : "Never"}</div>
          </div>
        )}

        {/* Error Display */}
        {data?.error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <strong>Error:</strong> {data.error}
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <strong>Verification check failed:</strong> {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}

        {/* Not accessible warning */}
        {data && !data.accessible && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
            <p className="text-yellow-800 dark:text-yellow-200">
              <strong>Action Required:</strong> The opt-in image is not publicly accessible. 
              Upload it using the <a href="/admin/upload-telnyx-image" className="underline">upload utility</a>.
            </p>
          </div>
        )}

        {/* Success state */}
        {data?.accessible && data?.isImage && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-sm">
            <p className="text-green-800 dark:text-green-200">
              <strong>Ready for Telnyx:</strong> This URL is publicly accessible and can be used for toll-free verification.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Verify Now
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyUrl}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy URL
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href={expectedImageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href="/admin/upload-telnyx-image">
              Upload New
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
