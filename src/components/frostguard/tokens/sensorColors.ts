/** Color mapping per sensor_kind for consistent visualization */
export const sensorColors = {
  temperature: {
    primary: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500',
    chart: '#3b82f6',
  },
  humidity: {
    primary: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    dot: 'bg-cyan-500',
    chart: '#06b6d4',
  },
  door: {
    primary: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
    chart: '#f59e0b',
  },
  battery: {
    primary: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
    chart: '#10b981',
  },
  signal: {
    primary: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    dot: 'bg-violet-500',
    chart: '#8b5cf6',
  },
  co2: {
    primary: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    dot: 'bg-orange-500',
    chart: '#f97316',
  },
} as const;

export type SensorKind = keyof typeof sensorColors;

/** Get color config for a sensor kind, with fallback */
export function getSensorColor(kind: string) {
  return sensorColors[kind as SensorKind] || sensorColors.temperature;
}
