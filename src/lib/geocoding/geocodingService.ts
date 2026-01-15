/**
 * Geocoding service using Nominatim (OpenStreetMap)
 * Free API, no key required
 * Rate limit: 1 request per second
 */

export interface GeocodingResult {
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
  type: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

// Rate limiting
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to respect Nominatim's 1/sec limit
let lastRequestTime = 0;

// Simple in-memory cache
const cache = new Map<string, GeocodingResult[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildShortName(address?: NominatimResult["address"]): string {
  if (!address) return "";
  
  const city = address.city || address.town || address.village || "";
  const state = address.state || "";
  const country = address.country || "";
  
  const parts = [city, state, country].filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const trimmedQuery = query.trim();
  
  // Minimum query length
  if (trimmedQuery.length < 3) {
    return [];
  }
  
  // Check cache
  const cacheKey = trimmedQuery.toLowerCase();
  const cachedTimestamp = cacheTimestamps.get(cacheKey);
  if (cachedTimestamp && Date.now() - cachedTimestamp < CACHE_TTL) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }
  
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
  
  try {
    const params = new URLSearchParams({
      q: trimmedQuery,
      format: "json",
      addressdetails: "1",
      limit: "5",
    });
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "FreshTrackPro/1.0 (site-location-config)",
          "Accept-Language": "en",
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.");
      }
      throw new Error(`Geocoding request failed: ${response.status}`);
    }
    
    const data: NominatimResult[] = await response.json();
    
    const results: GeocodingResult[] = data.map((item) => ({
      displayName: item.display_name,
      shortName: buildShortName(item.address) || item.display_name.split(",")[0],
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type,
    }));
    
    // Cache results
    cache.set(cacheKey, results);
    cacheTimestamps.set(cacheKey, Date.now());
    
    return results;
  } catch (error) {
    console.error("Geocoding error:", error);
    throw error;
  }
}

export function clearGeocodingCache(): void {
  cache.clear();
  cacheTimestamps.clear();
}
