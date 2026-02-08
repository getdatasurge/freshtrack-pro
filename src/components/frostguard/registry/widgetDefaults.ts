/** Default widget IDs per sensor type / view scope */
export const DEFAULT_WIDGET_LAYOUTS: Record<string, string[]> = {
  temp: ['temperature', 'humidity', 'battery', 'device-readiness', 'alerts', 'uplink-history'],
  door: ['door', 'battery', 'device-readiness', 'alerts', 'uplink-history'],
  combo: ['temperature', 'door', 'humidity', 'battery', 'alerts', 'device-readiness'],
  co2: ['temperature', 'humidity', 'battery', 'alerts', 'compliance-score'],
  unit_overview: ['alerts', 'compliance-score', 'temperature', 'door', 'device-readiness'],
  site_overview: ['alerts', 'compliance-score'],
};

/** Get default widget list for a sensor kind */
export function getDefaultWidgets(sensorKind: string): string[] {
  return DEFAULT_WIDGET_LAYOUTS[sensorKind] || DEFAULT_WIDGET_LAYOUTS.temp;
}
