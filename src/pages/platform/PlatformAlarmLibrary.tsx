import { useState, useMemo } from "react";
import PlatformLayout from "@/components/platform/PlatformLayout";
import { useAlarmDefinitions } from "@/hooks/useAlarmLibrary";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Thermometer,
  DoorOpen,
  Droplets,
  Radio,
  ShieldCheck,
  ClipboardCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Brain,
  Cpu,
  Activity,
  AlertTriangle,
  Zap,
  BookOpen,
} from "lucide-react";
import type {
  AlarmDefinition,
  AlarmCategory,
  AlarmSeverity,
  DetectionTier,
  SensorKey,
} from "@/types/alarms";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TIERS: Record<DetectionTier, { label: string; name: string; desc: string; color: string; bg: string }> = {
  T1: { label: "T1", name: "Single Reading", desc: "One sensor, current value — it's a FACT", color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
  T2: { label: "T2", name: "Time Series", desc: "One sensor, pattern over time — we see the TREND", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  T3: { label: "T3", name: "Multi-Sensor", desc: "Two+ sensors same unit — we can RULE OUT causes", color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
  T4: { label: "T4", name: "Site-Wide", desc: "Multiple units — we can ISOLATE failures", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
  T5: { label: "T5", name: "Environmental", desc: "Specialized sensors — CO2, leak, TVOC, motion", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
};

const CATEGORIES: Record<string, { label: string; icon: typeof Thermometer; color: string }> = {
  temperature: { label: "Temperature", icon: Thermometer, color: "text-red-500" },
  door: { label: "Door", icon: DoorOpen, color: "text-orange-500" },
  environmental: { label: "Environmental", icon: Droplets, color: "text-blue-500" },
  sensor_health: { label: "Sensor Health", icon: Radio, color: "text-purple-500" },
  compliance: { label: "Compliance", icon: ClipboardCheck, color: "text-teal-500" },
  security: { label: "Security", icon: ShieldCheck, color: "text-pink-500" },
  normal: { label: "Normal Operation", icon: CheckCircle2, color: "text-green-500" },
};

const SEVERITIES: Record<AlarmSeverity, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  info: { label: "Info", variant: "secondary", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  normal: { label: "Normal", variant: "secondary", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  warning: { label: "Warning", variant: "secondary", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  critical: { label: "Critical", variant: "destructive", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  emergency: { label: "Emergency", variant: "destructive", className: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200" },
};

const SENSORS: Record<SensorKey, { model: string; kind: string; fields: string[] }> = {
  LHT65: { model: "Dragino LHT65", kind: "temp", fields: ["temperature", "humidity", "battery_voltage"] },
  LDS02: { model: "Dragino LDS02", kind: "door", fields: ["door_open_status", "open_times", "last_open_duration", "battery_voltage"] },
  R311A: { model: "Netvox R311A", kind: "door", fields: ["door_open", "battery_v", "alarm"] },
  ERS_CO2: { model: "Elsys ERS CO2", kind: "multi", fields: ["temperature", "humidity", "co2_ppm", "light_lux", "motion_count", "battery_v"] },
  LWL02: { model: "Dragino LWL02", kind: "leak", fields: ["water_leak", "battery_voltage"] },
  R720E: { model: "Netvox R720E", kind: "tvoc", fields: ["tvoc_ppb", "temperature", "humidity", "battery_v"] },
};

const AI_HINTS: Record<string, { label: string; desc: string }> = {
  rate_of_change: { label: "Rate of Change", desc: "Monitor °F/hr or °F/min trends using sliding window regression" },
  trend_analysis: { label: "Trend Analysis", desc: "Multi-hour trend detection — is the line going up, down, or flat?" },
  oscillation_detect: { label: "Oscillation Detection", desc: "FFT or peak counting to detect cycling patterns" },
  frequency_analysis: { label: "Frequency Analysis", desc: "Event frequency counting over rolling windows" },
  recovery_detection: { label: "Recovery Detection", desc: "After a spike, is temp trending back toward setpoint?" },
  correlate_with_door: { label: "Door Correlation", desc: "If door sensor exists on unit, check if door state explains temp change" },
  check_site_wide: { label: "Site-Wide Check", desc: "If other units exist at site, check if they're also affected" },
  cross_sensor_correlate: { label: "Cross-Sensor Correlation", desc: "Compare readings from multiple sensors on same unit" },
  rule_out_door: { label: "Rule Out Door", desc: "Door is closed -> temp issue is NOT caused by door" },
  site_wide_correlation: { label: "Site-Wide Correlation", desc: "Compare all units at site — if all rising, it's systemic" },
  power_outage_detect: { label: "Power Outage Inference", desc: "All units rising + battery draining = probable power loss" },
  isolation_detect: { label: "Fault Isolation", desc: "One unit affected while others stable = unit-specific issue" },
  sensor_comparison: { label: "Sensor Comparison", desc: "Two sensors on same unit — flag if diverging >5°F" },
  overnight_pattern: { label: "Overnight Pattern", desc: "Compare 6AM reading against close-of-business reading" },
  business_hours: { label: "Business Hours", desc: "Context-aware — different behavior expected during vs after hours" },
  sustained_threshold: { label: "Sustained Threshold", desc: "Track continuous time above/below a threshold (FDA 2-hour rule)" },
  spike_plateau_detect: { label: "Spike + Plateau", desc: "Detect temp spike followed by flat line (failed recovery)" },
  defrost_pattern: { label: "Defrost Pattern", desc: "Learn normal defrost cycle timing and flag anomalies" },
  threshold_crossing_count: { label: "Threshold Crossing", desc: "Count how many times value crosses a specific threshold" },
  stale_data_detect: { label: "Stale Data Detection", desc: "Flag sensors with no state changes over abnormal period" },
  gap_detection: { label: "Gap Detection", desc: "Identify missing readings in expected reporting intervals" },
  battery_drain_rate: { label: "Battery Drain Rate", desc: "Predict days remaining based on historical drain curve" },
  range_validation: { label: "Range Validation", desc: "Flag values outside physically possible range for sensor type" },
  recurrence_detect: { label: "Recurrence Detection", desc: "Track repeat alarm triggers in rolling 24hr window" },
  tvoc_source_inference: { label: "TVOC Source Inference", desc: "Correlate TVOC spikes with time-of-day to infer source" },
  tvoc_temp_correlation: { label: "TVOC + Temp Correlation", desc: "TVOC rising + temp rising = possible refrigerant leak" },
  tvoc_decay_pattern: { label: "TVOC Decay Pattern", desc: "Track TVOC decay rate after spike — cleaning chemicals decay, leaks don't" },
  spike_detect: { label: "Spike Detection", desc: "Detect sudden value increases above rolling baseline" },
  gradual_rise_detect: { label: "Gradual Rise", desc: "Detect slow, sustained increases over hours (not spike)" },
  humidity_temp_correlation: { label: "Humidity + Temp Correlation", desc: "Rising humidity + rising temp together = air infiltration (gasket)" },
};

// Sensor key to alarm_sensor_type mapping for simulator
const SENSOR_KIND_MAP: Record<SensorKey, string> = {
  LHT65: "temp",
  LDS02: "door",
  R311A: "door",
  ERS_CO2: "co2",
  LWL02: "leak",
  R720E: "tvoc",
};

// ═══════════════════════════════════════════════════════════════
// TIER & ALARM RESOLUTION (client-side, for simulator)
// ═══════════════════════════════════════════════════════════════

function resolveTiers(deployedSensors: SensorKey[]): Set<DetectionTier> {
  const kinds = new Set(deployedSensors.map(s => SENSORS[s]?.kind));
  const count = deployedSensors.length;
  const tiers = new Set<DetectionTier>(["T1"]);
  if (count >= 1) tiers.add("T2");
  if (count >= 2 && kinds.has("temp") && kinds.has("door")) tiers.add("T3");
  if (kinds.has("multi") || kinds.has("leak") || kinds.has("tvoc")) tiers.add("T5");
  return tiers;
}

interface SimAlarm {
  id: string;
  slug: string;
  display_name: string;
  category: AlarmCategory;
  severity: AlarmSeverity;
  detection_tier: DetectionTier;
  applicable_sensor_types: string[];
  available: boolean;
  tierAvailable: boolean;
  sensorsAvailable: boolean;
}

function resolveAvailableAlarms(
  deployedSensors: SensorKey[],
  siteUnitCount: number,
  allAlarms: AlarmDefinition[],
): SimAlarm[] {
  const tiers = resolveTiers(deployedSensors);
  if (siteUnitCount >= 2) tiers.add("T4");

  const deployedKinds = new Set(deployedSensors.map(s => SENSOR_KIND_MAP[s]));

  return allAlarms.map(alarm => {
    const tierAvailable = tiers.has(alarm.detection_tier);
    const sensorTypes = alarm.applicable_sensor_types ?? [];
    const sensorsAvailable =
      sensorTypes.length === 0 ||
      sensorTypes.includes("any") ||
      sensorTypes.some(st => deployedKinds.has(st));
    return {
      id: alarm.id,
      slug: alarm.slug,
      display_name: alarm.display_name,
      category: alarm.category as AlarmCategory,
      severity: alarm.severity,
      detection_tier: alarm.detection_tier,
      applicable_sensor_types: sensorTypes,
      available: tierAvailable && sensorsAvailable,
      tierAvailable,
      sensorsAvailable,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function TierBadge({ tier }: { tier: DetectionTier }) {
  const t = TIERS[tier];
  return (
    <Badge variant="outline" className={`${t.bg} ${t.color} border-current/20 font-mono text-xs font-bold`}>
      {t.label}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: AlarmSeverity }) {
  const s = SEVERITIES[severity];
  return (
    <Badge variant={s.variant} className={s.className}>
      {s.label}
    </Badge>
  );
}

function AIHintChip({ hint }: { hint: string }) {
  const h = AI_HINTS[hint];
  if (!h) return null;
  return (
    <Badge
      variant="outline"
      className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800 text-[10px]"
      title={h.desc}
    >
      <Brain className="h-3 w-3 mr-1" />
      {h.label}
    </Badge>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: number; sub?: string; icon?: typeof Activity }) {
  return (
    <Card className="min-w-[100px]">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-2xl font-bold font-mono">{value}</span>
        </div>
        <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

type ViewMode = "library" | "simulator" | "ai";

export default function PlatformAlarmLibrary() {
  const { data: alarms = [], isLoading } = useAlarmDefinitions();
  const [view, setView] = useState<ViewMode>("library");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterTier, setFilterTier] = useState("all");
  const [filterSev, setFilterSev] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Simulator state
  const [simSensors, setSimSensors] = useState<SensorKey[]>(["LHT65"]);
  const [simSiteUnits, setSimSiteUnits] = useState(1);

  const filtered = useMemo(() => {
    return alarms.filter((a: AlarmDefinition) => {
      if (search && !`${a.display_name} ${a.slug} ${a.subcategory} ${a.what_we_observe} ${a.what_it_might_mean ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat !== "all" && a.category !== filterCat) return false;
      if (filterTier !== "all" && a.detection_tier !== filterTier) return false;
      if (filterSev !== "all" && a.severity !== filterSev) return false;
      return true;
    });
  }, [alarms, search, filterCat, filterTier, filterSev]);

  const simResults = useMemo(() => {
    return resolveAvailableAlarms(simSensors, simSiteUnits, alarms);
  }, [simSensors, simSiteUnits, alarms]);

  const stats = useMemo(() => {
    const tiers: Record<string, number> = {};
    const cats: Record<string, number> = {};
    alarms.forEach((a: AlarmDefinition) => {
      tiers[a.detection_tier] = (tiers[a.detection_tier] || 0) + 1;
      cats[a.category] = (cats[a.category] || 0) + 1;
    });
    return {
      total: alarms.length,
      tiers,
      cats,
      haccp: alarms.filter((a: AlarmDefinition) => a.requires_corrective_action).length,
      aiEnabled: alarms.filter((a: AlarmDefinition) => a.ai_hints?.length > 0).length,
    };
  }, [alarms]);

  const toggleSimSensor = (key: SensorKey) => {
    setSimSensors(prev =>
      prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key],
    );
  };

  return (
    <PlatformLayout title="Alarm Definition Library">
      {/* View Switcher */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["library", "simulator", "ai"] as const).map(v => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              size="sm"
              onClick={() => setView(v)}
              className="text-xs"
            >
              {v === "library" && <><BookOpen className="h-3.5 w-3.5 mr-1" /> Library</>}
              {v === "simulator" && <><Cpu className="h-3.5 w-3.5 mr-1" /> Unit Simulator</>}
              {v === "ai" && <><Brain className="h-3.5 w-3.5 mr-1" /> AI Engine</>}
            </Button>
          ))}
        </div>
        <div className="ml-auto text-xs text-muted-foreground font-medium">
          {stats.total} definitions &middot; {stats.aiEnabled} AI-enhanced &middot; {stats.haccp} HACCP-linked
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
        <StatCard label="Total Alarms" value={stats.total} icon={Activity} />
        {(Object.keys(TIERS) as DetectionTier[]).map(k => (
          <StatCard key={k} label={TIERS[k].name} value={stats.tiers[k] || 0} sub={k} />
        ))}
        <StatCard label="HACCP" value={stats.haccp} sub="Regulatory" icon={ClipboardCheck} />
        <StatCard label="AI-Enhanced" value={stats.aiEnabled} sub="Smart detection" icon={Brain} />
      </div>

      {/* ── LIBRARY VIEW ── */}
      {view === "library" && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search alarms..."
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {(Object.keys(TIERS) as DetectionTier[]).map(k => (
                  <SelectItem key={k} value={k}>{TIERS[k].label} — {TIERS[k].name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSev} onValueChange={setFilterSev}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {(Object.keys(SEVERITIES) as AlarmSeverity[]).map(k => (
                  <SelectItem key={k} value={k}>{SEVERITIES[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto text-xs text-muted-foreground font-semibold">
              {filtered.length} of {stats.total} shown
            </div>
          </div>

          {/* Alarm Table */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading alarm definitions...</div>
          ) : (
            <Card>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="w-14">Tier</TableHead>
                      <TableHead className="w-20">Severity</TableHead>
                      <TableHead>Alarm Definition</TableHead>
                      <TableHead className="hidden lg:table-cell">What We Observe</TableHead>
                      <TableHead className="w-16 text-center">HACCP</TableHead>
                      <TableHead className="w-14 text-center">AI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((alarm: AlarmDefinition) => (
                      <Collapsible key={alarm.id} asChild open={expandedId === alarm.id} onOpenChange={(open) => setExpandedId(open ? alarm.id : null)}>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50">
                              <TableCell><TierBadge tier={alarm.detection_tier} /></TableCell>
                              <TableCell><SeverityBadge severity={alarm.severity} /></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {expandedId === alarm.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                                  <div>
                                    <div className="font-semibold text-sm">{alarm.display_name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{alarm.slug}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[250px] truncate">
                                {alarm.what_we_observe}
                              </TableCell>
                              <TableCell className="text-center">
                                {alarm.requires_corrective_action && (
                                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 text-[10px]">HACCP</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {alarm.ai_hints?.length > 0 ? (
                                  <Brain className="h-4 w-4 text-purple-500 mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={6} className="p-0">
                                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">What We OBSERVE (Fact)</div>
                                      <div className="text-sm bg-background p-3 rounded-md border">{alarm.what_we_observe}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">What It MIGHT Mean (Inference)</div>
                                      <div className="text-sm bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-900 text-yellow-800 dark:text-yellow-200">
                                        {alarm.what_it_might_mean || "—"}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Eval Field</div>
                                        <code className="text-xs bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">{alarm.eval_field || "—"}</code>
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Confidence</div>
                                        <div className="text-xs font-semibold">{alarm.confidence_level}</div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Thresholds</div>
                                        <div className="text-xs">
                                          {alarm.threshold_min != null || alarm.threshold_max != null
                                            ? `${alarm.threshold_min ?? "—"} → ${alarm.threshold_max ?? "—"} ${alarm.threshold_unit || ""}`
                                            : "Pattern-based"}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Timing</div>
                                        <div className="text-xs">
                                          {alarm.duration_minutes ? `${alarm.duration_minutes}min delay` : "Instant"}
                                          {alarm.cooldown_minutes ? ` · ${alarm.cooldown_minutes}min cooldown` : ""}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Corrective Action</div>
                                      <div className="text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded-md border border-green-200 dark:border-green-900">
                                        {alarm.corrective_action_text || "—"}
                                      </div>
                                    </div>
                                    {alarm.regulatory_reference && (
                                      <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                                        <ClipboardCheck className="h-3 w-3" /> {alarm.regulatory_reference}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {alarm.ai_hints?.length > 0 && (
                                  <div className="px-4 pb-4">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                      <Brain className="h-3 w-3" /> AI Analysis Hints
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {alarm.ai_hints.map(h => <AIHintChip key={h} hint={h} />)}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── SIMULATOR VIEW ── */}
      {view === "simulator" && (
        <div className="space-y-5">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-base font-bold mb-1">Unit Sensor Configuration Simulator</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Select which sensors are deployed on a unit to see what detection tiers and alarms become available.
              </p>

              <div className="flex gap-8 flex-wrap">
                {/* Sensor selection */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Sensors on This Unit</div>
                  <div className="flex flex-col gap-2">
                    {(Object.keys(SENSORS) as SensorKey[]).map(key => {
                      const s = SENSORS[key];
                      const active = simSensors.includes(key);
                      return (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
                            active ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleSimSensor(key)}
                            className="accent-primary"
                          />
                          <div>
                            <div className={`text-sm font-bold ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.model}</div>
                            <div className="text-[10px] text-muted-foreground">{s.fields.join(", ")}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Site units */}
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Units at This Site</div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                        <Button
                          key={n}
                          variant={simSiteUnits === n ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9 p-0 text-sm font-bold"
                          onClick={() => setSimSiteUnits(n)}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Available tiers */}
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Available Detection Tiers</div>
                    <div className="flex flex-col gap-2">
                      {(Object.keys(TIERS) as DetectionTier[]).map(k => {
                        const available = resolveTiers(simSensors).has(k) || (k === "T4" && simSiteUnits >= 2);
                        const t = TIERS[k];
                        return (
                          <div
                            key={k}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-opacity ${
                              available ? `${t.bg} border-current/20` : "bg-muted/30 border-muted opacity-40"
                            }`}
                          >
                            <TierBadge tier={k} />
                            <div className="flex-1">
                              <div className={`text-xs font-bold ${available ? t.color : "text-muted-foreground"}`}>{t.name}</div>
                              <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                            </div>
                            <Badge variant={available ? "default" : "destructive"} className="text-[10px]">
                              {available ? "ACTIVE" : "LOCKED"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Simulation results */}
          <Card>
            <div className="p-4 border-b flex justify-between items-center">
              <div className="text-sm font-bold">
                Resolved Alarms:{" "}
                <span className="text-green-600">{simResults.filter(a => a.available).length}</span> active /{" "}
                <span className="text-red-600">{simResults.filter(a => !a.available).length}</span> locked
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                {(Object.keys(TIERS) as DetectionTier[]).map(k => {
                  const count = simResults.filter(a => a.available && a.detection_tier === k).length;
                  return <span key={k} className={count > 0 ? TIERS[k].color : "text-muted-foreground/30"}>{k}: {count}</span>;
                })}
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {[...simResults].sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1)).map(alarm => (
                <div
                  key={alarm.id}
                  className={`flex items-center gap-3 px-4 py-2 border-b last:border-b-0 ${
                    alarm.available ? "" : "opacity-30 bg-muted/20"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${alarm.available ? "bg-green-500" : "bg-red-500"}`} />
                  <TierBadge tier={alarm.detection_tier} />
                  <SeverityBadge severity={alarm.severity} />
                  <div className="flex-1 min-w-0 text-xs font-semibold truncate">{alarm.display_name}</div>
                  {!alarm.available && (
                    <div className="text-[10px] text-red-500 font-semibold whitespace-nowrap">
                      {!alarm.tierAvailable ? `Needs ${alarm.detection_tier}` : "Missing sensor"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── AI ENGINE VIEW ── */}
      {view === "ai" && (
        <div className="space-y-5">
          <Card className="bg-gradient-to-br from-purple-900/90 to-purple-800/90 text-white border-purple-700">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2"><Brain className="h-5 w-5" /> AI Analysis Engine</h3>
              <p className="text-sm text-purple-200">
                Smart detection capabilities that go beyond simple threshold checks. Each alarm references AI analysis hints that tell the engine what patterns to look for.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* AI Capabilities */}
            <Card>
              <CardContent className="p-5">
                <h4 className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-3">
                  Available AI Capabilities ({Object.keys(AI_HINTS).length})
                </h4>
                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                  {Object.entries(AI_HINTS).map(([key, hint]) => {
                    const usedBy = alarms.filter((a: AlarmDefinition) => a.ai_hints?.includes(key));
                    return (
                      <div key={key} className="p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{hint.label}</span>
                          <Badge variant="outline" className="ml-auto text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                            Used by {usedBy.length}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-relaxed">{hint.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* How it works */}
            <Card>
              <CardContent className="p-5">
                <h4 className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-3">How the AI Engine Works</h4>
                <div className="flex flex-col gap-3">
                  {[
                    { step: "1", title: "Ingest", desc: "Every sensor uplink flows through the webhook processor. Raw readings are stored and the AI engine receives the new data point.", color: "bg-blue-500" },
                    { step: "2", title: "Context Build", desc: "Engine queries the alarm library filtered by sensors deployed on this unit. Only alarms with matching tier + sensors are evaluated.", color: "bg-green-500" },
                    { step: "3", title: "T1 Evaluation", desc: "Simple threshold checks against current reading. Is temp > 46°F? Is battery < 15%? These fire instantly.", color: "bg-green-500" },
                    { step: "4", title: "T2 Analysis", desc: "Time series analysis using AI hints — rate_of_change, oscillation_detect, trend_analysis on the sensor's recent history.", color: "bg-blue-500" },
                    { step: "5", title: "T3 Correlation", desc: "Cross-sensor analysis. If alarm has correlate_with_door hint and a door sensor exists, the engine checks door state.", color: "bg-yellow-500" },
                    { step: "6", title: "T4 Site Check", desc: "If alarm has check_site_wide hint, engine compares this unit against all other units at the site.", color: "bg-red-500" },
                    { step: "7", title: "Confidence Score", desc: "Each triggered alarm gets a confidence score based on how many corroborating signals exist.", color: "bg-purple-500" },
                    { step: "8", title: "Smart Notification", desc: "Notification includes what we OBSERVE (fact) and what it MIGHT mean (inference at confidence level).", color: "bg-pink-500" },
                  ].map(item => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <div className={`w-7 h-7 rounded-full ${item.color} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                        {item.step}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{item.title}</div>
                        <div className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                  <div className="text-xs font-bold text-yellow-800 dark:text-yellow-200 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Key Principle: Honest Uncertainty
                  </div>
                  <div className="text-[11px] text-yellow-700 dark:text-yellow-300 leading-relaxed">
                    The engine NEVER pretends to know more than the sensors tell it. A single temp sensor can tell you the temperature IS 50°F (fact). It CANNOT tell you WHY. Adding a door sensor lets you rule out door-related causes. Each additional sensor narrows the possibilities — but the engine always communicates what it knows vs. what it&apos;s guessing.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tier Legend Footer */}
      <div className="flex gap-2 flex-wrap mt-6 pt-4 border-t">
        {(Object.keys(TIERS) as DetectionTier[]).map(k => {
          const t = TIERS[k];
          return (
            <Badge key={k} variant="outline" className={`${t.bg} ${t.color} border-current/20 text-xs`}>
              <span className="font-bold mr-1">{t.label}</span>
              <span className="text-muted-foreground">{t.name}</span>
            </Badge>
          );
        })}
      </div>
    </PlatformLayout>
  );
}
