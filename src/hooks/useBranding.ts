import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrgBranding {
  name: string;
  logoUrl: string | null;
  accentColor: string;
}

const DEFAULT_ACCENT = "#0097a7";

/**
 * Hook to fetch organization branding settings
 */
export function useBranding() {
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("name, logo_url, accent_color")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (org) {
        setBranding({
          name: org.name,
          logoUrl: org.logo_url,
          accentColor: org.accent_color || DEFAULT_ACCENT,
        });

        // Apply accent color as CSS variable if different from default
        if (org.accent_color && org.accent_color !== DEFAULT_ACCENT) {
          applyAccentColor(org.accent_color);
        }
      }
    } catch (error) {
      console.error("Error loading branding:", error);
    } finally {
      setLoading(false);
    }
  };

  return { branding, loading };
}

/**
 * Convert hex color to HSL values for CSS variable
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Apply accent color to CSS variables
 */
function applyAccentColor(hexColor: string) {
  const hsl = hexToHSL(hexColor);
  if (!hsl) return;

  const root = document.documentElement;
  const hslValue = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  
  root.style.setProperty("--accent", hslValue);
  root.style.setProperty("--ring", hslValue);
  root.style.setProperty("--sidebar-primary", hslValue);
  root.style.setProperty("--chart-1", hslValue);
}
