import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SlugCheckResult {
  available: boolean;
  slug: string;
  suggestions?: string[];
  error?: string;
}

export function useSlugAvailability() {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<SlugCheckResult | null>(null);

  const checkSlug = useCallback(async (slug: string): Promise<SlugCheckResult | null> => {
    if (!slug || slug.length < 2) {
      setResult(null);
      return null;
    }

    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-slug-available", {
        body: null,
        headers: {},
      });

      // Use query params approach - invoke with GET-style
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-slug-available?slug=${encodeURIComponent(slug)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check slug availability");
      }

      const checkResult: SlugCheckResult = await response.json();
      setResult(checkResult);
      return checkResult;
    } catch (error: any) {
      console.error("Error checking slug:", error);
      // On error, assume available (don't block user)
      const fallback: SlugCheckResult = { available: true, slug };
      setResult(fallback);
      return fallback;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    isChecking,
    result,
    checkSlug,
    clearResult,
  };
}
