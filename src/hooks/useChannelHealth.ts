import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useOrgScope } from "@/hooks/useOrgScope";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChannelHealthData {
  channel: string;
  total7d: number;
  sent7d: number;
  failed7d: number;
  skipped7d: number;
  successRate7d: number; // 0-100
  total24h: number;
  sent24h: number;
  failed24h: number;
  successRate24h: number; // 0-100
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNELS = ["EMAIL", "SMS", "IN_APP_CENTER", "WEB_TOAST"] as const;

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RawEvent {
  channel: string;
  status: string;
  reason: string | null;
  created_at: string;
}

function buildChannelHealth(
  channel: string,
  events: RawEvent[],
  twentyFourHoursAgo: Date,
): ChannelHealthData {
  let sent7d = 0;
  let failed7d = 0;
  let skipped7d = 0;
  let sent24h = 0;
  let failed24h = 0;
  let total24h = 0;

  let lastSuccessAt: string | null = null;
  let lastFailureAt: string | null = null;
  let lastFailureReason: string | null = null;

  for (const event of events) {
    // 7-day counts (all events are within 7 days from the query)
    if (event.status === "SENT") {
      sent7d++;
      if (!lastSuccessAt) {
        lastSuccessAt = event.created_at;
      }
    } else if (event.status === "FAILED") {
      failed7d++;
      if (!lastFailureAt) {
        lastFailureAt = event.created_at;
        lastFailureReason = event.reason;
      }
    } else if (event.status === "SKIPPED") {
      skipped7d++;
    }

    // 24-hour counts
    const eventTime = new Date(event.created_at);
    if (eventTime >= twentyFourHoursAgo) {
      total24h++;
      if (event.status === "SENT") {
        sent24h++;
      } else if (event.status === "FAILED") {
        failed24h++;
      }
    }
  }

  const total7d = sent7d + failed7d + skipped7d;
  const deliveryAttempts7d = sent7d + failed7d;
  const successRate7d =
    deliveryAttempts7d > 0
      ? Math.round((sent7d / deliveryAttempts7d) * 10000) / 100
      : 0;

  const deliveryAttempts24h = sent24h + failed24h;
  const successRate24h =
    deliveryAttempts24h > 0
      ? Math.round((sent24h / deliveryAttempts24h) * 10000) / 100
      : 0;

  return {
    channel,
    total7d,
    sent7d,
    failed7d,
    skipped7d,
    successRate7d,
    total24h,
    sent24h,
    failed24h,
    successRate24h,
    lastSuccessAt,
    lastFailureAt,
    lastFailureReason,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Queries notification_events for the current organization and computes
 * per-channel delivery health statistics over the last 7 days and 24 hours.
 *
 * Returns an array of `ChannelHealthData` for each notification channel:
 * EMAIL, SMS, IN_APP_CENTER, WEB_TOAST.
 *
 * Refetches every 5 minutes. Enabled only when orgId is available.
 */
export function useChannelHealth() {
  const { orgId } = useOrgScope();

  return useQuery({
    queryKey: qk.org(orgId).channelHealth(),
    queryFn: async (): Promise<ChannelHealthData[]> => {
      if (!orgId) return [];

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(
        now.getTime() - 24 * 60 * 60 * 1000,
      );

      const { data, error } = await supabase
        .from("notification_events")
        .select("channel, status, reason, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;

      // Group events by channel
      const eventsByChannel = new Map<string, RawEvent[]>();
      for (const ch of CHANNELS) {
        eventsByChannel.set(ch, []);
      }

      for (const row of data || []) {
        const existing = eventsByChannel.get(row.channel);
        if (existing) {
          existing.push(row as RawEvent);
        }
        // Ignore events for unknown channels
      }

      // Compute health stats for each channel
      return CHANNELS.map((channel) =>
        buildChannelHealth(
          channel,
          eventsByChannel.get(channel) || [],
          twentyFourHoursAgo,
        ),
      );
    },
    enabled: !!orgId,
    refetchInterval: FIVE_MINUTES_MS,
  });
}
