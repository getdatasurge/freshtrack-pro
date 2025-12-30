import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlugCheckResponse {
  available: boolean;
  slug: string;
  suggestions?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

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

    if (!normalizedSlug || normalizedSlug.length < 2) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          slug: normalizedSlug,
          error: "Slug must be at least 2 characters" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if slug is available (only active orgs, not soft-deleted)
    const { data: isAvailable, error } = await supabase.rpc("check_slug_available", {
      p_slug: normalizedSlug,
    });

    if (error) {
      console.error("Error checking slug:", error);
      throw error;
    }

    const response: SlugCheckResponse = {
      available: isAvailable,
      slug: normalizedSlug,
    };

    // If not available, generate suggestions
    if (!isAvailable) {
      const suggestions: string[] = [];
      const baseSuggestions = [
        `${normalizedSlug}-2`,
        `${normalizedSlug}-${new Date().getFullYear()}`,
        `my-${normalizedSlug}`,
        `${normalizedSlug}-co`,
      ];

      // Check each suggestion for availability
      for (const suggestion of baseSuggestions) {
        const { data: suggestionAvailable } = await supabase.rpc("check_slug_available", {
          p_slug: suggestion,
        });
        if (suggestionAvailable) {
          suggestions.push(suggestion);
        }
        if (suggestions.length >= 3) break;
      }

      // If we still need more suggestions, try numbered suffixes
      if (suggestions.length < 3) {
        for (let i = 3; i <= 10 && suggestions.length < 3; i++) {
          const numberedSlug = `${normalizedSlug}-${i}`;
          const { data: numberedAvailable } = await supabase.rpc("check_slug_available", {
            p_slug: numberedSlug,
          });
          if (numberedAvailable) {
            suggestions.push(numberedSlug);
          }
        }
      }

      response.suggestions = suggestions;
    }

    console.log(`[check-slug-available] Checked slug "${normalizedSlug}": available=${isAvailable}`);

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
