/**
 * Weather Data Hooks
 * 
 * React Query hooks for weather data with caching.
 */

import { useQuery } from "@tanstack/react-query";
import { 
  getCurrentWeather, 
  getWeatherTimeseries,
  isValidLocation,
  type WeatherData,
  type HourlyWeather
} from "@/lib/weather/weatherService";

/**
 * Hook to fetch current weather and hourly forecast
 */
export function useWeather(
  lat: number | null | undefined,
  lon: number | null | undefined,
  timezone?: string
) {
  const hasLocation = isValidLocation(lat, lon);

  return useQuery<WeatherData | null, Error>({
    queryKey: ["weather", "current", lat, lon, timezone],
    queryFn: async () => {
      if (!hasLocation || lat == null || lon == null) return null;
      return getCurrentWeather(lat, lon, timezone ?? "auto");
    },
    enabled: hasLocation,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook to fetch historical weather data for a time range
 */
export function useWeatherHistory(
  lat: number | null | undefined,
  lon: number | null | undefined,
  timezone: string,
  startDate: Date | null,
  endDate: Date | null
) {
  const hasLocation = isValidLocation(lat, lon);
  const hasDateRange = startDate != null && endDate != null;

  return useQuery<HourlyWeather[], Error>({
    queryKey: [
      "weather", 
      "history", 
      lat, 
      lon, 
      timezone, 
      startDate?.toISOString(), 
      endDate?.toISOString()
    ],
    queryFn: async () => {
      if (!hasLocation || lat == null || lon == null) return [];
      if (!startDate || !endDate) return [];
      return getWeatherTimeseries(lat, lon, timezone, startDate, endDate);
    },
    enabled: hasLocation && hasDateRange,
    staleTime: 30 * 60 * 1000, // 30 minutes for historical data
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
