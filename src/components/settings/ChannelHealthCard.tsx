import { useChannelHealth, type ChannelHealthData } from "@/hooks/useChannelHealth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Mail,
  MessageSquare,
  Smartphone,
  Monitor,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LucideIcon } from "lucide-react";

// ─── Channel config ─────────────────────────────────────────────────────────

interface ChannelDef {
  key: string;
  label: string;
  icon: LucideIcon;
  dbChannel: string;
}

const CHANNELS: ChannelDef[] = [
  { key: "email", label: "Email", icon: Mail, dbChannel: "EMAIL" },
  { key: "sms", label: "SMS", icon: MessageSquare, dbChannel: "SMS" },
  { key: "in_app", label: "In-App", icon: Smartphone, dbChannel: "IN_APP_CENTER" },
  { key: "web_toast", label: "Web Toast", icon: Monitor, dbChannel: "WEB_TOAST" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusColor(data: ChannelHealthData | undefined): string {
  if (!data || data.total7d === 0) return "bg-gray-400";
  if (data.successRate7d > 95) return "bg-green-500";
  if (data.successRate7d >= 80) return "bg-yellow-500";
  return "bg-red-500";
}

function getStatusLabel(data: ChannelHealthData | undefined): string {
  if (!data || data.total7d === 0) return "No data";
  if (data.successRate7d > 95) return "Healthy";
  if (data.successRate7d >= 80) return "Degraded";
  return "Unhealthy";
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "N/A";
  try {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

// ─── Sub-component: Single channel card ─────────────────────────────────────

interface ChannelSubCardProps {
  channel: ChannelDef;
  data: ChannelHealthData | undefined;
}

function ChannelSubCard({ channel, data }: ChannelSubCardProps) {
  const Icon = channel.icon;
  const statusDotColor = getStatusColor(data);
  const statusLabel = getStatusLabel(data);
  const hasData = data && data.total7d > 0;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header: icon + name + status dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{channel.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-2.5 w-2.5 rounded-full ${statusDotColor}`} />
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Stats row */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                24h: {data.sent24h} sent, {data.failed24h} failed
              </span>
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                7d success: {data.successRate7d}%
              </Badge>
            </div>
          </div>

          {/* Last delivery */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last delivery</span>
            <span className="font-medium">
              {formatRelativeTime(data.lastSuccessAt)}
            </span>
          </div>

          {/* Last failure (if any) */}
          {data.lastFailureAt && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-destructive font-medium">Last failure</span>
                <span className="text-destructive/70">
                  {formatRelativeTime(data.lastFailureAt)}
                </span>
              </div>
              {data.lastFailureReason && (
                <p className="text-xs text-destructive/80 break-words">
                  {data.lastFailureReason}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          No notification events recorded for this channel yet.
        </p>
      )}

      {/* Verify button (disabled, defers to Notification Testing panel) */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block w-full">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled
              >
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Verify
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Use Notification Testing panel to send a test</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function ChannelHealthSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ChannelHealthCard() {
  const { data: channelHealthList, isLoading } = useChannelHealth();

  // Build a lookup map: dbChannel -> ChannelHealthData
  const healthByChannel = new Map<string, ChannelHealthData>();
  if (channelHealthList) {
    for (const item of channelHealthList) {
      healthByChannel.set(item.channel, item);
    }
  }

  // Determine if there are any events at all
  const hasAnyEvents =
    channelHealthList && channelHealthList.some((ch) => ch.total7d > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Notification Channel Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChannelHealthSkeleton />
        ) : !channelHealthList || !hasAnyEvents ? (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No notification events recorded yet. Channel health data will appear
              here once notifications begin flowing.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {CHANNELS.map((channel) => (
              <ChannelSubCard
                key={channel.key}
                channel={channel}
                data={healthByChannel.get(channel.dbChannel)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
