/**
 * Alarm Test Scenarios — loader and runner
 *
 * Fetches predefined alarm scenarios from the alarm_test_scenarios table
 * and runs them by sending sequential uplinks through the sensor-simulator
 * edge function, then triggers evaluate-alarms for alarm pipeline testing.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PayloadStep {
  delay_ms: number;
  decoded_payload: Record<string, unknown>;
  f_port: number;
  description: string;
  /** For multi-sensor scenarios: identifies which sensor to target ("A", "B", "door", "temp") */
  _sensor?: string;
  /** Optional rx_metadata override for signal-strength scenarios */
  _rx_metadata?: { rssi: number; snr: number };
}

export interface AlarmScenario {
  id: string;
  scenario_id: string;
  tier: "T1" | "T2" | "T3" | "T4" | "T5";
  name: string;
  description: string;
  equipment_type: string;
  sensor_model: string;
  payload_sequence: PayloadStep[];
  expected_alarm_type: string;
  expected_severity: "info" | "warning" | "critical";
  tags: string[];
}

export interface ScenarioRunProgress {
  step: number;
  total: number;
  description: string;
  status: "sending" | "waiting" | "done";
}

export interface ScenarioResult {
  scenario_id: string;
  started_at: string;
  completed_at: string;
  payloads_sent: number;
  status: "completed" | "failed" | "timeout";
  error?: string;
  steps: {
    step: number;
    description: string;
    sent_at: string;
    success: boolean;
    error?: string;
  }[];
}

// ─── Loader ────────────────────────────────────────────────────────────────

/**
 * Fetch all alarm test scenarios from the database.
 * Optionally filter by tier, equipment_type, or tags.
 */
