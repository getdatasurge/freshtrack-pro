/**
 * AlarmScenarioRunner — Admin UI for browsing and running alarm test scenarios.
 *
 * Features:
 * - Browse all scenarios from alarm_test_scenarios table
 * - Filter by tier (T1–T5), equipment type, severity
 * - View payload sequence timeline for each scenario
 * - Run a scenario against a selected unit
 * - Progress indicator during multi-step scenarios
 * - Results log with pass/fail per step
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Thermometer,
  DoorOpen,
  Battery,
  Signal,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  loadScenarios,
  runScenario,
  TIER_META,
  getSeverityVariant,
  type AlarmScenario,
  type ScenarioRunProgress,
  type ScenarioResult,
} from "@/lib/alarmScenarios";

interface Unit {
  id: string;
  name: string;
  unit_type: string;
  area: { name: string; site: { name: string } };
}

interface AlarmScenarioRunnerProps {
  organizationId: string | null;
}

export function AlarmScenarioRunner({
  organizationId,
}: AlarmScenarioRunnerProps) {
  const [scenarios, setScenarios] = useState<AlarmScenario[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  // Running state
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(
    null
  );
  const [progress, setProgress] = useState<ScenarioRunProgress | null>(null);
  const [lastResult, setLastResult] = useState<ScenarioResult | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters =
        selectedTier !== "all" ? { tier: selectedTier } : undefined;
      const data = await loadScenarios(filters);
      setScenarios(data);
    } catch (error) {
      console.error("[AlarmScenarioRunner] Failed to load scenarios:", error);
    }
    setIsLoading(false);
  }, [selectedTier]);

  const loadUnits = useCallback(async () => {
    if (!organizationId) return;

    const { data: areasData } = await supabase
      .from("areas")
      .select("id, site:sites!inner(organization_id)")
      .eq("is_active", true)
      .eq("sites.organization_id", organizationId);

    const areaIds = (areasData || []).map((a: any) => a.id);
    if (areaIds.length === 0) return;

    const { data } = await supabase
      .from("units")
      .select(
        "id, name, unit_type, area:areas!inner(name, site:sites!inner(name))"
      )
      .in("area_id", areaIds)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name");

    setUnits(
      (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        unit_type: u.unit_type,
        area: {
          name: u.area?.name || "",
          site: { name: u.area?.site?.name || "" },
        },
      }))
    );
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const handleRunScenario = async (scenarioId: string) => {
    if (!selectedUnit) return;

    setRunningScenarioId(scenarioId);
    setProgress(null);
    setLastResult(null);

    const result = await runScenario(scenarioId, selectedUnit, (p) =>
      setProgress(p)
    );

    setLastResult(result);
    setRunningScenarioId(null);
    setProgress(null);
  };

  const toggleExpand = (scenarioId: string) => {
    setExpandedScenario((prev) =>
      prev === scenarioId ? null : scenarioId
    );
  };

  // Group scenarios by tier
  const groupedByTier = scenarios.reduce(
    (acc, s) => {
      if (!acc[s.tier]) acc[s.tier] = [];
      acc[s.tier].push(s);
      return acc;
    },
    {} as Record<string, AlarmScenario[]>
  );

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "T1":
        return <Thermometer className="w-4 h-4" />;
      case "T2":
        return <Activity className="w-4 h-4" />;
      case "T3":
        return <Clock className="w-4 h-4" />;
      case "T4":
        return <DoorOpen className="w-4 h-4" />;
      case "T5":
        return <Battery className="w-4 h-4" />;
      default:
        return <Signal className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-500">
            Alarm Scenario Testing Tool
          </p>
          <p className="text-sm text-muted-foreground">
            Run predefined alarm scenarios to validate the alarm evaluation
            pipeline. Scenarios inject real data — alerts, emails, and
            compliance records will be generated.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Alarm Scenarios
          </CardTitle>
          <CardDescription>
            {scenarios.length} scenarios across {Object.keys(groupedByTier).length} tiers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Unit selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Unit</label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a unit to test..." />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.area.site.name} / {unit.area.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tier filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Tier</label>
              <Tabs
                value={selectedTier}
                onValueChange={setSelectedTier}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="T1">T1</TabsTrigger>
                  <TabsTrigger value="T2">T2</TabsTrigger>
                  <TabsTrigger value="T3">T3</TabsTrigger>
                  <TabsTrigger value="T4">T4</TabsTrigger>
                  <TabsTrigger value="T5">T5</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {!selectedUnit && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Select a unit to begin</p>
              <p className="text-xs mt-1">
                Choose a target unit above, then run scenarios against it.
              </p>
            </div>
          )}

          {/* Progress bar (while running) */}
          {runningScenarioId && progress && (
            <div className="p-4 border rounded-lg bg-primary/5 border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    Running: {runningScenarioId}
                  </span>
                </div>
                <Badge variant="outline">
                  {progress.step}/{progress.total}
                </Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${(progress.step / progress.total) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progress.status === "waiting" ? "⏳ " : "📡 "}
                {progress.description}
              </p>
            </div>
          )}

          {/* Last result */}
          {lastResult && !runningScenarioId && (
            <div
              className={`p-4 border rounded-lg space-y-2 ${
                lastResult.status === "completed"
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-red-500/5 border-red-500/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {lastResult.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {lastResult.scenario_id}:{" "}
                    {lastResult.status === "completed" ? "Completed" : "Failed"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {lastResult.payloads_sent} payloads sent
                </span>
              </div>
              {lastResult.error && (
                <p className="text-xs text-red-500">{lastResult.error}</p>
              )}
              <div className="space-y-1">
                {lastResult.steps.map((step) => (
                  <div
                    key={step.step}
                    className="flex items-center gap-2 text-xs"
                  >
                    {step.success ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    <span className="text-muted-foreground">
                      Step {step.step}: {step.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Scenario list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByTier)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([tier, tierScenarios]) => {
                  const meta = TIER_META[tier] || {
                    label: tier,
                    color: "bg-gray-500",
                    description: "",
                  };
                  return (
                    <div key={tier} className="space-y-2">
                      {/* Tier header */}
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${meta.color}`}
                        />
                        {getTierIcon(tier)}
                        <span className="text-sm font-semibold">
                          {meta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — {meta.description}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {tierScenarios.length}
                        </Badge>
                      </div>

                      {/* Scenario cards */}
                      <div className="space-y-1 ml-4">
                        {tierScenarios.map((scenario) => {
                          const isExpanded =
                            expandedScenario === scenario.scenario_id;
                          const isRunning =
                            runningScenarioId === scenario.scenario_id;

                          return (
                            <div
                              key={scenario.scenario_id}
                              className="border rounded-lg"
                            >
                              {/* Scenario row */}
                              <div
                                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                                onClick={() =>
                                  toggleExpand(scenario.scenario_id)
                                }
                              >
                                <code className="text-xs font-mono text-muted-foreground w-48 flex-shrink-0">
                                  {scenario.scenario_id}
                                </code>
                                <span className="text-sm flex-1">
                                  {scenario.name}
                                </span>
                                <Badge
                                  variant={getSeverityVariant(
                                    scenario.expected_severity
                                  )}
                                  className="text-xs"
                                >
                                  {scenario.expected_severity}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {scenario.payload_sequence.length} steps
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={
                                    !selectedUnit || runningScenarioId !== null
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRunScenario(scenario.scenario_id);
                                  }}
                                >
                                  {isRunning ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </Button>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>

                              {/* Expanded detail */}
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-3 border-t bg-muted/20">
                                  <div className="pt-3">
                                    <p className="text-sm text-muted-foreground">
                                      {scenario.description}
                                    </p>
                                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                      <span>
                                        Equipment:{" "}
                                        <strong>
                                          {scenario.equipment_type}
                                        </strong>
                                      </span>
                                      <span>
                                        Sensor:{" "}
                                        <strong>{scenario.sensor_model}</strong>
                                      </span>
                                      <span>
                                        Expected:{" "}
                                        <strong>
                                          {scenario.expected_alarm_type}
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Payload timeline */}
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium">
                                      Payload Sequence:
                                    </p>
                                    {scenario.payload_sequence.map(
                                      (step, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-start gap-2 text-xs p-2 rounded bg-background border"
                                        >
                                          <Badge
                                            variant="outline"
                                            className="text-xs flex-shrink-0"
                                          >
                                            {idx + 1}
                                          </Badge>
                                          {step.delay_ms > 0 && (
                                            <span className="text-muted-foreground flex-shrink-0">
                                              +{Math.round(step.delay_ms / 1000)}s
                                            </span>
                                          )}
                                          <span className="flex-1">
                                            {step.description}
                                          </span>
                                          <code className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                                            {JSON.stringify(
                                              step.decoded_payload
                                            ).slice(0, 60)}
                                            ...
                                          </code>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  {/* Tags */}
                                  {scenario.tags.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                      {scenario.tags.map((tag) => (
                                        <Badge
                                          key={tag}
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
