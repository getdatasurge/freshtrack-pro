/**
 * SensorSettingsDrawer
 *
 * Right-side sheet that lets the user apply remote device configuration
 * changes to a selected sensor via TTN downlinks.
 *
 * Design decisions:
 *  - Unit settings are canonical for alarm thresholds.
 *  - Sensor inherits unit defaults unless "Override unit alarm" is toggled.
 *  - Each "Apply" creates one pending change + one downlink (REPLACE, unconfirmed).
 *  - Pending/Applied/Failed status shown in the change history section.
 *  - Per-button loading states track which specific command is being sent.
 *  - Pending changes list auto-refreshes while there are 'sent' items.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Zap,
  Clock,
  Thermometer,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Settings2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { LoraSensor } from "@/types/ttn";
import {
  UPLINK_PRESETS,
  type SensorPendingChange,
  type SensorChangeStatus,
  type ExtMode,
} from "@/types/sensorConfig";
import {
  useSensorConfig,
  useSensorPendingChanges,
  useSendDownlink,
} from "@/hooks/useSensorConfig";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SensorSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sensor: LoraSensor;
  /** Unit alarm defaults (from unit settings) */
  unitAlarmLow: number | null;   // °F from unit_settings
  unitAlarmHigh: number | null;  // °F from unit_settings
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** °F → °C */
function fToC(f: number): number {
  return (f - 32) * (5 / 9);
}

/** °C → °F */
function cToF(c: number): number {
  return c * (9 / 5) + 32;
}

function statusIcon(status: SensorChangeStatus) {
  switch (status) {
    case "queued":
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    case "sent":
      return <Send className="w-3.5 h-3.5 text-blue-500" />;
    case "applied":
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    case "failed":
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case "timeout":
      return <Timer className="w-3.5 h-3.5 text-amber-500" />;
  }
}

function statusBadgeClass(status: SensorChangeStatus): string {
  switch (status) {
    case "queued":
      return "bg-muted text-muted-foreground";
    case "sent":
      return "bg-blue-500/15 text-blue-600";
    case "applied":
      return "bg-green-500/15 text-green-600";
    case "failed":
      return "bg-red-500/15 text-red-600";
    case "timeout":
      return "bg-amber-500/15 text-amber-600";
  }
}

