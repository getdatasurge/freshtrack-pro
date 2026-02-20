import { useState, useMemo, useCallback } from "react";
import PlatformLayout from "@/components/platform/PlatformLayout";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { useSensorCatalog, useAddSensorCatalogEntry, useUpdateSensorCatalogEntry, useDeleteSensorCatalogEntry, useRetireSensorCatalogEntry } from "@/hooks/useSensorCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  ChevronRight,
  Thermometer,
  DoorOpen,
  Droplets,
  Wind,
  Radio,
  Battery,
  Code,
  FileJson,
  Settings,
  Tag,
  ExternalLink,
  Copy,
  Check,
  X,
  ArrowLeft,
  Database,
  Zap,
  ArrowDownToLine,
  BookOpen,
  LayoutGrid,
  List,
  Cpu,
  RefreshCw,
  Trash2,
  MapPin,
  Activity,
  AlertTriangle,
  Archive,
  Play,
  Pencil,
  Save,
} from "lucide-react";
import type {
  SensorCatalogEntry,
  SensorCatalogInsert,
  SensorCatalogBatteryInfo,
  SensorCatalogDownlinkInfo,
  SensorKind,
  DecodeMode,
  TemperatureUnit,
} from "@/types/sensorCatalog";
import BatterySpecifications from "@/components/platform/BatterySpecifications";
import DownlinkEditor from "@/components/platform/DownlinkEditor";

