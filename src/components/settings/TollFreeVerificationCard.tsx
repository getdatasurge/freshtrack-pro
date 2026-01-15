import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  Loader2,
  HelpCircle,
  Copy,
  Check
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

// Messaging Profile configuration - source of truth
const MESSAGING_PROFILE = {
  name: "frost guard",
  id: "40019baa-aa62-463c-b254-463c66f4b2d3",
} as const;

interface VerificationStatus {
  status: "approved" | "pending" | "rejected" | "unknown";
  verificationId: string;
  phoneNumber: string;
  details?: string;
  lastChecked: string;
}

const statusConfig: Record<VerificationStatus["status"], {
  icon: React.ElementType;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  description: string;
}> = {
  approved: {
    icon: CheckCircle2,
    label: "Verified",
    variant: "default",
    className: "bg-safe text-safe-foreground hover:bg-safe/90",
    description: "Toll-free number is verified. SMS messages can be sent.",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    variant: "secondary",
    className: "bg-warning/15 text-warning border-warning/30",
    description: "Verification in progress. SMS may have limited deliverability.",
  },
  rejected: {
    icon: AlertCircle,
    label: "Rejected",
    variant: "destructive",
    className: "",
    description: "Verification was rejected. SMS delivery may be blocked.",
  },
  unknown: {
    icon: HelpCircle,
    label: "Unknown",
    variant: "outline",
    className: "",
    description: "Unable to determine verification status.",
  },
};

export function TollFreeVerificationCard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedProfileId, setCopiedProfileId] = useState(false);

  const handleCopyProfileId = async () => {
    try {
      await navigator.clipboard.writeText(MESSAGING_PROFILE.id);
      setCopiedProfileId(true);
      toast.success("Profile ID copied to clipboard");
      setTimeout(() => setCopiedProfileId(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const { data: verification, isLoading, error, refetch } = useQuery({
    queryKey: ["telnyx-verification-status"],
    queryFn: async (): Promise<VerificationStatus> => {
      const { data, error } = await supabase.functions.invoke("telnyx-verification-status");
      
      if (error) {
        console.error("[TollFreeVerificationCard] Error fetching status:", error);
        throw error;
      }
      
      return data as VerificationStatus;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Format +18889890560 as +1 (888) 989-0560
    if (phone.startsWith("+1") && phone.length === 12) {
      const area = phone.slice(2, 5);
      const prefix = phone.slice(5, 8);
      const line = phone.slice(8);
      return `+1 (${area}) ${prefix}-${line}`;
    }
    return phone;
  };

  const status = verification?.status || "unknown";
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Toll-Free SMS Verification</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <CardDescription>
          SMS alerts are sent from a verified toll-free number
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking verification status...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to check verification status</span>
          </div>
        ) : (
          <>
            {/* Messaging Profile Row */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Messaging Profile</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {MESSAGING_PROFILE.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleCopyProfileId}
                >
                  {copiedProfileId ? (
                    <Check className="h-3 w-3 text-safe" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Status Row */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={config.variant} className={config.className}>
                <StatusIcon className="h-3.5 w-3.5 mr-1" />
                {config.label}
              </Badge>
            </div>

            {/* Phone Number Row */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Toll-Free Number</span>
              <span className="text-sm font-mono text-muted-foreground">
                {formatPhoneNumber(verification?.phoneNumber || "+18889890560")}
              </span>
            </div>

            {/* Status Description */}
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
              {status === "pending" && verification?.details && (
                <p className="text-sm text-warning mt-2">
                  {verification.details}
                </p>
              )}
              {status === "rejected" && verification?.details && (
                <p className="text-sm text-destructive mt-2">
                  Reason: {verification.details}
                </p>
              )}
            </div>

            {/* Verification ID with tooltip */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>Verification ID</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Telnyx toll-free verification identifier</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <code className="font-mono text-muted-foreground">
                {verification?.verificationId?.slice(0, 8)}...
              </code>
            </div>

            {/* Last checked timestamp */}
            {verification?.lastChecked && (
              <p className="text-xs text-muted-foreground text-right">
                Last checked: {new Date(verification.lastChecked).toLocaleTimeString()}
              </p>
            )}

            {/* Warning banner for non-approved status */}
            {status !== "approved" && status !== "unknown" && (
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
                <p className="text-sm text-warning flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    SMS alerts may have limited deliverability until verification is complete. 
                    Critical alerts will still be sent, but some carriers may block unverified traffic.
                  </span>
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
