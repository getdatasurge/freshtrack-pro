import { 
  Thermometer, 
  Droplets, 
  DoorClosed, 
  Radar, 
  Gauge, 
  MapPin, 
  Cloud, 
  Layers, 
  Fingerprint,
  type LucideIcon 
} from "lucide-react";

export interface SensorTypeOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

/**
 * All sensor types supported by the lora_sensor_type enum.
 * This is the single source of truth for sensor type options in the UI.
 */
export const SENSOR_TYPE_OPTIONS: SensorTypeOption[] = [
  { value: "temperature", label: "Temperature", icon: Thermometer },
  { value: "temperature_humidity", label: "Temperature + Humidity", icon: Droplets },
  { value: "door", label: "Door/Contact", icon: DoorClosed },
  { value: "motion", label: "Motion", icon: Radar },
  { value: "leak", label: "Leak Detection", icon: Droplets },
  { value: "metering", label: "Metering/Pulse Counter", icon: Gauge },
  { value: "gps", label: "GPS/Location", icon: MapPin },
  { value: "air_quality", label: "Air Quality (CO₂)", icon: Cloud },
  { value: "multi_sensor", label: "Multi-Sensor", icon: Layers },
  { value: "combo", label: "Combo (Temp + Door)", icon: Layers },
  { value: "contact", label: "Contact Switch", icon: Fingerprint },
];

/** All valid sensor type values for Zod schemas */
export const SENSOR_TYPE_VALUES = SENSOR_TYPE_OPTIONS.map(o => o.value) as [string, ...string[]];

export type SensorTypeValue = typeof SENSOR_TYPE_OPTIONS[number]["value"];
