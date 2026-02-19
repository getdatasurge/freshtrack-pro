/**
 * SensorSettingsDrawer — Catalog-Driven
 *
 * Generic renderer that builds its UI entirely from the sensor_catalog
 * `downlink_info.commands` definition. No hardcoded sensor-type layouts.
 *
 * Adding a new sensor model with new commands to the catalog requires
 * ZERO UI code changes — the drawer reads the commands and renders
 * the appropriate controls automatically.
 *
 * Design decisions:
 *  - Every control, label, validation rule, and encoding comes from the catalog.
 *  - Quick Presets are shown only if the sensor has a `set_tdc` command.
 *  - Action buttons with `confirmation` show a dialog before sending.
 *  - Temperature fields convert from display unit using the encoder.
 *  - Per-button loading states track which command is being sent.
 *  - Pending changes list auto-refreshes while there are 'sent' items.
 *  - Fallback for sensors not yet extended: read-only command summary.
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Settings2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Info,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { LoraSensor } from "@/types/ttn";
import {
  UPLINK_PRESETS,
  type SensorPendingChange,
  type SensorChangeStatus,
} from "@/types/sensorConfig";
import {
  useSensorConfig,
  useSensorPendingChanges,
  useSendDownlink,
} from "@/hooks/useSensorConfig";
import { useSensorCatalogById } from "@/hooks/useSensorCatalog";
import type {
  CatalogDownlinkCommand,
  CatalogDownlinkField,
  SensorCatalogDownlinkInfo,
} from "@/types/sensorCatalog";
import { isExtendedCommand } from "@/types/sensorCatalog";
import {
  encodeDownlinkCommand,
  buildExpectedResult,
} from "@/lib/downlink/encoder";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SensorSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sensor: LoraSensor;
  /** Unit alarm defaults (from unit settings) — informational only */
  unitAlarmLow: number | null;
  unitAlarmHigh: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Display label for a change in Recent Changes. Reads catalog metadata from command_params. */
function changeDisplayLabel(change: SensorPendingChange): string {
  // Catalog commands store the name in command_params
  const params = change.command_params as Record<string, unknown> | null;
  if (params?.commandName && typeof params.commandName === "string") {
    return params.commandName;
  }
  // Legacy change types
  switch (change.change_type) {
    case "uplink_interval":
      return "Reporting interval";
    case "set_time":
      return "Clock synced";
    case "ext_mode":
      return "External probe type";
    case "time_sync":
      return "Clock sync setting";
    case "alarm":
      return "Temperature alerts";
    case "catalog":
      return change.expected_result || "Device command";
    default:
      return change.change_type;
  }
}

// Category sort order
const CATEGORY_ORDER: Record<string, number> = {
  interval: 0,
  alarm: 1,
  mode: 2,
  action: 3,
  advanced: 4,
};

function sortCommands(commands: CatalogDownlinkCommand[]): CatalogDownlinkCommand[] {
  return [...commands].sort(
    (a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
  );
}

/**
 * Check if the catalog's commands use the extended schema.
 * If all commands have `key` and `fields`, we render interactive controls.
 * Otherwise, show a read-only fallback.
 */
function hasExtendedCommands(downlinkInfo: SensorCatalogDownlinkInfo): boolean {
  if (!downlinkInfo.commands || downlinkInfo.commands.length === 0) return false;
  return downlinkInfo.commands.every(isExtendedCommand);
}

/** Get extended commands (only returns commands that have the full schema) */
function getExtendedCommands(downlinkInfo: SensorCatalogDownlinkInfo): CatalogDownlinkCommand[] {
  return (downlinkInfo.commands ?? []).filter(isExtendedCommand) as CatalogDownlinkCommand[];
}

// ---------------------------------------------------------------------------
// Field Renderer Sub-Components
// ---------------------------------------------------------------------------

function NumberFieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CatalogDownlinkField;
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}) {
  const numVal = Number(value);
  const hasError =
    value !== "" &&
    (isNaN(numVal) ||
      (field.min != null && numVal < field.min) ||
      (field.max != null && numVal > field.max));

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">
        {field.label}
        {field.unit && (
          <span className="text-muted-foreground ml-1">({field.unit})</span>
        )}
      </Label>
      <Input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        placeholder={field.default != null ? String(field.default) : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(hasError && "border-red-400")}
      />
      {hasError && (
        <p className="text-[11px] text-red-500 mt-0.5">
          {isNaN(numVal)
            ? "Must be a number"
            : `Must be ${field.min ?? ""}–${field.max ?? ""}`}
        </p>
      )}
      {field.helperText && (
        <p className="text-[10px] text-muted-foreground">{field.helperText}</p>
      )}
    </div>
  );
}

function ToggleFieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CatalogDownlinkField;
  value: boolean;
  onChange: (val: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
      <div>
        <Label className="text-xs font-medium">{field.label}</Label>
        {field.helperText && (
          <p className="text-[10px] text-muted-foreground">{field.helperText}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          {value ? field.trueLabel || "On" : field.falseLabel || "Off"}
        </span>
        <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

function SelectFieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CatalogDownlinkField;
  value: string | number;
  onChange: (val: string | number) => void;
  disabled: boolean;
}) {
  const options = field.options ?? [];
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{field.label}</Label>
      <Select
        value={String(value)}
        onValueChange={(v) => {
          // Preserve original type: if first option value is a number, convert
          const numVal = Number(v);
          onChange(options.some((o) => typeof o.value === "number") && !isNaN(numVal) ? numVal : v);
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {field.helperText && (
        <p className="text-[10px] text-muted-foreground">{field.helperText}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command Renderer
// ---------------------------------------------------------------------------

function CommandControl({
  command,
  fieldValues,
  onFieldChange,
  onApply,
  isApplying,
  isDisabled,
}: {
  command: CatalogDownlinkCommand;
  fieldValues: Record<string, number | boolean | string>;
  onFieldChange: (fieldName: string, value: number | boolean | string) => void;
  onApply: (
    command: CatalogDownlinkCommand,
    fieldValues: Record<string, number | boolean | string>
  ) => void;
  isApplying: boolean;
  isDisabled: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visibleFields = command.fields.filter((f) => !f.hidden);
  const isAction = visibleFields.length === 0;
  const hasFields = visibleFields.length > 0;

  // Validate visible fields only
  const hasValidationError = visibleFields.some((field) => {
    if (field.type === "boolean" || field.type === "select") return false;
    const val = fieldValues[field.name];
    if (val === undefined || val === "") return true;
    const numVal = Number(val);
    if (isNaN(numVal)) return true;
    if (field.min != null && numVal < field.min) return true;
    if (field.max != null && numVal > field.max) return true;
    return false;
  });

  const handleApplyClick = () => {
    if (command.confirmation) {
      setConfirmOpen(true);
    } else {
      onApply(command, fieldValues);
    }
  };

  const handleConfirmedApply = () => {
    setConfirmOpen(false);
    onApply(command, fieldValues);
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs font-medium">{command.name}</Label>
        <p className="text-[10px] text-muted-foreground">
          {command.description}
        </p>
      </div>

      {hasFields &&
        visibleFields.map((field) => {
          if (field.type === "boolean") {
            return (
              <ToggleFieldControl
                key={field.name}
                field={field}
                value={Boolean(
                  fieldValues[field.name] ?? field.default ?? false
                )}
                onChange={(v) => onFieldChange(field.name, v)}
                disabled={isDisabled}
              />
            );
          }
          if (field.control === "select" && field.options) {
            return (
              <SelectFieldControl
                key={field.name}
                field={field}
                value={
                  (fieldValues[field.name] as string | number) ??
                  field.default ??
                  ""
                }
                onChange={(v) => onFieldChange(field.name, v)}
                disabled={isDisabled}
              />
            );
          }
          return (
            <NumberFieldControl
              key={field.name}
              field={field}
              value={String(fieldValues[field.name] ?? "")}
              onChange={(v) =>
                onFieldChange(field.name, v === "" ? "" : Number(v))
              }
              disabled={isDisabled}
            />
          );
        })}

      <Button
        variant={isAction ? "outline" : "default"}
        size="sm"
        disabled={isDisabled || hasValidationError}
        onClick={handleApplyClick}
        className={cn(
          "w-full",
          command.dangerous && "border-red-400 text-red-600 hover:bg-red-50"
        )}
      >
        {isApplying ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        ) : (
          <Send className="w-3.5 h-3.5 mr-1.5" />
        )}
        {isAction ? command.name : "Apply"}
      </Button>

      {/* Confirmation dialog for dangerous/confirmation-required actions */}
      {command.confirmation && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{command.name}</AlertDialogTitle>
              <AlertDialogDescription>
                {command.confirmation}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmedApply}
                className={
                  command.dangerous
                    ? "bg-red-600 hover:bg-red-700"
                    : undefined
                }
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
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

  // Fetch the catalog entry for this sensor
  const { data: catalogEntry, isLoading: catalogLoading } =
    useSensorCatalogById(open ? sensor.sensor_catalog_id : null);

  // --- Per-command loading tracking ---
  const [activeCommandKey, setActiveCommandKey] = useState<string | null>(null);

  useEffect(() => {
    if (!sendDownlink.isPending) {
      setActiveCommandKey(null);
    }
  }, [sendDownlink.isPending]);

  // --- Debounce guard ---
  const lastSendRef = useRef(0);
  const canSend = useCallback(() => {
    const now = Date.now();
    if (now - lastSendRef.current < 500) return false;
    lastSendRef.current = now;
    return true;
  }, []);

  // --- Auto-refresh when there are 'sent' changes ---
  const hasSentChanges = pendingChanges?.some((c) => c.status === "sent");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && hasSentChanges) {
      pollRef.current = setInterval(() => {
        refetchChanges();
      }, 15_000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, hasSentChanges, refetchChanges]);

  // --- Estimated confirmation time ---
  const estimatedMinutes = config?.uplink_interval_s
    ? Math.round(config.uplink_interval_s / 60)
    : null;

  // --- Field values state: keyed by commandKey ---
  const [fieldValues, setFieldValues] = useState<
    Record<string, Record<string, number | boolean | string>>
  >({});

  // Initialize field values from command defaults + sensor config when available
  useEffect(() => {
    if (!catalogEntry?.downlink_info) return;
    const info = catalogEntry.downlink_info;
    if (!hasExtendedCommands(info)) return;

    const commands = getExtendedCommands(info);
    const initial: Record<string, Record<string, number | boolean | string>> =
      {};
    for (const cmd of commands) {
      const cmdValues: Record<string, number | boolean | string> = {};
      for (const field of cmd.fields) {
        // Start with catalog default
        if (field.default !== undefined) {
          cmdValues[field.name] = field.default;
        }
        // Override with sensor config if configField is set and config has a value
        if (field.configField && config) {
          const configVal = (config as Record<string, unknown>)[field.configField];
          if (configVal != null) {
            let val: number | boolean | string = configVal as number | boolean | string;
            // For temp fields stored in °C, convert to display unit
            if (field.encoding === "temp_celsius_x100" && displayTempUnit === "fahrenheit") {
              val = Math.round(Number(val) * 9 / 5 + 32);
            }
            // Reverse inputTransform: config stores seconds, field expects minutes
            if (field.inputTransform === "minutes_to_seconds" && typeof val === "number") {
              val = Math.round(val / 60);
            }
            cmdValues[field.name] = val;
          }
        }
      }
      initial[cmd.key] = cmdValues;
    }

    setFieldValues(initial);
  }, [catalogEntry, config, displayTempUnit]);

  const updateFieldValue = useCallback(
    (commandKey: string, fieldName: string, value: number | boolean | string) => {
      setFieldValues((prev) => ({
        ...prev,
        [commandKey]: {
          ...(prev[commandKey] || {}),
          [fieldName]: value,
        },
      }));
    },
    []
  );

  // --- Disable conditions ---
  const isBusy = sendDownlink.isPending;
  const hasPendingSent = !!hasSentChanges;
  const isDisabled = isBusy || hasPendingSent;

  // --- Display temp unit (default to fahrenheit for US restaurants) ---
  const displayTempUnit: "fahrenheit" | "celsius" = "fahrenheit";

  // --- Advanced section toggle ---
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // --- Send a catalog command ---
  const sendCatalogCommand = useCallback(
    (
      command: CatalogDownlinkCommand,
      values: Record<string, number | boolean | string>
    ) => {
      if (!canSend() || !catalogEntry?.downlink_info?.config_port) return;

      const fport = catalogEntry.downlink_info.config_port;
      const hex = encodeDownlinkCommand(command, values, displayTempUnit);
      const expectedResult = buildExpectedResult(command, values);

      setActiveCommandKey(command.key);
      sendDownlink.mutate({
        sensorId: sensor.id,
        commandType: "catalog",
        commandParams: {
          type: "catalog",
          hex,
          fport,
          commandKey: command.key,
          commandName: command.name,
          expectedResult,
        },
      });
    },
    [sensor.id, catalogEntry, displayTempUnit, sendDownlink, canSend]
  );

  // --- Quick Preset handler ---
  const handlePreset = useCallback(
    (intervalMinutes: number) => {
      if (!catalogEntry?.downlink_info) return;
      const commands = getExtendedCommands(catalogEntry.downlink_info);
      const setTdc = commands.find((c) => c.key === "set_tdc");
      if (!setTdc) return;

      sendCatalogCommand(setTdc, { minutes: intervalMinutes });
    },
    [catalogEntry, sendCatalogCommand]
  );

  // Determine what to render
  const downlinkInfo = catalogEntry?.downlink_info;
  const supportsRemoteConfig = downlinkInfo?.supports_remote_config;
  const extendedCommands = downlinkInfo
    ? getExtendedCommands(downlinkInfo)
    : [];
  const isExtended = downlinkInfo ? hasExtendedCommands(downlinkInfo) : false;
  const hasSetTdc = extendedCommands.some((c) => c.key === "set_tdc");

  // Split commands: interval + alarm = main; mode + action + advanced = advanced
  const mainCommands = sortCommands(
    extendedCommands.filter(
      (c) => c.category === "interval" || c.category === "alarm"
    )
  );
  const advancedCommandsList = sortCommands(
    extendedCommands.filter(
      (c) =>
        c.category === "mode" ||
        c.category === "action" ||
        c.category === "advanced"
    )
  );

  const isLoadingData = configLoading || catalogLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Sensor Settings
          </SheetTitle>
          <SheetDescription>
            {sensor.name}
            {catalogEntry && (
              <span className="block text-[10px] mt-0.5">
                {catalogEntry.display_name}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Class A Timing Education */}
        <Alert className="mb-4 border-blue-200 bg-blue-50/50">
          <Info className="w-4 h-4 text-blue-500" />
          <AlertDescription className="text-xs text-blue-700">
            This sensor reports every{" "}
            <span className="font-semibold">
              {estimatedMinutes || "10"} minutes
            </span>
            . Any changes you make will apply on the next report.
          </AlertDescription>
        </Alert>

        {/* Pending sent warning */}
        {hasPendingSent && !isBusy && (
          <Alert className="mb-4 border-amber-200 bg-amber-50/50">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <AlertDescription className="text-xs text-amber-700">
              Waiting for sensor to confirm previous change. New changes are
              disabled until confirmed.
            </AlertDescription>
          </Alert>
        )}

        {/* Device Info (read-only) */}
        <div className="space-y-1 text-sm mb-6 p-3 rounded-lg bg-muted/40">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Device ID</span>
            <span className="font-mono text-xs">
              {sensor.ttn_device_id || sensor.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sensor ID</span>
            <span className="font-mono text-xs">{sensor.dev_eui}</span>
          </div>
          {sensor.last_seen_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last report</span>
              <span>
                {formatDistanceToNow(new Date(sensor.last_seen_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
          {config?.uplink_interval_s && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reports every</span>
              <span>{Math.round(config.uplink_interval_s / 60)} min</span>
            </div>
          )}
          {config?.last_applied_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Last setting confirmed
              </span>
              <span>
                {formatDistanceToNow(new Date(config.last_applied_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
        </div>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !catalogEntry || !supportsRemoteConfig ? (
          /* Sensor doesn't support remote config or no catalog entry */
          <div className="space-y-6">
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {!catalogEntry
                  ? "No sensor model linked. Assign a model in the Sensor Library to enable remote configuration."
                  : "This sensor model does not support remote configuration."}
              </p>
            </div>

            <Separator />

            {/* Still show Recent Changes even without catalog */}
            <RecentChanges
              pendingChanges={pendingChanges}
              changesLoading={changesLoading}
              hasSentChanges={!!hasSentChanges}
              refetchChanges={refetchChanges}
              estimatedMinutes={estimatedMinutes}
            />
          </div>
        ) : !isExtended ? (
          /* Catalog entry exists but hasn't been extended with UI metadata yet */
          <div className="space-y-6">
            <Alert className="border-muted">
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Full remote configuration coming soon for this model. Available
                commands are listed below.
              </AlertDescription>
            </Alert>
            {downlinkInfo?.commands?.map((cmd, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 text-sm">
                <p className="font-medium">{cmd.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cmd.description}
                </p>
              </div>
            ))}

            <Separator />

            <RecentChanges
              pendingChanges={pendingChanges}
              changesLoading={changesLoading}
              hasSentChanges={!!hasSentChanges}
              refetchChanges={refetchChanges}
              estimatedMinutes={estimatedMinutes}
            />
          </div>
        ) : (
          /* Full catalog-driven settings UI */
          <div className="space-y-6">
            {/* Quick Presets — only if sensor has set_tdc */}
            {hasSetTdc && (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Quick Presets
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {UPLINK_PRESETS.map((preset) => {
                      const presetMinutes = preset.interval_s / 60;
                      const loading =
                        isBusy && activeCommandKey === "set_tdc";
                      return (
                        <Button
                          key={preset.label}
                          variant="outline"
                          size="sm"
                          disabled={isDisabled}
                          onClick={() => handlePreset(presetMinutes)}
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
              </>
            )}

            {/* Main commands (interval + alarm) */}
            {mainCommands.length > 0 && (
              <div className="space-y-5">
                {mainCommands.map((command) => (
                  <CommandControl
                    key={command.key}
                    command={command}
                    fieldValues={fieldValues[command.key] || {}}
                    onFieldChange={(fieldName, value) =>
                      updateFieldValue(command.key, fieldName, value)
                    }
                    onApply={sendCatalogCommand}
                    isApplying={isBusy && activeCommandKey === command.key}
                    isDisabled={isDisabled}
                  />
                ))}
              </div>
            )}

            {/* Advanced Settings (mode + action + advanced) */}
            {advancedCommandsList.length > 0 && (
              <>
                <Separator />
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
                      {advancedCommandsList.map((command) => (
                        <CommandControl
                          key={command.key}
                          command={command}
                          fieldValues={fieldValues[command.key] || {}}
                          onFieldChange={(fieldName, value) =>
                            updateFieldValue(command.key, fieldName, value)
                          }
                          onApply={sendCatalogCommand}
                          isApplying={
                            isBusy && activeCommandKey === command.key
                          }
                          isDisabled={isDisabled}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Recent Changes */}
            <RecentChanges
              pendingChanges={pendingChanges}
              changesLoading={changesLoading}
              hasSentChanges={!!hasSentChanges}
              refetchChanges={refetchChanges}
              estimatedMinutes={estimatedMinutes}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Recent Changes sub-component
// ---------------------------------------------------------------------------

function RecentChanges({
  pendingChanges,
  changesLoading,
  hasSentChanges,
  refetchChanges,
  estimatedMinutes,
}: {
  pendingChanges: SensorPendingChange[] | undefined;
  changesLoading: boolean;
  hasSentChanges: boolean;
  refetchChanges: () => void;
  estimatedMinutes: number | null;
}) {
  return (
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
              <div className="mt-0.5">{statusIcon(change.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {changeDisplayLabel(change)}
                  </span>
                  <Badge
                    className={cn(
                      "text-[10px] border-0 px-1.5 py-0",
                      statusBadgeClass(change.status)
                    )}
                  >
                    {change.status === "sent"
                      ? "\u23F3"
                      : change.status === "applied"
                        ? "\u2705"
                        : change.status === "failed"
                          ? "\u274C"
                          : change.status}
                  </Badge>
                </div>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(change.requested_at), {
                    addSuffix: true,
                  })}
                </span>
                {change.requested_by_email && (
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {change.requested_by_email}
                  </p>
                )}
                {change.status === "sent" && (
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Waiting for next report
                    {estimatedMinutes && (
                      <span> (~{estimatedMinutes} min)</span>
                    )}
                  </p>
                )}
                {change.status === "applied" && change.applied_at && (
                  <p className="text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Applied{" "}
                    {formatDistanceToNow(new Date(change.applied_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
                {change.status === "timeout" && (
                  <p className="text-amber-600 mt-0.5 flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    Timed out
                  </p>
                )}
                {change.status === "failed" && (
                  <p className="text-red-600 mt-0.5 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Failed — try again
                    {change.failed_at && (
                      <span>
                        {" "}
                        {formatDistanceToNow(new Date(change.failed_at), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
