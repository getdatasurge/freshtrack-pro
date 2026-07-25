import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deobfuscateKey, obfuscateKey, getLast4 } from "../_shared/ttnConfig.ts";

/**
 * ttn-credential-reencode
 *
 * ONE-SHOT MIGRATION: rewrites salt-dependent TTN credentials (v2: / legacy)
 * into the salt-independent `b64:` scheme, using the salt that only exists in
 * this project's runtime (TTN_ENCRYPTION_SALT, or service_role_key[:32]).
 *
 * Safety:
 *  - Super-admin only.
 *  - Defaults to dry_run: true. Nothing is written unless dry_run === false.
 *  - Every value must decode to a PLAUSIBLE credential before it is written.
 *    A failed decode is skipped and reported, never overwritten.
 *  - Round-trip verified in memory (b64 re-decode must equal original decode).
 *  - Already-b64 values are left completely untouched.
 *  - Never returns plaintext — last4 only.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = "api_key" | "webhook_secret";

const CREDENTIALS: Array<{ column: string; last4Column: string; kind: Kind }> = [
  { column: "ttn_api_key_encrypted", last4Column: "ttn_api_key_last4", kind: "api_key" },
  { column: "ttn_org_api_key_encrypted", last4Column: "ttn_org_api_key_last4", kind: "api_key" },
  { column: "ttn_webhook_secret_encrypted", last4Column: "ttn_webhook_secret_last4", kind: "webhook_secret" },
];

function looksPlausible(kind: Kind, decoded: string): boolean {
  if (!decoded) return false;
  if (kind === "api_key") return /^NNSXS\.[A-Z0-9]{20,}$/i.test(decoded);
  return /^[a-f0-9]{32,64}$/i.test(decoded);
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsError || !claims?.claims) return json({ ok: false, error: "Unauthorized" });

  const { data: isSuperAdmin, error: roleError } = await userClient.rpc(
    "is_current_user_super_admin",
  );
  if (roleError || isSuperAdmin !== true) {
    return json({ ok: false, error: "Forbidden: super admin role required" });
  }

  let dryRun = true;
  try {
    const body = await req.json();
    if (body?.dry_run === false) dryRun = false;
  } catch {
    // no body -> stay in dry-run
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const salt = Deno.env.get("TTN_ENCRYPTION_SALT") || serviceKey.slice(0, 32);

  const { data: rows, error: rowsError } = await admin
    .from("ttn_connections")
    .select(
      "organization_id, ttn_api_key_encrypted, ttn_api_key_last4, ttn_org_api_key_encrypted, ttn_org_api_key_last4, ttn_webhook_secret_encrypted, ttn_webhook_secret_last4, organizations(slug)",
    );

  if (rowsError) {
    console.error("[ttn-credential-reencode] read failed", rowsError.message);
    return json({ ok: false, error: "Failed to read ttn_connections" });
  }

  const results: unknown[] = [];
  let converted = 0;
  let skippedAlreadyB64 = 0;
  let failed = 0;

  for (const row of (rows ?? []) as Record<string, any>[]) {
    const patch: Record<string, string> = {};
    const perCredential: unknown[] = [];

    for (const def of CREDENTIALS) {
      const stored: string | null = row[def.column] ?? null;
      if (!stored) continue;

      if (stored.startsWith("b64:")) {
        skippedAlreadyB64++;
        perCredential.push({ column: def.column, action: "skip_already_b64" });
        continue;
      }

      let decoded = "";
      try {
        decoded = deobfuscateKey(stored, salt);
      } catch {
        decoded = "";
      }

      if (!looksPlausible(def.kind, decoded)) {
        failed++;
        perCredential.push({
          column: def.column,
          action: "FAILED_decode_implausible",
          scheme: stored.startsWith("v2:") ? "v2" : "legacy",
          stored_last4: row[def.last4Column] ?? null,
        });
        continue;
      }

      // Round-trip check before we trust the new value.
      const reencoded = obfuscateKey(decoded, salt);
      if (deobfuscateKey(reencoded, salt) !== decoded) {
        failed++;
        perCredential.push({ column: def.column, action: "FAILED_roundtrip" });
        continue;
      }

      const derivedLast4 = getLast4(decoded);
      patch[def.column] = reencoded;
      converted++;
      perCredential.push({
        column: def.column,
        action: dryRun ? "would_convert" : "converted",
        scheme_from: stored.startsWith("v2:") ? "v2" : "legacy",
        scheme_to: "b64",
        derived_last4: derivedLast4,
        stored_last4: row[def.last4Column] ?? null,
        last4_matches: row[def.last4Column] === derivedLast4,
      });
    }

    if (!dryRun && Object.keys(patch).length > 0) {
      const { error: updateError } = await admin
        .from("ttn_connections")
        .update(patch)
        .eq("organization_id", row.organization_id);
      if (updateError) {
        console.error("[ttn-credential-reencode] write failed", row.organization_id, updateError.message);
        perCredential.push({ action: "WRITE_FAILED", detail: updateError.message });
      }
    }

    if (perCredential.length > 0) {
      results.push({
        organization_id: row.organization_id,
        slug: row.organizations?.slug ?? null,
        credentials: perCredential,
      });
    }
  }

  const summary = {
    dry_run: dryRun,
    converted,
    skipped_already_b64: skippedAlreadyB64,
    failed,
  };
  console.log("[ttn-credential-reencode]", JSON.stringify(summary));

  return json({ ok: true, summary, results });
});