export async function loadScenarios(filters?: {
  tier?: string;
  equipment_type?: string;
  severity?: string;
}): Promise<AlarmScenario[]> {
  const db = supabase as any;
  let query = db
    .from("alarm_test_scenarios")
    .select("*")
    .order("tier")
    .order("scenario_id");

  if (filters?.tier) {
    query = query.eq("tier", filters.tier);
  }
  if (filters?.equipment_type) {
    query = query.eq("equipment_type", filters.equipment_type);
  }
  if (filters?.severity) {
    query = query.eq("expected_severity", filters.severity);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[alarmScenarios] Failed to load scenarios:", error);
    throw new Error(`Failed to load scenarios: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    scenario_id: row.scenario_id,
    tier: row.tier,
    name: row.name,
    description: row.description || "",
    equipment_type: row.equipment_type,
    sensor_model: row.sensor_model,
    payload_sequence:
      typeof row.payload_sequence === "string"
        ? JSON.parse(row.payload_sequence)
        : row.payload_sequence,
    expected_alarm_type: row.expected_alarm_type || "",
    expected_severity: row.expected_severity || "warning",
    tags: row.tags || [],
  }));
}

/**
 * Load a single scenario by its scenario_id (e.g. "T1-COOLER-HIGH-WARN").
 */
export async function loadScenarioById(
  scenarioId: string
): Promise<AlarmScenario | null> {
  const db = supabase as any;
  const { data, error } = await db
    .from("alarm_test_scenarios")
    .select("*")
    .eq("scenario_id", scenarioId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    scenario_id: data.scenario_id,
    tier: data.tier,
    name: data.name,
    description: data.description || "",
    equipment_type: data.equipment_type,
    sensor_model: data.sensor_model,
    payload_sequence:
      typeof data.payload_sequence === "string"
        ? JSON.parse(data.payload_sequence)
        : data.payload_sequence,
    expected_alarm_type: data.expected_alarm_type || "",
    expected_severity: data.expected_severity || "warning",
    tags: data.tags || [],
  };
}

// ─── Runner ────────────────────────────────────────────────────────────────

/**
 * Run a scenario by sending each payload step through the sensor-simulator
 * edge function with the configured delays between steps.
 *
 * @param scenarioId - The scenario_id to run (e.g. "T1-COOLER-HIGH-WARN")
 * @param unitId - The unit to inject readings into
 * @param onProgress - Optional callback for progress updates
 * @returns ScenarioResult with timing and pass/fail status
 */
export async function runScenario(
  scenarioId: string,
  unitId: string,
  onProgress?: (progress: ScenarioRunProgress) => void
): Promise<ScenarioResult> {
  const scenario = await loadScenarioById(scenarioId);
  if (!scenario) {
    return {
      scenario_id: scenarioId,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      payloads_sent: 0,
      status: "failed",
      error: `Scenario not found: ${scenarioId}`,
      steps: [],
    };
  }

  const startedAt = new Date().toISOString();
  const steps: ScenarioResult["steps"] = [];
  const payloads = scenario.payload_sequence;

  for (let i = 0; i < payloads.length; i++) {
    const step = payloads[i];

    // Wait for the delay (skip for first step which has delay_ms: 0)
    if (step.delay_ms > 0) {
      onProgress?.({
        step: i + 1,
        total: payloads.length,
        description: `Waiting ${Math.round(step.delay_ms / 1000)}s before: ${step.description}`,
        status: "waiting",
      });

      await sleep(step.delay_ms);
    }

    onProgress?.({
      step: i + 1,
      total: payloads.length,
      description: step.description,
      status: "sending",
    });

    try {
      // Extract temperature from the payload (convert °C to °F for the simulator)
      const tempC =
        (step.decoded_payload.TempC_SHT as number) ??
        (step.decoded_payload.temperature as number) ??
        undefined;
      const tempF = tempC !== undefined ? tempC * 9 / 5 + 32 : undefined;

      const humidity =
        (step.decoded_payload.Hum_SHT as number) ??
        (step.decoded_payload.humidity as number) ??
        undefined;

      // Send through the sensor-simulator edge function
      const { error: invokeError } = await supabase.functions.invoke(
        "sensor-simulator",
        {
          body: {
            action: "inject",
            unit_id: unitId,
            temperature: tempF,
            humidity: humidity,
          },
        }
      );

      if (invokeError) {
        steps.push({
          step: i + 1,
          description: step.description,
          sent_at: new Date().toISOString(),
          success: false,
          error: invokeError.message,
        });
      } else {
        steps.push({
          step: i + 1,
          description: step.description,
          sent_at: new Date().toISOString(),
          success: true,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({
        step: i + 1,
        description: step.description,
        sent_at: new Date().toISOString(),
        success: false,
        error: msg,
      });

      // Stop on failure
      return {
        scenario_id: scenarioId,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        payloads_sent: steps.filter((s) => s.success).length,
        status: "failed",
        error: `Step ${i + 1} failed: ${msg}`,
        steps,
      };
    }

    onProgress?.({
      step: i + 1,
      total: payloads.length,
      description: step.description,
      status: "done",
    });
  }

  // Trigger alarm evaluation after all payloads are sent
  try {
    await supabase.functions.invoke("process-unit-states");
  } catch {
    // Non-fatal — alarm eval is best-effort
    console.warn("[alarmScenarios] process-unit-states invocation failed");
  }

  const failedSteps = steps.filter((s) => !s.success);

  return {
    scenario_id: scenarioId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    payloads_sent: steps.filter((s) => s.success).length,
    status: failedSteps.length > 0 ? "failed" : "completed",
    error:
      failedSteps.length > 0
        ? `${failedSteps.length} step(s) failed`
        : undefined,
    steps,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get tier display metadata for UI rendering.
 */
export const TIER_META: Record<
  string,
  { label: string; color: string; description: string }
> = {
  T1: {
    label: "T1 — Threshold",
    color: "bg-blue-500",
    description: "Single reading crosses boundary",
  },
  T2: {
    label: "T2 — Rate of Change",
    color: "bg-amber-500",
    description: "Temperature rising/falling too fast",
  },
  T3: {
    label: "T3 — Duration",
    color: "bg-orange-500",
    description: "Condition sustained beyond time limit",
  },
  T4: {
    label: "T4 — Pattern",
    color: "bg-red-500",
    description: "Multi-sensor or cross-reading correlation",
  },
  T5: {
    label: "T5 — System",
    color: "bg-purple-500",
    description: "Device health, connectivity, battery",
  },
};

/**
 * Get severity badge variant for UI rendering.
 */
export function getSeverityVariant(
  severity: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "default";
    case "info":
      return "secondary";
    default:
      return "outline";
  }
}
