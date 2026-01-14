/**
 * Weather Service
 * 
 * Uses Open-Meteo API (free, no API key required) for weather data.
 * API Docs: https://open-meteo.com/en/docs
 */

const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1";

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  conditionCode: number;
  windSpeed: number;
  lastUpdated: string;
}

export interface HourlyWeather {
  time: string;
  temperature: number;
  humidity: number;
  conditionCode: number;
  windSpeed: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyWeather[];
}

interface OpenMeteoCurrentResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
}

interface OpenMeteoHistoricalResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
  };
}

/**
 * Get current weather and hourly forecast
 */
export async function getCurrentWeather(
  lat: number,
  lon: number,
  timezone: string = "auto"
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    forecast_hours: "24",
    timezone,
  });

  const response = await fetch(`${OPEN_METEO_BASE_URL}/forecast?${params}`);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data: OpenMeteoCurrentResponse = await response.json();

  // Parse current weather
  const current: CurrentWeather = {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    conditionCode: data.current.weather_code,
    windSpeed: data.current.wind_speed_10m,
    lastUpdated: data.current.time,
  };

  // Parse hourly forecast
  const hourly: HourlyWeather[] = data.hourly.time.map((time, index) => ({
    time,
    temperature: data.hourly.temperature_2m[index],
    humidity: data.hourly.relative_humidity_2m[index],
    conditionCode: data.hourly.weather_code[index],
    windSpeed: data.hourly.wind_speed_10m[index],
  }));

  return { current, hourly };
}

/**
 * Get historical weather data for a time range
 */
export async function getWeatherTimeseries(
  lat: number,
  lon: number,
  timezone: string,
  startDate: Date,
  endDate: Date
): Promise<HourlyWeather[]> {
  // Open-Meteo historical API format: YYYY-MM-DD
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    hourly: "temperature_2m,relative_humidity_2m",
    timezone,
  });

  // Use archive API for historical data (up to yesterday)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isHistorical = endDate < today;

  const apiPath = isHistorical ? "/archive" : "/forecast";
  const response = await fetch(`${OPEN_METEO_BASE_URL}${apiPath}?${params}`);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data: OpenMeteoHistoricalResponse = await response.json();

  return data.hourly.time.map((time, index) => ({
    time,
    temperature: data.hourly.temperature_2m[index],
    humidity: data.hourly.relative_humidity_2m[index],
    conditionCode: 0, // Not available in historical data
    windSpeed: 0,
  }));
}

/**
 * Check if location coordinates are valid
 */
export function isValidLocation(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat == null || lon == null) return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}
