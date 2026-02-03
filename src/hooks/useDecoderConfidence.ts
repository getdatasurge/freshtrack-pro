import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DecoderConfidenceRow {
  decoder_id: string;
  compared_count: number;
  match_count: number;
  mismatch_count: number;
  match_rate_pct: number | null;
  last_seen_at: string;
  first_seen_at: string;
  top_mismatch_reason: string | null;
}

export interface DecoderMismatchReading {
  id: string;
  recorded_at: string;
  lora_sensor_id: string | null;
  f_port: number | null;
  raw_payload_hex: string | null;
  network_decoded_payload: Record<string, unknown> | null;
  app_decoded_payload: Record<string, unknown> | null;
  decode_mismatch_reason: string | null;
  decoder_warnings: unknown[] | null;
  decoder_errors: unknown[] | null;
}

/**
 * Fetch aggregated decoder confidence rollup for all decoder IDs.
 * Platform-admin only — queries the decoder_confidence_rollup view.
 */
export function useDecoderConfidence() {
  return useQuery<DecoderConfidenceRow[]>({
    queryKey: ["decoder-confidence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decoder_confidence_rollup")
        .select("*")
        .order("mismatch_count", { ascending: false });

      // View may not exist if migrations haven't been applied yet — return empty
      if (error) {
        const code = error.code ?? "";
        const msg = error.message ?? "";
        if (code === "PGRST204" || code === "42P01" || msg.includes("does not exist") || msg.includes("404") || msg.includes("Not Found")) {
          console.warn("[DecoderConfidence] View not available yet (migrations pending):", msg);
          return [];
        }
        throw error;
      }
      return (data ?? []) as unknown as DecoderConfidenceRow[];
    },
    staleTime: 30_000, // 30s — live enough for monitoring
    retry: false, // View-missing errors are caught in queryFn; no need to retry
  });
}

/**
 * Fetch recent mismatched readings for a specific decoder_id.
 * Used for the drill-down view in the decoder confidence page.
 */
export function useDecoderMismatches(decoderId: string | null, limit = 50) {
  return useQuery<DecoderMismatchReading[]>({
    queryKey: ["decoder-mismatches", decoderId],
    enabled: !!decoderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select(
          "id, recorded_at, lora_sensor_id, f_port, raw_payload_hex, " +
          "network_decoded_payload, app_decoded_payload, decode_mismatch_reason, " +
          "decoder_warnings, decoder_errors"
        )
        .eq("decoder_id", decoderId!)
        .eq("decode_match", false)
        .order("recorded_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as DecoderMismatchReading[];
    },
    staleTime: 30_000,
  });
}
