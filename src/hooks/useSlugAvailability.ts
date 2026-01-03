import { useState, useEffect, useRef, useCallback } from "react";

// Simple logging for slug availability checks
const logSlugCheck = (message: string, data?: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    console.log(`[slug-check] ${message}`, data || "");
  }
};

interface SlugStatus {
  isChecking: boolean;
  available: boolean | null;
  normalizedSlug: string;
  suggestions: string[];
  conflicts: string[];
  error: string | null;
}

interface UseSlugAvailabilityOptions {
  debounceMs?: number;
  excludeOrgId?: string | null;
  minLength?: number;
}

const generateClientSideSuggestions = (slug: string): string[] => {
  if (!slug || slug.length < 2) return [];
  const year = new Date().getFullYear();
  return [
    `${slug}-2`,
    `${slug}-${year}`,
    `my-${slug}`,
    `${slug}-co`,
    `${slug}-app`,
  ];
};

export function useSlugAvailability(
  slug: string,
  options: UseSlugAvailabilityOptions = {}
) {
  const { debounceMs = 500, excludeOrgId = null, minLength = 2 } = options;

  const [status, setStatus] = useState<SlugStatus>({
    isChecking: false,
    available: null,
    normalizedSlug: "",
    suggestions: [],
    conflicts: [],
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkSlug = useCallback(async (slugToCheck: string) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Normalize the slug client-side for preview
    const normalized = slugToCheck
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!normalized || normalized.length < minLength) {
      setStatus({
        isChecking: false,
        available: null,
        normalizedSlug: normalized,
        suggestions: [],
        conflicts: [],
        error: null,
      });
      return;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setStatus(prev => ({
      ...prev,
      isChecking: true,
      normalizedSlug: normalized,
      error: null,
    }));

    logSlugCheck(`Checking slug availability: "${normalized}"`, { 
      original: slugToCheck, 
      normalized,
      excludeOrgId 
    });

    try {
      const params = new URLSearchParams({ slug: slugToCheck });
      if (excludeOrgId) {
        params.append("exclude_org_id", excludeOrgId);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-slug-available?${params}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      logSlugCheck(`Slug check result: "${normalized}"`, {
        available: result.available,
        suggestionsCount: result.suggestions?.length || 0,
        conflicts: result.conflicts,
      });

      // Generate client-side fallback suggestions if backend didn't provide any
      let suggestions = result.suggestions || [];
      if (!result.available && suggestions.length === 0) {
        suggestions = generateClientSideSuggestions(normalized);
        logSlugCheck("Using client-side fallback suggestions", { suggestions });
      }

      setStatus({
        isChecking: false,
        available: result.available,
        normalizedSlug: result.normalizedSlug || normalized,
        suggestions,
        conflicts: result.conflicts || [],
        error: null,
      });
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === "AbortError") {
        return;
      }

      console.error("Error checking slug:", error);

      // On error, don't block user - assume available with warning
      setStatus({
        isChecking: false,
        available: null, // null means unknown/couldn't check
        normalizedSlug: normalized,
        suggestions: [],
        conflicts: [],
        error: "Could not verify availability. You can still proceed.",
      });
    }
  }, [excludeOrgId, minLength]);

  // Debounced effect
  useEffect(() => {
    if (!slug) {
      setStatus({
        isChecking: false,
        available: null,
        normalizedSlug: "",
        suggestions: [],
        conflicts: [],
        error: null,
      });
      return;
    }

    const timer = setTimeout(() => {
      checkSlug(slug);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [slug, debounceMs, checkSlug]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus({
      isChecking: false,
      available: null,
      normalizedSlug: "",
      suggestions: [],
      conflicts: [],
      error: null,
    });
  }, []);

  return { status, reset };
}
