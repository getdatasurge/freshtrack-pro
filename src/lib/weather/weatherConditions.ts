/**
 * Weather Conditions Mapping
 * 
 * Maps WMO weather codes (used by Open-Meteo) to human-readable conditions.
 * Reference: https://open-meteo.com/en/docs
 */

import { 
  Sun, 
  Cloud, 
  CloudSun, 
  CloudRain, 
  CloudSnow, 
  CloudFog,
  CloudLightning,
  Snowflake,
  CloudDrizzle,
  type LucideIcon 
} from "lucide-react";

export interface WeatherCondition {
  code: number;
  description: string;
  icon: LucideIcon;
  category: "clear" | "cloudy" | "rain" | "snow" | "fog" | "storm";
}

/**
 * WMO Weather interpretation codes (WW) to condition mapping
 */
export const WEATHER_CONDITIONS: Record<number, WeatherCondition> = {
  // Clear
  0: { code: 0, description: "Clear sky", icon: Sun, category: "clear" },
  
  // Mainly clear, partly cloudy, overcast
  1: { code: 1, description: "Mainly clear", icon: Sun, category: "clear" },
  2: { code: 2, description: "Partly cloudy", icon: CloudSun, category: "cloudy" },
  3: { code: 3, description: "Overcast", icon: Cloud, category: "cloudy" },
  
  // Fog
  45: { code: 45, description: "Fog", icon: CloudFog, category: "fog" },
  48: { code: 48, description: "Depositing rime fog", icon: CloudFog, category: "fog" },
  
  // Drizzle
  51: { code: 51, description: "Light drizzle", icon: CloudDrizzle, category: "rain" },
  53: { code: 53, description: "Moderate drizzle", icon: CloudDrizzle, category: "rain" },
  55: { code: 55, description: "Dense drizzle", icon: CloudDrizzle, category: "rain" },
  
  // Freezing drizzle
  56: { code: 56, description: "Light freezing drizzle", icon: CloudDrizzle, category: "rain" },
  57: { code: 57, description: "Dense freezing drizzle", icon: CloudDrizzle, category: "rain" },
  
  // Rain
  61: { code: 61, description: "Slight rain", icon: CloudRain, category: "rain" },
  63: { code: 63, description: "Moderate rain", icon: CloudRain, category: "rain" },
  65: { code: 65, description: "Heavy rain", icon: CloudRain, category: "rain" },
  
  // Freezing rain
  66: { code: 66, description: "Light freezing rain", icon: CloudRain, category: "rain" },
  67: { code: 67, description: "Heavy freezing rain", icon: CloudRain, category: "rain" },
  
  // Snow fall
  71: { code: 71, description: "Slight snow", icon: Snowflake, category: "snow" },
  73: { code: 73, description: "Moderate snow", icon: CloudSnow, category: "snow" },
  75: { code: 75, description: "Heavy snow", icon: CloudSnow, category: "snow" },
  
  // Snow grains
  77: { code: 77, description: "Snow grains", icon: Snowflake, category: "snow" },
  
  // Rain showers
  80: { code: 80, description: "Slight rain showers", icon: CloudRain, category: "rain" },
  81: { code: 81, description: "Moderate rain showers", icon: CloudRain, category: "rain" },
  82: { code: 82, description: "Violent rain showers", icon: CloudRain, category: "rain" },
  
  // Snow showers
  85: { code: 85, description: "Slight snow showers", icon: CloudSnow, category: "snow" },
  86: { code: 86, description: "Heavy snow showers", icon: CloudSnow, category: "snow" },
  
  // Thunderstorm
  95: { code: 95, description: "Thunderstorm", icon: CloudLightning, category: "storm" },
  96: { code: 96, description: "Thunderstorm with slight hail", icon: CloudLightning, category: "storm" },
  99: { code: 99, description: "Thunderstorm with heavy hail", icon: CloudLightning, category: "storm" },
};

/**
 * Get weather condition from WMO code
 */
export function getWeatherCondition(code: number): WeatherCondition {
  return WEATHER_CONDITIONS[code] ?? {
    code,
    description: "Unknown",
    icon: Cloud,
    category: "cloudy" as const,
  };
}

/**
 * Get condition background color class based on category
 */
export function getConditionBgClass(category: WeatherCondition["category"]): string {
  switch (category) {
    case "clear":
      return "bg-yellow-500/10";
    case "cloudy":
      return "bg-gray-500/10";
    case "rain":
      return "bg-blue-500/10";
    case "snow":
      return "bg-sky-500/10";
    case "fog":
      return "bg-gray-400/10";
    case "storm":
      return "bg-purple-500/10";
    default:
      return "bg-muted";
  }
}

/**
 * Get condition text color class based on category
 */
export function getConditionTextClass(category: WeatherCondition["category"]): string {
  switch (category) {
    case "clear":
      return "text-yellow-500";
    case "cloudy":
      return "text-gray-500";
    case "rain":
      return "text-blue-500";
    case "snow":
      return "text-sky-500";
    case "fog":
      return "text-gray-400";
    case "storm":
      return "text-purple-500";
    default:
      return "text-muted-foreground";
  }
}
