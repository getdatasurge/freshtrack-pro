import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deobfuscateKey, getLast4 } from "../_shared/ttnConfig.ts";

/**
 * ttn-credential-audit
 *
 * Super-admin-only, READ-ONLY diagnostic.
 * For every org's ttn_connections row, reports per encrypted credential:
 *   column -> detected scheme (b64 | v2 | legacy | null)
 *        -> recoverable_without_salt (true only for b64)
 *        -> decodes_with_current_salt (does the current env salt still work?)
 *        -> last4 (masked; never the full key)
 *
 * Never returns plaintext credentials.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Scheme = "b64" | "v2" | "legacy" | "null";

function detectScheme(v: string | null): Scheme {
  if (!v) return "null";
  if (v.startsWith("b64:")) return "b64";
  if (v.startsWith("v2:")) return "v2";
  return "legacy";
}

// A decoded TTN API key looks like "NNSXS.XXXX..."; webhook secrets are 48 hex chars.
function looksPlausible(kind: "api_key" | "webhook_secret", decoded: string): boolean {
  if (!decoded) return false;
  if (kind === "api_key") return /^NNSXS\.[A-Z0-9]{10,}$/i.test(decoded);
  return /^[a-f0-9]{32,64}$/i.test(decoded);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // --- AuthN: valid JWT required ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Unauthorized" });
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return json({ ok: false, error: "Unauthorized" });
  }

  // --- AuthZ: super admin only ---
  const { data: isSuperAdmin, error: roleError } = await userClient.rpc(
    "is_current_user_super_admin",
  );
  if (roleError || isSuperAdmin !== true) {
    return json({ ok: false, error: "Forbidden: super admin role required" });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const salt = Deno.env.get("TTN_ENCRYPTION_SALT") || serviceKey.slice(0, 32);
  const saltSource = Deno.env.get("TTN_ENCRYPTION_SALT")
    ? "TTN_ENCRYPTION_SALT"
    : "service_role_key_prefix_fallback";

  const { data: rows, error: rowsError } = await admin
    .from("ttn_connections")
    .select(
      "organization_id, is_enabled, ttn_api_key_encrypted, ttn_api_key_last4, ttn_org_api_key_encrypted, ttn_org_api_key_last4, ttn_webhook_secret_encrypted, ttn_webhook_secret_last4, organizations(slug, name)",
    );

  if (rowsError) {
    console.error("[ttn-credential-audit] query failed", rowsError.message);
    return json({ ok: false, error: "Failed to read ttn_connections" });
  }

  const credentialDefs = [
    { column: "ttn_api_key_encrypted", kind: "api_key" as const, last4Column: "ttn_api_key_last4" },
    { column: "ttn_org_api_key_encrypted", kind: "api_key" as const, last4Column: "ttn_org_api_key_last4" },
    { column: "ttn_webhook_secret_encrypted", kind: "webhook_secret" as const, last4Column: "ttn_webhook_secret_last4" },
  ];

  let atRiskCount = 0;
  let saltDependentCount = 0;

  const organizations = (rows ?? []).map((row: Record<string, any>) => {
    const credentials = credentialDefs.map((def) => {
      const stored: string | null = row[def.column] ?? null;
      const scheme = detectScheme(stored);
      const recoverableWithoutSalt = scheme === "b64";
      const saltDependent = scheme === "v2" || scheme === "legacy";

      let decodesWithCurrentSalt: boolean | null = null;
      let derivedLast4: string | null = null;

      if (stored) {
        try {
          const decoded = deobfuscateKey(stored, salt);
          decodesWithCurrentSalt = looksPlausible(def.kind, decoded);
          derivedLast4 = decoded ? getLast4(decoded) : null;
        } catch {
          decodesWithCurrentSalt = false;
        }
      }

      if (saltDependent) saltDependentCount++;
      if (saltDependent && decodesWithCurrentSalt !== true) atRiskCount++;

      return {
        column: def.column,
        scheme,
        recoverable_without_salt: recoverableWithoutSalt,
        salt_dependent: saltDependent,
        decodes_with_current_salt: decodesWithCurrentSalt,
        // masked only — never the full credential
        stored_last4: row[def.last4Column] ?? null,
        derived_last4: derivedLast4,
        last4_matches: derivedLast4 !== null && row[def.last4Column] === derivedLast4,
      };
    });

    return {
      organization_id: row.organization_id,
      slug: row.organizations?.slug ?? null,
      name: row.organizations?.name ?? null,
      is_enabled: row.is_enabled ?? false,
      credentials,
      needs_reentry_if_salt_lost: credentials.some((c) => c.salt_dependent),
    };
  });

  const summary = {
    organizations_scanned: organizations.length,
    salt_source: saltSource,
    salt_dependent_credentials: saltDependentCount,
    credentials_needing_reentry_if_salt_lost: saltDependentCount,
    credentials_failing_to_decode_now: atRiskCount,
    orgs_needing_reprovision_if_salt_lost: organizations
      .filter((o) => o.needs_reentry_if_salt_lost)
      .map((o) => o.slug ?? o.organization_id),
  };

  console.log("[ttn-credential-audit]", JSON.stringify(summary));

  return json({ ok: true, summary, organizations });
});