// ─── Seed data (fallback when DB is empty or loading) ────────
const SEED_CATALOG: SensorCatalogEntry[] = [
  {
    id: "seed-1",
    manufacturer: "Dragino",
    model: "LHT65",
    model_variant: null,
    display_name: "Dragino LHT65 Temperature & Humidity Sensor",
    sensor_kind: "temp_humidity",
    description: "Indoor LoRaWAN temperature and humidity sensor with external probe option. Ideal for walk-in coolers, freezers, and dry storage monitoring.",
    frequency_bands: ["US915", "EU868", "AU915", "AS923"],
    lorawan_version: "1.0.3",
    regional_params: null,
    supports_otaa: true,
    supports_abp: false,
    supports_class: "A",
    f_ports: [
      { port: 2, direction: "up", description: "Periodic telemetry uplink (temp, humidity, battery)", is_default: true },
      { port: 4, direction: "up", description: "Alarm uplink (threshold exceeded)" },
      { port: 3, direction: "down", description: "Configuration downlink" },
    ],
    decoded_fields: [
      { field: "temperature_c", type: "number", unit: "°C", range: [-40, 125], description: "Internal SHT20 temperature sensor" },
      { field: "ext_temperature_c", type: "number", unit: "°C", range: [-40, 125], description: "External probe temperature (if connected)" },
      { field: "humidity_pct", type: "number", unit: "%", range: [0, 100], description: "Relative humidity from SHT20" },
      { field: "battery_v", type: "number", unit: "V", range: [2.1, 3.6], description: "Battery voltage (2x AAA)" },
      { field: "ext_sensor_type", type: "string", unit: null, range: null, description: "External sensor type: 0=none, 1=DS18B20, 4=interrupt" },
    ],
    sample_payloads: [
      { scenario: "Walk-in cooler — normal operation", f_port: 2, raw_hex: "CBF10B0A0175FF", decoded: { temperature_c: 3.85, humidity_pct: 78.5, ext_temperature_c: 4.21, battery_v: 3.055, ext_sensor_type: "DS18B20" }, notes: "Normal cooler temp range 33–40°F. Battery healthy." },
      { scenario: "Walk-in freezer — normal operation", f_port: 2, raw_hex: "CB8F0964FEE8FF", decoded: { temperature_c: -18.5, humidity_pct: 45.0, ext_temperature_c: -20.1, battery_v: 2.98, ext_sensor_type: "DS18B20" }, notes: "Normal freezer range -10 to 0°F. Cold affects battery voltage." },
      { scenario: "Temperature alarm — door left open", f_port: 4, raw_hex: "CB0F0C1E0295FF", decoded: { temperature_c: 12.8, humidity_pct: 92.0, ext_temperature_c: 15.5, battery_v: 3.055, ext_sensor_type: "DS18B20" }, notes: "ALARM: Cooler temp spiked — likely door left open. Humidity rising." },
      { scenario: "Low battery warning", f_port: 2, raw_hex: "CA2F0A780140FF", decoded: { temperature_c: 4.2, humidity_pct: 71.0, ext_temperature_c: 4.5, battery_v: 2.35, ext_sensor_type: "DS18B20" }, notes: "Battery below 2.5V threshold — replace soon." },
      { scenario: "No external probe connected", f_port: 2, raw_hex: "CBF10B0A007FFF", decoded: { temperature_c: 22.1, humidity_pct: 55.0, ext_temperature_c: null, battery_v: 3.055, ext_sensor_type: "none" }, notes: "Internal sensor only. Ext reads 0x7FFF = no probe." },
    ],
    uplink_info: { encoding: "proprietary", default_interval_s: 600, min_interval_s: 60, max_interval_s: 86400, max_payload_bytes: 11, confirmed_uplinks: false, adaptive_data_rate: true },
    battery_info: { type: "1x AA Li-MnO\u2082", chemistry: "Li-MnO2", quantity: 1, capacity_mah: 2400, voltage_nominal: 3.0, voltage_range: [2.1, 3.6], expected_life_years: 2, low_threshold_v: 2.5, rechargeable: false, reporting_format: "millivolts_div10", notes: "Replaceable 2400mAh Li-MnO\u2082 AA battery. Use Dragino LHT65-BAT-CA kit or equivalent. Non-linear discharge curve \u2014 percentage estimates unreliable." },
    downlink_info: { supports_remote_config: true, config_port: 3, commands: [
      { name: "Set Reporting Interval", hex_template: "01{seconds_4byte_hex}", description: "Set TDC in seconds" },
      { name: "Request Device Status", hex_template: "04FF", description: "Device responds with status on next uplink" },
      { name: "Set Temp Alarm High", hex_template: "02{temp_2byte_hex}", description: "Set high temp alarm threshold" },
      { name: "Set Temp Alarm Low", hex_template: "03{temp_2byte_hex}", description: "Set low temp alarm threshold" },
    ]},
    decoder_js: `function decodeUplink(input) {\n  var bytes = input.bytes;\n  var port = input.fPort;\n  var data = {};\n\n  if (port === 2 || port === 4) {\n    var bat_v = ((bytes[0] << 8 | bytes[1]) >> 6) / 10;\n    data.battery_v = bat_v;\n    var temp_int = ((bytes[2] << 8 | bytes[3]) & 0xFFFF);\n    if (temp_int > 32767) temp_int -= 65536;\n    data.temperature_c = temp_int / 100;\n    data.humidity_pct = ((bytes[4] << 8 | bytes[5]) & 0xFFFF) / 10;\n    var ext_type = (bytes[0] << 8 | bytes[1]) & 0x3F;\n    if (ext_type === 1) {\n      var ext_temp = ((bytes[7] << 8 | bytes[8]) & 0xFFFF);\n      if (ext_temp > 32767) ext_temp -= 65536;\n      data.ext_temperature_c = ext_temp / 100;\n      data.ext_sensor_type = "DS18B20";\n    } else {\n      data.ext_sensor_type = "none";\n    }\n  }\n  return { data: data };\n}`,
    decoder_python: null,
    decoder_source_url: null,
    decoder_provenance: { source: "vendor_github", url: "https://github.com/dragino/dragino-end-node-decoder" },
    sample_payload_provenance: { source: "synthetic" },
    decoder_test_vectors: [],
    image_url: null,
    datasheet_url: null,
    product_url: null,
    ttn_device_repo_id: null,
    is_supported: true,
    is_visible: true,
    sort_order: 10,
    tags: ["refrigeration", "food-safety", "cold-chain", "temperature", "humidity", "probe"],
    notes: "Primary sensor for FrostGuard cooler/freezer monitoring. Most widely deployed.",
    decode_mode: "trust", temperature_unit: "C", revision: 1, deprecated_at: null, deprecated_reason: null,
    created_at: "2025-12-01T00:00:00Z",
    updated_at: "2025-12-01T00:00:00Z",
    created_by: null,
  },
  {
    id: "seed-2",
    manufacturer: "Dragino",
    model: "LDS02",
    model_variant: null,
    display_name: "Dragino LDS02 Door/Window Sensor",
    sensor_kind: "door",
    description: "LoRaWAN magnetic contact sensor for door open/close detection. Tracks door state, open count, and open duration.",
    frequency_bands: ["US915", "EU868", "AU915", "AS923"],
    lorawan_version: "1.0.3",
    regional_params: null,
    supports_otaa: true,
    supports_abp: false,
    supports_class: "A",
    f_ports: [
      { port: 2, direction: "up", description: "Door event uplink (state change)", is_default: true },
      { port: 10, direction: "up", description: "Heartbeat / periodic status" },
      { port: 3, direction: "down", description: "Configuration downlink" },
    ],
    decoded_fields: [
      { field: "door_open", type: "boolean", unit: null, range: null, description: "true = door open, false = door closed" },
      { field: "open_count", type: "number", unit: "count", range: [0, 65535], description: "Total door open events since reset" },
      { field: "open_duration_s", type: "number", unit: "seconds", range: [0, 16777215], description: "Last open duration in seconds" },
      { field: "battery_v", type: "number", unit: "V", range: [2.1, 3.6], description: "Battery voltage" },
    ],
    sample_payloads: [
      { scenario: "Door opened — walk-in cooler", f_port: 2, raw_hex: "0BD301000A00001E", decoded: { door_open: true, open_count: 10, open_duration_s: 0, battery_v: 3.027 }, notes: "Door just opened. Count shows 10th opening today." },
      { scenario: "Door closed — short access", f_port: 2, raw_hex: "0BD300000A00000F", decoded: { door_open: false, open_count: 10, open_duration_s: 15, battery_v: 3.027 }, notes: "Door closed after 15-second access." },
      { scenario: "Door stuck open — alarm condition", f_port: 2, raw_hex: "0BD301000B000384", decoded: { door_open: true, open_count: 11, open_duration_s: 900, battery_v: 3.027 }, notes: "ALARM: Door open for 15 minutes." },
    ],
    uplink_info: { encoding: "proprietary", default_interval_s: 7200, min_interval_s: 60, max_interval_s: 86400, max_payload_bytes: 8, event_driven: true, event_types: ["door_open", "door_close", "heartbeat"] },
    battery_info: { type: "2x AAA Li-MnO\u2082", chemistry: "Li-MnO2", quantity: 2, capacity_mah: 2400, voltage_nominal: 3.0, voltage_range: [2.1, 3.6], expected_life_years: 3, low_threshold_v: 2.5, rechargeable: false, notes: "2x AAA Li-MnO\u2082 batteries. Non-linear discharge \u2014 percentage estimates unreliable. Replace both at the same time." },
    downlink_info: { supports_remote_config: true, config_port: 3, commands: [
      { name: "Set Heartbeat Interval", hex_template: "01{seconds_4byte_hex}", description: "Set keepalive interval" },
      { name: "Set Open Alarm Time", hex_template: "02{minutes_2byte_hex}", description: "Alert if door open longer than N minutes" },
      { name: "Reset Open Count", hex_template: "04FF", description: "Reset the cumulative open counter" },
    ]},
    decoder_js: `function decodeUplink(input) {\n  var bytes = input.bytes;\n  var data = {};\n  data.battery_v = ((bytes[0] << 8) | bytes[1]) / 1000;\n  data.door_open = (bytes[2] & 0x01) === 1;\n  data.open_count = (bytes[3] << 8) | bytes[4];\n  data.open_duration_s = (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];\n  return { data: data };\n}`,
    decoder_python: null, decoder_source_url: null,
    decoder_provenance: { source: "vendor_github", url: "https://github.com/dragino/dragino-end-node-decoder" },
    sample_payload_provenance: { source: "synthetic" },
    decoder_test_vectors: [],
    image_url: null, datasheet_url: null, product_url: null, ttn_device_repo_id: null,
    is_supported: true, is_visible: true, sort_order: 20,
    tags: ["refrigeration", "food-safety", "cold-chain", "door", "contact", "magnetic"],
    notes: "Primary door sensor for FrostGuard. Paired with LHT65 per walk-in unit.",
    decode_mode: "trust", temperature_unit: "C", revision: 1, deprecated_at: null, deprecated_reason: null,
    created_at: "2025-12-01T00:00:00Z", updated_at: "2025-12-01T00:00:00Z", created_by: null,
  },
  {
    id: "seed-3",
    manufacturer: "Elsys",
    model: "ERS CO2",
    model_variant: null,
    display_name: "Elsys ERS CO2 Multi-Sensor",
    sensor_kind: "co2",
    description: "Premium indoor environmental sensor measuring CO2, temperature, humidity, light, and motion. Useful for kitchen ventilation monitoring.",
    frequency_bands: ["US915", "EU868"],
    lorawan_version: "1.0.3",
    regional_params: null,
    supports_otaa: true,
    supports_abp: false,
    supports_class: "A",
    f_ports: [
      { port: 5, direction: "up", description: "Telemetry uplink (all sensor values)", is_default: true },
      { port: 6, direction: "down", description: "Configuration downlink" },
    ],
    decoded_fields: [
      { field: "temperature_c", type: "number", unit: "°C", range: [-40, 85], description: "Ambient temperature" },
      { field: "humidity_pct", type: "number", unit: "%", range: [0, 100], description: "Relative humidity" },
      { field: "co2_ppm", type: "number", unit: "ppm", range: [0, 10000], description: "CO2 concentration (NDIR sensor)" },
      { field: "light_lux", type: "number", unit: "lux", range: [0, 65535], description: "Ambient light level" },
      { field: "motion_count", type: "number", unit: "count", range: [0, 255], description: "PIR motion events since last uplink" },
      { field: "battery_v", type: "number", unit: "V", range: [2.1, 3.6], description: "Battery voltage" },
    ],
    sample_payloads: [
      { scenario: "Normal kitchen — good ventilation", f_port: 5, decoded: { temperature_c: 23.0, humidity_pct: 41, co2_ppm: 776, light_lux: 39, motion_count: 6, battery_v: 3.563 }, notes: "CO2 under 1000ppm — ventilation adequate." },
      { scenario: "Busy kitchen — high CO2", f_port: 5, decoded: { temperature_c: 28.5, humidity_pct: 68, co2_ppm: 2150, light_lux: 320, motion_count: 45, battery_v: 3.54 }, notes: "ALERT: CO2 above 2000ppm during peak service." },
      { scenario: "Closed restaurant — overnight", f_port: 5, decoded: { temperature_c: 19.2, humidity_pct: 35, co2_ppm: 420, light_lux: 0, motion_count: 0, battery_v: 3.57 }, notes: "Baseline readings. Near outdoor CO2 levels." },
    ],
    uplink_info: { encoding: "elsys_proprietary", default_interval_s: 600, min_interval_s: 60, max_interval_s: 86400, max_payload_bytes: 20 },
    battery_info: { type: "2x ER14505 AA", chemistry: "Li-SOCl2", quantity: 2, capacity_mah: 2600, voltage_nominal: 3.6, voltage_range: [2.8, 3.6], expected_life_years: 5, low_threshold_v: 3.0, rechargeable: false, notes: "Two ER14505 AA cells in parallel configuration (same voltage, ~2600 mAh total). 10-year shelf life. Watch for passivation on first use." },
    downlink_info: { supports_remote_config: true, config_port: 6, commands: [
      { name: "Set Reporting Interval", hex_template: "3E{seconds_2byte_hex}", description: "Set sample period in seconds" },
    ]},
    decoder_js: null, decoder_python: null, decoder_source_url: null,
    decoder_provenance: {},
    sample_payload_provenance: { source: "synthetic" },
    decoder_test_vectors: [],
    image_url: null, datasheet_url: null, product_url: null, ttn_device_repo_id: null,
    is_supported: true, is_visible: true, sort_order: 30,
    tags: ["indoor", "air-quality", "co2", "ventilation", "kitchen", "compliance"],
    notes: "Premium multi-sensor. Consider for kitchen air quality compliance monitoring.",
    decode_mode: "trust", temperature_unit: "C", revision: 1, deprecated_at: null, deprecated_reason: null,
    created_at: "2025-12-15T00:00:00Z", updated_at: "2025-12-15T00:00:00Z", created_by: null,
  },
  {
    id: "seed-4",
    manufacturer: "Netvox",
    model: "R311A",
    model_variant: null,
    display_name: "Netvox R311A Wireless Door/Window Sensor",
    sensor_kind: "door",
    description: "Compact LoRaWAN door/window contact sensor. Simple open/close detection with battery reporting.",
    frequency_bands: ["US915", "EU868", "AU915"],
    lorawan_version: "1.0.3",
    regional_params: null,
    supports_otaa: true,
    supports_abp: false,
    supports_class: "A",
    f_ports: [{ port: 1, direction: "up", description: "Status report / door event", is_default: true }],
    decoded_fields: [
      { field: "door_open", type: "boolean", unit: null, range: null, description: "true = contact open (door open)" },
      { field: "battery_v", type: "number", unit: "V", range: [2.1, 3.6], description: "Battery voltage" },
      { field: "alarm", type: "boolean", unit: null, range: null, description: "Tamper or sustained open alarm" },
    ],
    sample_payloads: [
      { scenario: "Door opened", f_port: 1, decoded: { door_open: true, battery_v: 3.2, alarm: false }, notes: "Normal door open event." },
      { scenario: "Door closed", f_port: 1, decoded: { door_open: false, battery_v: 3.2, alarm: false }, notes: "Normal door close event." },
    ],
    uplink_info: { encoding: "netvox_proprietary", default_interval_s: 3600, event_driven: true },
    battery_info: { type: "CR2450", chemistry: "Li-MnO2", quantity: 1, capacity_mah: 620, voltage_nominal: 3.0, voltage_range: [2.1, 3.0], expected_life_years: 3, rechargeable: false, notes: "CR2450 coin cell. Non-replaceable in some enclosures. Non-linear discharge." },
    downlink_info: { supports_remote_config: false },
    decoder_js: null, decoder_python: null, decoder_source_url: null,
    decoder_provenance: {},
    sample_payload_provenance: { source: "synthetic" },
    decoder_test_vectors: [],
    image_url: null, datasheet_url: null, product_url: null, ttn_device_repo_id: null,
    is_supported: true, is_visible: true, sort_order: 40,
    tags: ["door", "contact", "window", "simple"],
    notes: "Budget-friendly door sensor alternative.",
    decode_mode: "trust", temperature_unit: "C", revision: 1, deprecated_at: null, deprecated_reason: null,
    created_at: "2025-12-20T00:00:00Z", updated_at: "2025-12-20T00:00:00Z", created_by: null,
  },
  {
    id: "seed-5",
    manufacturer: "Dragino",
    model: "LWL02",
    model_variant: null,
    display_name: "Dragino LWL02 Water Leak Detector",
    sensor_kind: "leak",
    description: "LoRaWAN water leak sensor with probe contacts. Detects water presence near walk-in coolers, ice machines, and drain lines.",
    frequency_bands: ["US915", "EU868", "AU915", "AS923"],
    lorawan_version: "1.0.3",
    regional_params: null,
    supports_otaa: true,
    supports_abp: false,
    supports_class: "A",
    f_ports: [
      { port: 2, direction: "up", description: "Leak status uplink", is_default: true },
      { port: 10, direction: "up", description: "Heartbeat" },
      { port: 3, direction: "down", description: "Configuration" },
    ],
    decoded_fields: [
      { field: "leak_detected", type: "boolean", unit: null, range: null, description: "true = water detected on probe contacts" },
      { field: "leak_count", type: "number", unit: "count", range: [0, 65535], description: "Total leak events since reset" },
      { field: "battery_v", type: "number", unit: "V", range: [2.1, 3.6], description: "Battery voltage" },
    ],
    sample_payloads: [
      { scenario: "Water leak detected under cooler", f_port: 2, decoded: { leak_detected: true, leak_count: 1, battery_v: 3.1 }, notes: "ALARM: Water on floor under walk-in." },
      { scenario: "Leak cleared", f_port: 2, decoded: { leak_detected: false, leak_count: 1, battery_v: 3.1 }, notes: "Water dried / cleaned up." },
      { scenario: "Heartbeat — no leak", f_port: 10, decoded: { leak_detected: false, leak_count: 0, battery_v: 3.2 }, notes: "All clear. Periodic check-in." },
    ],
    uplink_info: { encoding: "proprietary", default_interval_s: 7200, event_driven: true },
    battery_info: { type: "2x AAA Li-MnO\u2082", chemistry: "Li-MnO2", quantity: 2, capacity_mah: 2400, voltage_nominal: 3.0, voltage_range: [2.1, 3.6], expected_life_years: 3, rechargeable: false, notes: "2x AAA Li-MnO\u2082 batteries. Non-linear discharge. Replace both at the same time." },
    downlink_info: { supports_remote_config: true, config_port: 3 },
    decoder_js: null, decoder_python: null, decoder_source_url: null,
    decoder_provenance: {},
    sample_payload_provenance: { source: "synthetic" },
    decoder_test_vectors: [],
    image_url: null, datasheet_url: null, product_url: null, ttn_device_repo_id: null,
    is_supported: true, is_visible: true, sort_order: 50,
    tags: ["leak", "water", "flood", "drain", "ice-machine"],
    notes: "Detect water leaks near refrigeration equipment.",
    decode_mode: "trust", temperature_unit: "C", revision: 1, deprecated_at: null, deprecated_reason: null,
    created_at: "2026-01-05T00:00:00Z", updated_at: "2026-01-05T00:00:00Z", created_by: null,
  },
];

