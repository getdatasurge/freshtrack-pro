import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlugCheckResponse {
  available: boolean;
  slug: string;
  normalizedSlug: string;
  conflicts: string[];
  suggestions: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const excludeOrgId = url.searchParams.get("exclude_org_id");

    console.log(`[check-slug-available] Request: slug="${slug}", exclude_org_id=${excludeOrgId || "none"}`);

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing 'slug' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize slug
    const normalizedSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    console.log(`[check-slug-available] Normalized: "${slug}" -> "${normalizedSlug}"`);

    if (!normalizedSlug || normalizedSlug.length < 2) {
      console.log(`[check-slug-available] Rejected: slug too short (${normalizedSlug.length} chars)`);
      return new Response(
        JSON.stringify({ 
          available: false, 
          slug: slug,
          normalizedSlug: normalizedSlug,
          conflicts: ["Slug must be at least 2 characters"],
          suggestions: [],
        } as SlugCheckResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if slug is available using the updated function with exclusion support
    const { data: isAvailable, error } = await supabase.rpc("check_slug_available", {
      p_slug: normalizedSlug,
      p_exclude_org_id: excludeOrgId || null,
    });

    if (error) {
      console.error("[check-slug-available] RPC error:", error);
      throw error;
    }

    console.log(`[check-slug-available] Query result: available=${isAvailable}`);

    const response: SlugCheckResponse = {
      available: isAvailable,
      slug: slug,
      normalizedSlug: normalizedSlug,
      conflicts: [],
      suggestions: [],
    };

    // If not available, find the conflict and generate suggestions
    if (!isAvailable) {
      // Find the conflicting organization for the conflicts array
      const { data: conflictingOrg } = await supabase
        .from("organizations")
        .select("name")
        .ilike("slug", normalizedSlug)
        .is("deleted_at", null)
        .maybeSingle();

      if (conflictingOrg) {
        response.conflicts = [`This URL is already in use`];
        console.log(`[check-slug-available] Conflict found: organization exists with this slug`);
      }

      // Generate suggestions
      const currentYear = new Date().getFullYear();
      const baseSuggestions = [
        `${normalizedSlug}-2`,
        `${normalizedSlug}-${currentYear}`,
        `my-${normalizedSlug}`,
        `${normalizedSlug}-co`,
        `${normalizedSlug}-app`,
      ];

      // Check each suggestion for availability
      for (const suggestion of baseSuggestions) {
        if (response.suggestions.length >= 5) break;
        
        const { data: suggestionAvailable } = await supabase.rpc("check_slug_available", {
          p_slug: suggestion,
          p_exclude_org_id: excludeOrgId || null,
        });
        if (suggestionAvailable) {
          response.suggestions.push(suggestion);
        }
      }

      // If we still need more suggestions, try numbered suffixes
      if (response.suggestions.length < 3) {
        for (let i = 3; i <= 10 && response.suggestions.length < 5; i++) {
          const numberedSlug = `${normalizedSlug}-${i}`;
          const { data: numberedAvailable } = await supabase.rpc("check_slug_available", {
            p_slug: numberedSlug,
            p_exclude_org_id: excludeOrgId || null,
          });
          if (numberedAvailable) {
            response.suggestions.push(numberedSlug);
          }
        }
      }

      console.log(`[check-slug-available] Generated ${response.suggestions.length} suggestions: ${response.suggestions.join(", ")}`);
    }

    console.log(`[check-slug-available] Result: slug="${normalizedSlug}", available=${isAvailable}, suggestions=${response.suggestions.length}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-slug-available] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});