/** Track which button triggered the current mutation */
type ActiveCommand =
  | { type: "preset"; label: string }
  | { type: "interval" }
  | { type: "ext_mode" }
  | { type: "time_sync" }
  | { type: "time_sync_days" }
  | { type: "set_time" }
  | { type: "alarm" }
  | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SensorSettingsDrawer({
  open,
  onOpenChange,
  sensor,
  unitAlarmLow,
  unitAlarmHigh,
}: SensorSettingsDrawerProps) {
  const { data: config, isLoading: configLoading } = useSensorConfig(
    open ? sensor.id : null
  );
  const {
    data: pendingChanges,
    isLoading: changesLoading,
    refetch: refetchChanges,
  } = useSensorPendingChanges(open ? sensor.id : null);
  const sendDownlink = useSendDownlink();

  // --- Per-button loading tracking ---
  const [activeCmd, setActiveCmd] = useState<ActiveCommand>(null);

  // Clear active command when mutation settles
  useEffect(() => {
    if (!sendDownlink.isPending) {
      setActiveCmd(null);
    }
  }, [sendDownlink.isPending]);

  // --- Auto-refresh when there are 'sent' changes ---
  const hasSentChanges = pendingChanges?.some((c) => c.status === "sent");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && hasSentChanges) {
      pollRef.current = setInterval(() => {
        refetchChanges();
      }, 15_000); // refresh every 15s while 'sent' changes exist
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, hasSentChanges, refetchChanges]);

  // --- Local form state ---
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState("");
  const [extMode, setExtMode] = useState<ExtMode | "">("");
  const [timeSyncEnabled, setTimeSyncEnabled] = useState(false);
  const [timeSyncDays, setTimeSyncDays] = useState("10");
  const [overrideAlarm, setOverrideAlarm] = useState(false);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmLowF, setAlarmLowF] = useState("");
  const [alarmHighF, setAlarmHighF] = useState("");
  const [alarmCheckMin, setAlarmCheckMin] = useState("1");

  // Sync form state from loaded config
  useEffect(() => {
    if (config) {
      if (config.uplink_interval_s) {
        setIntervalMinutes(String(Math.round(config.uplink_interval_s / 60)));
      }
      setExtMode(config.ext_mode || "");
      setTimeSyncEnabled(config.time_sync_enabled);
      if (config.time_sync_days !== null)
        setTimeSyncDays(String(config.time_sync_days));
      setOverrideAlarm(config.override_unit_alarm);
      setAlarmEnabled(config.alarm_enabled);
      if (config.alarm_low !== null)
        setAlarmLowF(String(Math.round(cToF(config.alarm_low))));
      if (config.alarm_high !== null)
        setAlarmHighF(String(Math.round(cToF(config.alarm_high))));
      if (config.alarm_check_minutes !== null)
        setAlarmCheckMin(String(config.alarm_check_minutes));
    } else {
      // Defaults from unit settings
      if (unitAlarmLow !== null) setAlarmLowF(String(unitAlarmLow));
      if (unitAlarmHigh !== null) setAlarmHighF(String(unitAlarmHigh));
    }
  }, [config, unitAlarmLow, unitAlarmHigh]);

  // --- Apply handlers (one command = one downlink) ---

  const applyInterval = useCallback(
    (seconds: number, presetLabel?: string) => {
      setActiveCmd(
        presetLabel ? { type: "preset", label: presetLabel } : { type: "interval" }
      );
      sendDownlink.mutate({
        sensorId: sensor.id,
        commandType: "uplink_interval",
        commandParams: { type: "uplink_interval", seconds },
      });
    },
    [sensor.id, sendDownlink]
  );

  const applyExtMode = useCallback(() => {
    if (!extMode) return;
    setActiveCmd({ type: "ext_mode" });
    sendDownlink.mutate({
      sensorId: sensor.id,
      commandType: "ext_mode",
      commandParams: { type: "ext_mode", mode: extMode },
    });
  }, [sensor.id, extMode, sendDownlink]);

  const applyTimeSync = useCallback(
    (enable: boolean) => {
      setActiveCmd({ type: "time_sync" });
      sendDownlink.mutate({
        sensorId: sensor.id,
        commandType: "time_sync",
        commandParams: { type: "time_sync", enable },
      });
    },
    [sensor.id, sendDownlink]
  );

  const applyTimeSyncDays = useCallback(() => {
    const days = parseInt(timeSyncDays) || 10;
    setActiveCmd({ type: "time_sync_days" });
    sendDownlink.mutate({
      sensorId: sensor.id,
      commandType: "time_sync",
      commandParams: { type: "time_sync_days", days },
    });
  }, [sensor.id, timeSyncDays, sendDownlink]);

  const applySetTimeNow = useCallback(() => {
    const unixTs = Math.floor(Date.now() / 1000);
    setActiveCmd({ type: "set_time" });
    sendDownlink.mutate({
      sensorId: sensor.id,
      commandType: "set_time",
      commandParams: { type: "set_time", unix_ts: unixTs },
    });
  }, [sensor.id, sendDownlink]);

  const applyAlarm = useCallback(() => {
    const lowF = parseFloat(alarmLowF);
    const highF = parseFloat(alarmHighF);
    const checkMin = parseInt(alarmCheckMin) || 1;
    if (isNaN(lowF) || isNaN(highF)) return;
    const lowC = fToC(lowF);
    const highC = fToC(highF);
    setActiveCmd({ type: "alarm" });
    sendDownlink.mutate({
      sensorId: sensor.id,
      commandType: "alarm",
      commandParams: {
        type: "alarm",
        enable: alarmEnabled,
        check_minutes: checkMin,
        low_c: Math.round(lowC * 100) / 100,
        high_c: Math.round(highC * 100) / 100,
      },
    });
  }, [
    sensor.id,
    alarmEnabled,
    alarmLowF,
    alarmHighF,
    alarmCheckMin,
    sendDownlink,
  ]);

  const applyCustomInterval = useCallback(() => {
    const minutes = parseFloat(intervalMinutes);
    if (isNaN(minutes) || minutes < 1) return;
    applyInterval(Math.round(minutes * 60));
  }, [intervalMinutes, applyInterval]);

  const isBusy = sendDownlink.isPending;

  // Helper: is this specific button the one that's loading?
  const isLoading = (cmd: ActiveCommand): boolean => {
    if (!isBusy || !activeCmd || !cmd) return false;
    if (cmd.type === "preset" && activeCmd.type === "preset") {
      return cmd.label === activeCmd.label;
    }
    return cmd.type === activeCmd.type;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Sensor Settings
          </SheetTitle>
          <SheetDescription>
            Configure device settings via LoRaWAN downlink
          </SheetDescription>
        </SheetHeader>

        {/* ------------------------------------------------------------------ */}
        {/* Device Info (read-only)                                             */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-1 text-sm mb-6 p-3 rounded-lg bg-muted/40">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Device ID</span>
            <span className="font-mono text-xs">
              {sensor.ttn_device_id || sensor.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">DevEUI</span>
            <span className="font-mono text-xs">{sensor.dev_eui}</span>
          </div>
          {sensor.last_seen_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last uplink</span>
              <span>
                {formatDistanceToNow(new Date(sensor.last_seen_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
          {config?.uplink_interval_s && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uplink interval</span>
              <span>{Math.round(config.uplink_interval_s / 60)} min</span>
            </div>
          )}
          {config?.last_applied_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last confirmed</span>
              <span>
                {formatDistanceToNow(new Date(config.last_applied_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
        </div>

        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* -------------------------------------------------------------- */}
            {/* Quick Presets                                                    */}
            {/* -------------------------------------------------------------- */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Quick Presets
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {UPLINK_PRESETS.map((preset) => {
                  const loading = isLoading({
                    type: "preset",
                    label: preset.label,
                  });
                  return (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        applyInterval(preset.interval_s, preset.label)
                      }
                      className="flex flex-col h-auto py-2.5 gap-0.5"
                    >
                      {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <span className="text-xs font-medium">
                            {preset.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {preset.description}
                          </span>
                        </>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* -------------------------------------------------------------- */}
            {/* Advanced Settings (collapsible)                                 */}
            {/* -------------------------------------------------------------- */}
            <div>
              <button
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="flex items-center gap-2 text-sm font-semibold w-full text-left"
              >
                {advancedOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Advanced Settings
              </button>

              {advancedOpen && (
                <div className="mt-4 space-y-5">
                  {/* Custom Uplink Interval */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">
                      Uplink Interval (minutes)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="279620"
                        placeholder="e.g. 10"
                        value={intervalMinutes}
                        onChange={(e) => setIntervalMinutes(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={isBusy || !intervalMinutes}
                        onClick={applyCustomInterval}
                      >
                        {isLoading({ type: "interval" }) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* External Mode (LHT65N) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">
                      External Mode (LHT65N)
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={extMode}
                        onValueChange={(v) => setExtMode(v as ExtMode)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="e3_ext1">
                            E3 Temp Probe (ext=1)
                          </SelectItem>
                          <SelectItem value="e3_ext9">
                            E3 + Timestamp (ext=9)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={isBusy || !extMode}
                        onClick={applyExtMode}
                      >
                        {isLoading({ type: "ext_mode" }) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Time Sync */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Time Sync</Label>
                      <div className="flex items-center gap-2">
                        {isLoading({ type: "time_sync" }) && (
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={timeSyncEnabled}
                          onCheckedChange={(checked) => {
                            setTimeSyncEnabled(checked);
                            applyTimeSync(checked);
                          }}
                          disabled={isBusy}
                        />
                      </div>
                    </div>

                    {timeSyncEnabled && (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Sync interval (days)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max="255"
                            value={timeSyncDays}
                            onChange={(e) => setTimeSyncDays(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={applyTimeSyncDays}
                        >
                          {isLoading({ type: "time_sync_days" }) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={applySetTimeNow}
                      className="w-full"
                    >
                      {isLoading({ type: "set_time" }) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Set Device Time to Now
                    </Button>
                  </div>

                  <Separator />

                  {/* Alarm Configuration */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Thermometer className="w-3.5 h-3.5" />
                        Alarm Thresholds
                      </Label>
                    </div>

                    {/* Override toggle */}
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-xs text-muted-foreground">
                        Override unit defaults
                      </span>
                      <Switch
                        checked={overrideAlarm}
                        onCheckedChange={setOverrideAlarm}
                        disabled={isBusy}
                      />
                    </div>

                    {!overrideAlarm && (
                      <p className="text-xs text-muted-foreground italic">
                        Using unit defaults: Low {unitAlarmLow ?? "\u2014"}°F /
                        High {unitAlarmHigh ?? "\u2014"}°F
                      </p>
                    )}

                    {overrideAlarm && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">
                            Enable on-device alarm
                          </Label>
                          <Switch
                            checked={alarmEnabled}
                            onCheckedChange={setAlarmEnabled}
                            disabled={isBusy}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">
                              Low (°F)
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={alarmLowF}
                              onChange={(e) => setAlarmLowF(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">
                              High (°F)
                            </Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={alarmHighF}
                              onChange={(e) => setAlarmHighF(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">
                              Check (min)
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              max="65535"
                              value={alarmCheckMin}
                              onChange={(e) => setAlarmCheckMin(e.target.value)}
                            />
                          </div>
                        </div>

                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={applyAlarm}
                          className="w-full"
                        >
                          {isLoading({ type: "alarm" }) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Apply Alarm Settings
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* -------------------------------------------------------------- */}
            {/* Recent Changes (pending / applied / failed)                     */}
            {/* -------------------------------------------------------------- */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Recent Changes</h3>
                {hasSentChanges && (
                  <button
                    onClick={() => refetchChanges()}
                    className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Refresh"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {changesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : !pendingChanges || pendingChanges.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No downlink changes recorded yet
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pendingChanges.map((change: SensorPendingChange) => (
                    <div
                      key={change.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs"
                    >
                      <div className="mt-0.5">
                        {statusIcon(change.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">
                            {change.expected_result || change.change_type}
                          </span>
                          <Badge
                            className={cn(
                              "text-[10px] border-0 px-1.5 py-0",
                              statusBadgeClass(change.status)
                            )}
                          >
                            {change.status}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(change.requested_at),
                            { addSuffix: true }
                          )}
                        </span>
                        {change.status === "sent" && (
                          <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Awaiting next uplink (Class A)
                          </p>
                        )}
                        {change.status === "applied" && change.applied_at && (
                          <p className="text-green-600 mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed{" "}
                            {formatDistanceToNow(
                              new Date(change.applied_at),
                              { addSuffix: true }
                            )}
                          </p>
                        )}
                        {change.status === "timeout" && (
                          <p className="text-amber-600 mt-0.5 flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            No confirmation received
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