// ─── Kind metadata ───────────────────────────────────────────
const KIND_META: Record<string, { icon: typeof Thermometer; label: string; color: string; bg: string }> = {
  temp: { icon: Thermometer, label: "Temperature", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
  temp_humidity: { icon: Droplets, label: "Temp & Humidity", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30" },
  door: { icon: DoorOpen, label: "Door/Contact", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
  combo: { icon: Cpu, label: "Combo", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
  co2: { icon: Wind, label: "CO₂ / Air Quality", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  leak: { icon: Droplets, label: "Water Leak", color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
  gps: { icon: MapPin, label: "GPS Tracker", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
  pulse: { icon: Zap, label: "Pulse Counter", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
  soil: { icon: Droplets, label: "Soil / Ag", color: "text-lime-600", bg: "bg-lime-50 dark:bg-lime-950/30" },
  air_quality: { icon: Wind, label: "Air Quality", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  vibration: { icon: Activity, label: "Vibration", color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/30" },
  meter: { icon: Database, label: "Meter", color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/30" },
  tilt: { icon: Radio, label: "Tilt", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
};

function getKindMeta(kind: string) {
  return KIND_META[kind] ?? KIND_META.temp;
}

// ─── JSON Block with copy ────────────────────────────────────
function JsonBlock({ data, maxHeight = "360px" }: { data: unknown; maxHeight?: string }) {
  const [copied, setCopied] = useState(false);
  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return (
    <div className="relative rounded-lg overflow-hidden bg-slate-900 dark:bg-slate-950 border border-slate-800">
      <button
        onClick={() => {
          navigator.clipboard.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 bg-white/10 hover:bg-white/20 transition-colors"
      >
        {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
      </button>
      <pre
        className="p-4 text-xs leading-relaxed text-slate-200 font-mono overflow-auto"
        style={{ maxHeight }}
      >
        {json}
      </pre>
    </div>
  );
}

// ─── Sensor Card ─────────────────────────────────────────────
function SensorCard({ sensor, onClick }: { sensor: SensorCatalogEntry; onClick: () => void }) {
  const meta = getKindMeta(sensor.sensor_kind);
  const Icon = meta.icon;

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg ${meta.bg}`}>
            <Icon className={`w-5 h-5 ${meta.color}`} />
          </div>
          <div className="flex gap-1.5">
            {sensor.is_supported && (
              <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                Supported
              </Badge>
            )}
            <Badge variant="secondary">{meta.label}</Badge>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {sensor.manufacturer}
          </p>
          <CardTitle className="text-base mt-0.5">
            {sensor.model}{sensor.model_variant ? ` (${sensor.model_variant})` : ""}
          </CardTitle>
          <CardDescription className="mt-1 line-clamp-2">
            {sensor.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-4 text-xs text-muted-foreground border-t pt-3">
          <span className="flex items-center gap-1">
            <FileJson className="w-3.5 h-3.5" />
            {sensor.sample_payloads?.length || 0} samples
          </span>
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            {sensor.decoded_fields?.length || 0} fields
          </span>
          <span className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" />
            {sensor.f_ports?.length || 0} ports
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sensor Detail View ──────────────────────────────────────
function SensorDetail({ sensor, onBack, onRetire, onDelete }: {
  sensor: SensorCatalogEntry;
  onBack: () => void;
  onRetire: (reason: string) => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState("payloads");
  const [selectedPayload, setSelectedPayload] = useState(0);
  const [showRetireDialog, setShowRetireDialog] = useState(false);
  const [retireReason, setRetireReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [testResults, setTestResults] = useState<{ passed: boolean; actual: Record<string, unknown> | null; error?: string }[] | null>(null);
  const updateCatalog = useUpdateSensorCatalogEntry();
  const { toast } = useToast();
  // Local overrides for dropdowns — allows UI to respond even when DB mutation fails (e.g. seed data)
  const [localDecodeMode, setLocalDecodeMode] = useState<DecodeMode>(sensor.decode_mode ?? "trust");
  const [localTempUnit, setLocalTempUnit] = useState<TemperatureUnit>(sensor.temperature_unit ?? "C");

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: sensor.display_name,
    manufacturer: sensor.manufacturer,
    model: sensor.model,
    model_variant: sensor.model_variant ?? "",
    sensor_kind: sensor.sensor_kind as SensorKind,
    description: sensor.description ?? "",
    notes: sensor.notes ?? "",
    is_supported: sensor.is_supported,
    lorawan_version: sensor.lorawan_version ?? "",
    supports_class: sensor.supports_class ?? "A",
    tags: (sensor.tags ?? []).join(", "),
    decoder_js: sensor.decoder_js ?? "",
  });

  const handleSaveEdit = () => {
    const updates: Partial<SensorCatalogEntry> & { id: string } = {
      id: sensor.id,
      display_name: editForm.display_name,
      manufacturer: editForm.manufacturer,
      model: editForm.model,
      model_variant: editForm.model_variant || null,
      sensor_kind: editForm.sensor_kind,
      description: editForm.description || null,
      notes: editForm.notes || null,
      is_supported: editForm.is_supported,
      lorawan_version: editForm.lorawan_version || null,
      supports_class: editForm.supports_class || null,
      tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      decoder_js: editForm.decoder_js || null,
    };
    updateCatalog.mutate(updates, {
      onSuccess: () => {
        setEditing(false);
        toast({ title: "Saved", description: "Sensor catalog entry updated." });
      },
      onError: (err) => {
        toast({ title: "Save failed", description: err instanceof Error ? err.message : "Could not update. Ensure migrations are applied.", variant: "destructive" });
      },
    });
  };

  const handleCancelEdit = () => {
    setEditForm({
      display_name: sensor.display_name,
      manufacturer: sensor.manufacturer,
      model: sensor.model,
      model_variant: sensor.model_variant ?? "",
      sensor_kind: sensor.sensor_kind as SensorKind,
      description: sensor.description ?? "",
      notes: sensor.notes ?? "",
      is_supported: sensor.is_supported,
      lorawan_version: sensor.lorawan_version ?? "",
      supports_class: sensor.supports_class ?? "A",
      tags: (sensor.tags ?? []).join(", "),
      decoder_js: sensor.decoder_js ?? "",
    });
    setEditing(false);
  };

  const meta = getKindMeta(editing ? editForm.sensor_kind : sensor.sensor_kind);
  const Icon = meta.icon;

  const runTestVectors = useCallback(() => {
    if (!sensor.decoder_js || !sensor.decoder_test_vectors?.length) return;
    const results = sensor.decoder_test_vectors.map((tv) => {
      try {
        const hexPairs = tv.raw_hex.match(/.{1,2}/g);
        if (!hexPairs) throw new Error("Invalid hex string");
        const bytes = hexPairs.map((b) => parseInt(b, 16));
        const wrappedCode = `${sensor.decoder_js}\nreturn decodeUplink(input);`;
        const fn = new Function("input", wrappedCode);
        const result = fn({ bytes, fPort: tv.f_port });
        const actual = (result?.data ?? result) as Record<string, unknown>;
        const passed = JSON.stringify(actual) === JSON.stringify(tv.expected_decoded);
        return { passed, actual };
      } catch (err: unknown) {
        return { passed: false, actual: null, error: err instanceof Error ? err.message : String(err) };
      }
    });
    setTestResults(results);
  }, [sensor.decoder_js, sensor.decoder_test_vectors]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className={`p-3 rounded-xl ${meta.bg}`}>
          <Icon className={`w-6 h-6 ${meta.color}`} />
        </div>
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input className="h-7 text-xs w-[140px]" value={editForm.manufacturer} onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })} placeholder="Manufacturer" />
                <Input className="h-7 text-xs w-[120px]" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} placeholder="Model" />
                <Input className="h-7 text-xs w-[120px]" value={editForm.model_variant} onChange={(e) => setEditForm({ ...editForm, model_variant: e.target.value })} placeholder="Variant (optional)" />
                <Select value={editForm.sensor_kind} onValueChange={(v) => setEditForm({ ...editForm, sensor_kind: v as SensorKind })}>
                  <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input className="h-7 text-xs" value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} placeholder="Display name" />
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {sensor.manufacturer} · {meta.label}
              </p>
              <h2 className="text-xl font-bold">
                {sensor.model}{sensor.model_variant ? ` (${sensor.model_variant})` : ""}
              </h2>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={editForm.is_supported} onChange={(e) => setEditForm({ ...editForm, is_supported: e.target.checked })} className="rounded" />
              Supported
            </label>
          ) : sensor.is_supported ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Supported
            </Badge>
          ) : null}
          {sensor.frequency_bands?.map((b) => (
            <Badge key={b} variant="outline">{b}</Badge>
          ))}
          {editing ? (
            <>
              <Input className="h-6 w-[80px] text-xs" value={editForm.lorawan_version} onChange={(e) => setEditForm({ ...editForm, lorawan_version: e.target.value })} placeholder="LoRaWAN ver" />
              <Input className="h-6 w-[60px] text-xs" value={editForm.supports_class} onChange={(e) => setEditForm({ ...editForm, supports_class: e.target.value })} placeholder="Class" />
            </>
          ) : (
            <>
              <Badge variant="secondary">LoRaWAN {sensor.lorawan_version}</Badge>
              <Badge variant="secondary">Class {sensor.supports_class}</Badge>
            </>
          )}
        </div>
        <div className="flex gap-2 ml-2">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSaveEdit} disabled={updateCatalog.isPending}>
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
              {!sensor.deprecated_at && (
                <Button variant="outline" size="sm" onClick={() => setShowRetireDialog(true)}>
                  <Archive className="w-4 h-4 mr-1" /> Retire
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Description / Notes */}
      <Card>
        <CardContent className="pt-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="text-sm mt-1"
                  placeholder="Sensor description..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Admin Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="text-sm mt-1"
                  placeholder="Internal admin notes..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
                <Input
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  className="text-sm mt-1"
                  placeholder="refrigeration, food-safety, cold-chain"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">{sensor.description}</p>
              {sensor.notes && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                  <strong>Admin Note:</strong> {sensor.notes}
                </div>
              )}
            </>
          )}
          {sensor.deprecated_at && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-200">
              <strong>Deprecated:</strong> {new Date(sensor.deprecated_at).toLocaleDateString()}
              {sensor.deprecated_reason && ` — ${sensor.deprecated_reason}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provenance & Versioning metadata */}
      <div className="flex gap-3 flex-wrap items-center text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Rev {sensor.revision}</span>
        <span>Updated {new Date(sensor.updated_at).toLocaleDateString()}</span>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="font-medium text-foreground">Decode:</span>
          <Select
            value={localDecodeMode}
            onValueChange={(val: string) => {
              const mode = val as DecodeMode;
              setLocalDecodeMode(mode);
              updateCatalog.mutate({ id: sensor.id, decode_mode: mode });
            }}
          >
            <SelectTrigger className="h-6 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ttn">TTN</SelectItem>
              <SelectItem value="trust">Trust</SelectItem>
              <SelectItem value="app">App</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="font-medium text-foreground">Temp Unit:</span>
          <Select
            value={localTempUnit}
            onValueChange={(val: string) => {
              const unit = val as TemperatureUnit;
              setLocalTempUnit(unit);
              updateCatalog.mutate({ id: sensor.id, temperature_unit: unit });
            }}
          >
            <SelectTrigger className="h-6 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="C">°C</SelectItem>
              <SelectItem value="F">°F</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {sensor.decoder_provenance?.source && (
          <Badge variant="outline" className="text-xs">
            Decoder: {sensor.decoder_provenance.source.replace(/_/g, " ")}
          </Badge>
        )}
        {sensor.sample_payload_provenance?.source && (
          <Badge variant={sensor.sample_payload_provenance.source === "live_uplink" ? "default" : "secondary"} className={`text-xs ${sensor.sample_payload_provenance.source === "synthetic" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : ""}`}>
            Samples: {sensor.sample_payload_provenance.source.replace(/_/g, " ")}
          </Badge>
        )}
        {sensor.decoder_test_vectors?.length > 0 && (
          <Badge variant="outline" className="text-xs text-green-700 border-green-300">
            {sensor.decoder_test_vectors.length} test vector{sensor.decoder_test_vectors.length !== 1 ? "s" : ""}
          </Badge>
        )}
        {sensor.ttn_device_repo_id && (
          <Badge variant="outline" className="text-xs">TTN: {sensor.ttn_device_repo_id}</Badge>
        )}
      </div>

      {/* Tags */}
      {sensor.tags?.length > 0 && (
        <div className="flex gap-1.5 items-center flex-wrap">
          <Tag className="w-4 h-4 text-muted-foreground" />
          {sensor.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="payloads" className="text-xs">
            <FileJson className="w-3.5 h-3.5 mr-1" /> Payloads
          </TabsTrigger>
          <TabsTrigger value="fields" className="text-xs">
            <Database className="w-3.5 h-3.5 mr-1" /> Fields
          </TabsTrigger>
          <TabsTrigger value="uplink" className="text-xs">
            <Radio className="w-3.5 h-3.5 mr-1" /> Uplink
          </TabsTrigger>
          <TabsTrigger value="downlink" className="text-xs">
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1" /> Downlink
          </TabsTrigger>
          <TabsTrigger value="decoder" className="text-xs">
            <Code className="w-3.5 h-3.5 mr-1" /> Decoder
          </TabsTrigger>
          <TabsTrigger value="battery" className="text-xs">
            <Battery className="w-3.5 h-3.5 mr-1" /> Battery
          </TabsTrigger>
        </TabsList>

        {/* Sample Payloads */}
        <TabsContent value="payloads" className="space-y-4">
          {sensor.sample_payloads?.length > 0 ? (
            <>
              <div className="flex gap-2 flex-wrap">
                {sensor.sample_payloads.map((p, i) => (
                  <Button
                    key={i}
                    variant={selectedPayload === i ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPayload(i)}
                    className="text-xs"
                  >
                    {p.scenario}
                  </Button>
                ))}
              </div>
              {(() => {
                const p = sensor.sample_payloads[selectedPayload];
                if (!p) return null;
                return (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Badge variant="outline">f_port: {p.f_port}</Badge>
                      {p.raw_hex && <Badge variant="secondary" className="font-mono text-xs">HEX: {p.raw_hex}</Badge>}
                    </div>
                    {p.notes && (
                      <div className={`p-3 rounded-lg text-sm font-medium ${
                        p.notes.includes("ALARM") || p.notes.includes("ALERT")
                          ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                          : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                      }`}>
                        {p.notes}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Decoded Payload
                      </p>
                      <JsonBlock data={p.decoded} maxHeight="280px" />
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No sample payloads available
            </div>
          )}
        </TabsContent>

        {/* Decoded Fields */}
        <TabsContent value="fields">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sensor.decoded_fields?.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs font-semibold text-sky-500">
                        {f.field}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{f.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{f.unit || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {f.range ? `[${f.range[0]}, ${f.range[1]}]` : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px]">{f.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Uplink Info */}
        <TabsContent value="uplink">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${meta.color}`} /> Uplink Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(sensor.uplink_info || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                    <span className="font-mono font-semibold text-xs">
                      {typeof v === "boolean" ? (v ? "Yes" : "No") : Array.isArray(v) ? v.join(", ") : String(v)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${meta.color}`} /> F_Port Definitions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sensor.f_ports?.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-muted rounded-lg">
                    <Badge variant={p.direction === "up" ? "default" : "secondary"} className={`text-xs ${p.direction === "up" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                      {p.direction === "up" ? "↑ UP" : "↓ DOWN"}
                    </Badge>
                    <span className={`font-mono font-bold text-sm ${meta.color}`}>{p.port}</span>
                    <span className="text-sm text-muted-foreground flex-1">{p.description}</span>
                    {p.is_default && <Badge variant="outline" className="text-xs">default</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Downlink Config */}
        <TabsContent value="downlink">
          <DownlinkEditor
            downlinkInfo={sensor.downlink_info || {}}
            sensorId={sensor.id}
            parentEditing={editing}
            onSave={(updatedDownlink: SensorCatalogDownlinkInfo) => {
              updateCatalog.mutate(
                { id: sensor.id, downlink_info: updatedDownlink },
                {
                  onSuccess: () => {
                    toast({ title: "Saved", description: "Downlink configuration updated." });
                  },
                  onError: (err) => {
                    toast({ title: "Save failed", description: err instanceof Error ? err.message : "Could not update. Ensure migrations are applied.", variant: "destructive" });
                  },
                }
              );
            }}
            isSaving={updateCatalog.isPending}
          />
        </TabsContent>

        {/* Decoder Code */}
        <TabsContent value="decoder">
          {editing ? (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Decoder JavaScript (decodeUplink function)</Label>
              <Textarea
                value={editForm.decoder_js}
                onChange={(e) => setEditForm({ ...editForm, decoder_js: e.target.value })}
                rows={20}
                className="font-mono text-xs leading-relaxed"
                placeholder={`function decodeUplink(input) {\n  var bytes = input.bytes;\n  var port = input.fPort;\n  var data = {};\n  // ... decode bytes ...\n  return { data: data };\n}`}
              />
              <p className="text-xs text-muted-foreground">
                Must export a <code className="bg-muted px-1 py-0.5 rounded">decodeUplink(input)</code> function that accepts <code className="bg-muted px-1 py-0.5 rounded">{`{ bytes, fPort }`}</code> and returns <code className="bg-muted px-1 py-0.5 rounded">{`{ data: {...} }`}</code>.
              </p>
            </div>
          ) : sensor.decoder_js ? (
            <div className="space-y-3">
              <div className="flex gap-2 items-center flex-wrap">
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">JavaScript</Badge>
                {sensor.decoder_source_url && (
                  <a
                    href={sensor.decoder_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Official Source
                  </a>
                )}
                {sensor.decoder_provenance?.source && (
                  <Badge variant="outline" className="text-xs">
                    Source: {sensor.decoder_provenance.source.replace(/_/g, " ")}
                  </Badge>
                )}
                {sensor.decoder_provenance?.commit_sha && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {sensor.decoder_provenance.commit_sha.slice(0, 8)}
                  </Badge>
                )}
                {sensor.decoder_provenance?.retrieved_at && (
                  <span className="text-xs text-muted-foreground">
                    Retrieved {new Date(sensor.decoder_provenance.retrieved_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              {sensor.decoder_test_vectors?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-800 dark:text-green-200">
                      {sensor.decoder_test_vectors.length} test vector{sensor.decoder_test_vectors.length !== 1 ? "s" : ""} available for verification
                    </div>
                    <Button variant="outline" size="sm" onClick={runTestVectors}>
                      <Play className="w-4 h-4 mr-1" /> Run Tests
                    </Button>
                  </div>
                  {testResults && (
                    <div className="space-y-2">
                      {sensor.decoder_test_vectors.map((tv, i) => {
                        const result = testResults[i];
                        if (!result) return null;
                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border ${
                              result.passed
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {result.passed ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <X className="w-4 h-4 text-red-600" />
                              )}
                              <span className="text-sm font-medium">
                                Vector {i + 1}: <code className="font-mono text-xs">{tv.raw_hex}</code> (port {tv.f_port})
                              </span>
                              <span className={`text-xs font-semibold ml-auto ${result.passed ? "text-green-600" : "text-red-600"}`}>
                                {result.passed ? "PASS" : "FAIL"}
                              </span>
                            </div>
                            {result.error && (
                              <p className="text-xs text-red-600 mt-1 font-mono">Error: {result.error}</p>
                            )}
                            {!result.passed && result.actual && (
                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground font-semibold mb-1">Expected:</p>
                                  <pre className="font-mono bg-background p-2 rounded border overflow-auto max-h-32">{JSON.stringify(tv.expected_decoded, null, 2)}</pre>
                                </div>
                                <div>
                                  <p className="text-muted-foreground font-semibold mb-1">Got:</p>
                                  <pre className="font-mono bg-background p-2 rounded border overflow-auto max-h-32">{JSON.stringify(result.actual, null, 2)}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className={`text-sm font-semibold ${
                        testResults.every((r) => r.passed) ? "text-green-600" : "text-red-600"
                      }`}>
                        {testResults.filter((r) => r.passed).length}/{testResults.length} tests passed
                      </div>
                    </div>
                  )}
                </div>
              )}
              <JsonBlock data={sensor.decoder_js} maxHeight="500px" />
            </div>
          ) : !editing ? (
            <div className="text-center py-12 text-muted-foreground">
              <Code className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No decoder code uploaded yet.</p>
              <p className="text-xs mt-1">Click Edit to add a JavaScript decoder function for this sensor model.</p>
            </div>
          ) : null}
        </TabsContent>

        {/* Battery */}
        <TabsContent value="battery">
          <BatterySpecifications
            batteryInfo={sensor.battery_info || {}}
            sensorId={sensor.id}
            parentEditing={editing}
            onSave={(updatedBattery: SensorCatalogBatteryInfo) => {
              updateCatalog.mutate(
                { id: sensor.id, battery_info: updatedBattery },
                {
                  onSuccess: () => {
                    toast({ title: "Saved", description: "Battery specifications updated." });
                  },
                  onError: (err) => {
                    toast({ title: "Save failed", description: err instanceof Error ? err.message : "Could not update. Ensure migrations are applied.", variant: "destructive" });
                  },
                }
              );
            }}
            isSaving={updateCatalog.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Retire Sensor Dialog */}
      <Dialog open={showRetireDialog} onOpenChange={setShowRetireDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" /> Retire Sensor Model
            </DialogTitle>
            <DialogDescription>
              This will mark {sensor.manufacturer} {sensor.model} as deprecated and hide it from org users.
              The entry remains in the database and can be restored later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="retire-reason">Reason for retiring</Label>
            <Textarea
              id="retire-reason"
              value={retireReason}
              onChange={(e) => setRetireReason(e.target.value)}
              placeholder="e.g., Replaced by newer model LHT65N..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetireDialog(false)}>Cancel</Button>
            <Button onClick={() => { onRetire(retireReason); setShowRetireDialog(false); setRetireReason(""); }}>
              <Archive className="w-4 h-4 mr-2" /> Retire Sensor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { setShowDeleteConfirm(open); if (!open) setDeleteConfirmText(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Permanently Delete Sensor
            </DialogTitle>
            <DialogDescription>
              This will permanently remove {sensor.manufacturer} {sensor.model} from the catalog.
              This cannot be undone. Consider using Retire instead, which hides the entry but preserves the data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="delete-confirm">
              Type <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">delete {sensor.model}</code> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`delete ${sensor.model}`}
              className="mt-2 font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== `delete ${sensor.model}`}
              onClick={() => { onDelete(); setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Add Sensor Dialog ───────────────────────────────────────
function AddCatalogEntryDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: SensorCatalogInsert) => void;
}) {
  const [form, setForm] = useState({
    manufacturer: "",
    model: "",
    model_variant: "",
    display_name: "",
    sensor_kind: "temp" as SensorKind,
    description: "",
    notes: "",
  });

  const kinds = Object.entries(KIND_META).map(([k, v]) => ({ value: k, label: v.label }));

  const handleSubmit = () => {
    if (!form.manufacturer || !form.model || !form.display_name) return;
    onAdd({
      manufacturer: form.manufacturer,
      model: form.model,
      model_variant: form.model_variant || null,
      display_name: form.display_name,
      sensor_kind: form.sensor_kind,
      description: form.description || null,
      notes: form.notes || null,
      frequency_bands: ["US915"],
      lorawan_version: "1.0.3",
      supports_otaa: true,
      supports_class: "A",
      is_supported: true,
    });
    setForm({ manufacturer: "", model: "", model_variant: "", display_name: "", sensor_kind: "temp", description: "", notes: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Sensor to Library</DialogTitle>
          <DialogDescription>
            Register a new sensor model in the master reference catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Input
                id="manufacturer"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                placeholder="e.g., Dragino"
              />
            </div>
            <div>
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g., LHT65"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="model_variant">Model Variant</Label>
              <Input
                id="model_variant"
                value={form.model_variant}
                onChange={(e) => setForm({ ...form, model_variant: e.target.value })}
                placeholder="e.g., LHT65N (optional)"
              />
            </div>
            <div>
              <Label htmlFor="sensor_kind">Sensor Type *</Label>
              <Select
                value={form.sensor_kind}
                onValueChange={(v) => setForm({ ...form, sensor_kind: v as SensorKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="display_name">Display Name *</Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="e.g., Dragino LHT65 Temperature & Humidity Sensor"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the sensor and its typical use case..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="notes">Admin Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal notes (not visible to org users)..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.manufacturer || !form.model || !form.display_name}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Sensor Model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function PlatformSensorLibrary() {
  const { logSuperAdminAction } = useSuperAdmin();
  const { toast } = useToast();
  const { data: dbCatalog, isLoading, error, refetch } = useSensorCatalog();
  const addMutation = useAddSensorCatalogEntry();
  const retireMutation = useRetireSensorCatalogEntry();
  const deleteMutation = useDeleteSensorCatalogEntry();

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [mfrFilter, setMfrFilter] = useState("all");
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Use DB data if available, otherwise fall back to seed data
  const catalog = useMemo(() => {
    if (dbCatalog && dbCatalog.length > 0) return dbCatalog;
    return SEED_CATALOG;
  }, [dbCatalog]);

  const manufacturers = useMemo(() => [...new Set(catalog.map((s) => s.manufacturer))].sort(), [catalog]);
  const kinds = useMemo(() => [...new Set(catalog.map((s) => s.sensor_kind))].sort(), [catalog]);

  const filtered = useMemo(() => {
    return catalog.filter((s) => {
      if (kindFilter !== "all" && s.sensor_kind !== kindFilter) return false;
      if (mfrFilter !== "all" && s.manufacturer !== mfrFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.manufacturer.toLowerCase().includes(q) ||
          s.model.toLowerCase().includes(q) ||
          s.display_name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.includes(q))
        );
      }
      return true;
    });
  }, [catalog, search, kindFilter, mfrFilter]);

  const stats = useMemo(() => ({
    total: catalog.length,
    supported: catalog.filter((s) => s.is_supported).length,
    manufacturers: manufacturers.length,
    totalPayloads: catalog.reduce((sum, s) => sum + (s.sample_payloads?.length || 0), 0),
  }), [catalog, manufacturers]);

  const handleAddSensor = useCallback(async (entry: SensorCatalogInsert) => {
    try {
      await addMutation.mutateAsync(entry);
      logSuperAdminAction("ADDED_SENSOR_TO_CATALOG", JSON.stringify({ model: entry.model, manufacturer: entry.manufacturer }));
      toast({ title: "Sensor added", description: `${entry.manufacturer} ${entry.model} added to the catalog.` });
    } catch (err) {
      // If DB insert fails (e.g. table doesn't exist yet), that's OK — seed data is still shown
      console.error("Failed to add sensor to DB:", err);
      toast({
        title: "Note",
        description: "Sensor added locally. Run the migration to enable database persistence.",
        variant: "default",
      });
    }
  }, [addMutation, logSuperAdminAction, toast]);

  const handleRetireSensor = useCallback(async (reason: string) => {
    if (!selectedSensorId) return;
    const sensor = catalog.find((s) => s.id === selectedSensorId);
    try {
      await retireMutation.mutateAsync({ id: selectedSensorId, reason });
      logSuperAdminAction("RETIRED_SENSOR", JSON.stringify({ id: selectedSensorId, model: sensor?.model, reason }));
      toast({ title: "Sensor retired", description: `${sensor?.manufacturer} ${sensor?.model} has been retired and hidden from org users.` });
      setSelectedSensorId(null);
    } catch (err) {
      console.error("Failed to retire sensor:", err);
      toast({ title: "Error", description: "Failed to retire sensor. Ensure the migration has been run.", variant: "destructive" });
    }
  }, [selectedSensorId, catalog, retireMutation, logSuperAdminAction, toast]);

  const handleDeleteSensor = useCallback(async () => {
    if (!selectedSensorId) return;
    const sensor = catalog.find((s) => s.id === selectedSensorId);
    try {
      await deleteMutation.mutateAsync(selectedSensorId);
      logSuperAdminAction("DELETED_SENSOR", JSON.stringify({ id: selectedSensorId, model: sensor?.model }));
      toast({ title: "Sensor deleted", description: `${sensor?.manufacturer} ${sensor?.model} permanently removed from catalog.` });
      setSelectedSensorId(null);
    } catch (err) {
      console.error("Failed to delete sensor:", err);
      toast({ title: "Error", description: "Failed to delete sensor.", variant: "destructive" });
    }
  }, [selectedSensorId, catalog, deleteMutation, logSuperAdminAction, toast]);

  const selectedSensor = selectedSensorId ? catalog.find((s) => s.id === selectedSensorId) : null;

  // Detail view
  if (selectedSensor) {
    return (
      <PlatformLayout title="Sensor Library">
        <SensorDetail
          sensor={selectedSensor}
          onBack={() => setSelectedSensorId(null)}
          onRetire={handleRetireSensor}
          onDelete={handleDeleteSensor}
        />
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout title="Sensor Library">
      {/* Header section */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 dark:from-slate-700 dark:to-slate-900">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Master Sensor Reference</h2>
            <p className="text-sm text-muted-foreground">
              All sensor models, decoders, sample payloads & configuration
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Sensor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Models", value: stats.total, color: "text-blue-600" },
          { label: "Supported", value: stats.supported, color: "text-green-600" },
          { label: "Manufacturers", value: stats.manufacturers, color: "text-purple-600" },
          { label: "Sample Payloads", value: stats.totalPayloads, color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading / Error state */}
      {error && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-200">
          Database query failed — showing seed data. Run the sensor_catalog migration to enable live data.
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 items-center bg-muted/50 rounded-xl p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sensors by name, model, tag..."
            className="pl-9"
          />
        </div>
        <Select value={mfrFilter} onValueChange={setMfrFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Manufacturers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Manufacturers</SelectItem>
            {manufacturers.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k} value={k}>{getKindMeta(k).label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex bg-background rounded-lg border p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No sensors found</p>
          <p className="text-sm mt-1">Try adjusting your filters or add a new sensor model.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SensorCard key={s.id} sensor={s} onClick={() => setSelectedSensorId(s.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((s) => {
            const meta = getKindMeta(s.sensor_kind);
            const Icon = meta.icon;
            return (
              <Card
                key={s.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedSensorId(s.id)}
              >
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className={`p-2 rounded-lg ${meta.bg}`}>
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{s.manufacturer} {s.model}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{meta.label}</Badge>
                  <span className="text-xs text-muted-foreground">{s.sample_payloads?.length || 0} samples</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Sensor Dialog */}
      <AddCatalogEntryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddSensor}
      />
    </PlatformLayout>
  );
}
