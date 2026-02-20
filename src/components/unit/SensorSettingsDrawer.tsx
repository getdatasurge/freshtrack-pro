/**
 * SensorSettingsDrawer — Catalog-Driven
 *
 * Generic renderer that builds its UI entirely from the sensor_catalog
 * `downlink_info.commands` definition. No hardcoded sensor-type layouts.
 *
 * Design decisions:
 *  - Every control, label, validation rule, and encoding comes from the catalog.
 *  - Quick Presets are shown only if the sensor has a `set_tdc` command.
 *  - Action buttons with `confirmation` show a dialog before sending.
 *  - Temperature fields convert from display unit using the encoder.
 *  - Hidden commands (e.g. set_confirmed_uplinks) are filtered from the UI.
 *  - Settings fields use a single "Apply All Changes" button (no per-field Apply).
 *  - Action buttons (Reset, Request Status) remain immediate one-shot actions.
 *  - Interval display shows the confirmed value, not pending.
 *  - Fallback catalog lookup by model name when sensor_catalog_id is null.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { useSensorCatalogById, useSensorCatalogByModel } from "@/hooks/useSensorCatalog";
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
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SensorSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sensor: LoraSensor;
  /** Unit alarm defaults (from unit settings) — used to pre-fill alarm fields */
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

/** Get visible extended commands (filter out hidden ones like set_confirmed_uplinks) */
function getVisibleCommands(downlinkInfo: SensorCatalogDownlinkInfo): CatalogDownlinkCommand[] {
  return getExtendedCommands(downlinkInfo).filter((cmd) => !cmd.hidden);
}

// ---------------------------------------------------------------------------
// Field Renderer Sub-Components
// ---------------------------------------------------------------------------

function NumberFieldControl({
  field,
  value,
  onChange,
  disabled,
  isDirty,
}: {
  field: CatalogDownlinkField;
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
  isDirty?: boolean;
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
        {isDirty && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
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
        className={cn(
          hasError && "border-red-400",
          isDirty && !hasError && "border-blue-400/50",
        )}
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
  isDirty,
}: {
  field: CatalogDownlinkField;
  value: boolean;
  onChange: (val: boolean) => void;
  disabled: boolean;
  isDirty?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded bg-muted/30",
      isDirty && "ring-1 ring-blue-400/50",
    )}>
      <div>
        <Label className="text-xs font-medium">
          {field.label}
          {isDirty && (
            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </Label>
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

// ---------------------------------------------------------------------------
// Setting Command Renderer (no per-command Apply button)
// ---------------------------------------------------------------------------

function SettingCommandControl({
  command,
  fieldValues,
  onFieldChange,
  isDisabled,
  dirtyFields,
}: {
  command: CatalogDownlinkCommand;
  fieldValues: Record<string, number | boolean | string>;
  onFieldChange: (fieldName: string, value: number | boolean | string) => void;
  isDisabled: boolean;
  dirtyFields: Set<string>;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs font-medium">{command.name}</Label>
        <p className="text-[10px] text-muted-foreground">
          {command.description}
        </p>
      </div>

      {command.fields.map((field) => {
        const fieldKey = `${command.key}.${field.name}`;
        const isDirty = dirtyFields.has(fieldKey);

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
              isDirty={isDirty}
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
            isDirty={isDirty}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Command Renderer (keeps its own immediate button)
// ---------------------------------------------------------------------------

function ActionCommandControl({
  command,
  onApply,
  isApplying,
  isDisabled,
}: {
  command: CatalogDownlinkCommand;
  onApply: (
    command: CatalogDownlinkCommand,
    fieldValues: Record<string, number | boolean | string>
  ) => void;
  isApplying: boolean;
  isDisabled: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClick = () => {
    if (command.confirmation) {
      setConfirmOpen(true);
    } else {
      onApply(command, {});
    }
  };

  const handleConfirmedApply = () => {
    setConfirmOpen(false);
    onApply(command, {});
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs font-medium">{command.name}</Label>
        <p className="text-[10px] text-muted-foreground">
          {command.description}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={handleClick}
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
        {command.name}
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

  // --- Catalog lookup: primary by ID, fallback by model name ---
  const { data: catalogByIdEntry, isLoading: catalogByIdLoading } =
    useSensorCatalogById(open ? sensor.sensor_catalog_id : null);
  const { data: catalogByModelEntry, isLoading: catalogByModelLoading } =
    useSensorCatalogByModel(
      open && !sensor.sensor_catalog_id ? sensor.model : null
    );
  const catalogEntry = catalogByIdEntry ?? catalogByModelEntry;
  const catalogLoading = catalogByIdLoading || catalogByModelLoading;

  // --- Per-command loading tracking (for action commands) ---
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

  // --- Confirmed interval (Issue 5) ---
  // Use confirmed_uplink_interval_s (last sensor-acknowledged value).
  // Fall back to uplink_interval_s, then catalog default.
  const confirmedIntervalMinutes = config?.confirmed_uplink_interval_s
    ? Math.round(config.confirmed_uplink_interval_s / 60)
    : config?.uplink_interval_s
      ? Math.round(config.uplink_interval_s / 60)
      : catalogEntry?.uplink_info?.default_interval_s
        ? Math.round(catalogEntry.uplink_info.default_interval_s / 60)
        : null;

  // Check for pending interval change
  const pendingIntervalChange = pendingChanges?.find(
    (c) =>
      (c.status === "sent" || c.status === "queued") &&
      (c.change_type === "catalog" || c.change_type === "uplink_interval") &&
      ((c.command_params as Record<string, unknown>)?.commandKey === "set_tdc" ||
        c.change_type === "uplink_interval")
  );

  // --- Field values state: keyed by commandKey ---
  const [fieldValues, setFieldValues] = useState<
    Record<string, Record<string, number | boolean | string>>
  >({});

  // Track initial values for dirty detection
  const [initialFieldValues, setInitialFieldValues] = useState<
    Record<string, Record<string, number | boolean | string>>
  >({});

  // Initialize field values from command defaults when catalog loads
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
        if (field.default !== undefined) {
          cmdValues[field.name] = field.default;
        }
      }
      initial[cmd.key] = cmdValues;
    }

    // Pre-fill set_tdc from confirmed config (Issue 5: show confirmed, not pending)
    const confirmedInterval = config?.confirmed_uplink_interval_s ?? config?.uplink_interval_s;
    if (confirmedInterval && initial["set_tdc"]) {
      initial["set_tdc"]["minutes"] = Math.round(confirmedInterval / 60);
    }

    // Pre-fill alarm temps from unit defaults (canonical storage is °F,
    // matching the drawer's displayTempUnit)
    if (unitAlarmHigh !== null && initial["set_temp_alarm_high"]) {
      initial["set_temp_alarm_high"]["temperature"] = unitAlarmHigh;
    }
    if (unitAlarmLow !== null && initial["set_temp_alarm_low"]) {
      initial["set_temp_alarm_low"]["temperature"] = unitAlarmLow;
    }

    setFieldValues(initial);
    setInitialFieldValues(initial);
  }, [catalogEntry, config, unitAlarmLow, unitAlarmHigh]);

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

  // --- Dirty state tracking ---
  const dirtyCommandKeys = useMemo(() => {
    const dirty = new Set<string>();
    for (const [cmdKey, values] of Object.entries(fieldValues)) {
      const initValues = initialFieldValues[cmdKey];
      if (!initValues) continue;
      for (const [fieldName, fieldValue] of Object.entries(values)) {
        const initVal = initValues[fieldName];
        // Compare stringified values to handle type coercion (number vs string)
        if (String(fieldValue) !== String(initVal ?? "")) {
          dirty.add(cmdKey);
          break;
        }
      }
    }
    return dirty;
  }, [fieldValues, initialFieldValues]);

  // Per-field dirty tracking for visual indicators
  const dirtyFieldKeys = useMemo(() => {
    const dirty = new Set<string>();
    for (const [cmdKey, values] of Object.entries(fieldValues)) {
      const initValues = initialFieldValues[cmdKey];
      if (!initValues) continue;
      for (const [fieldName, fieldValue] of Object.entries(values)) {
        const initVal = initValues[fieldName];
        if (String(fieldValue) !== String(initVal ?? "")) {
          dirty.add(`${cmdKey}.${fieldName}`);
        }
      }
    }
    return dirty;
  }, [fieldValues, initialFieldValues]);

  // Only count setting commands (not action commands) as dirty
  const visibleCommands = catalogEntry?.downlink_info
    ? getVisibleCommands(catalogEntry.downlink_info)
    : [];
  const settingCommandKeys = new Set(
    visibleCommands.filter((c) => c.fields.length > 0).map((c) => c.key)
  );
  const dirtySettingCount = [...dirtyCommandKeys].filter((k) =>
    settingCommandKeys.has(k)
  ).length;

  // --- Disable conditions ---
  const isBusy = sendDownlink.isPending;
  const hasPendingSent = !!hasSentChanges;
  const isDisabled = isBusy || hasPendingSent;

  // --- Display temp unit (default to fahrenheit for US restaurants) ---
  const displayTempUnit: "fahrenheit" | "celsius" = "fahrenheit";

  // --- Advanced section toggle ---
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // --- Send a catalog command (used for action commands and Apply All) ---
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
          fieldValues: values,
        },
      });
    },
    [sensor.id, catalogEntry, displayTempUnit, sendDownlink, canSend]
  );

  // --- Apply All Changes handler ---
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const handleApplyAll = useCallback(async () => {
    if (!catalogEntry?.downlink_info?.config_port) return;
    if (dirtySettingCount === 0) return;

    const allCommands = getExtendedCommands(catalogEntry.downlink_info);
    const fport = catalogEntry.downlink_info.config_port;
    const summaryParts: string[] = [];

    setIsApplyingAll(true);
    let successCount = 0;

    for (const cmdKey of dirtyCommandKeys) {
      if (!settingCommandKeys.has(cmdKey)) continue;
      const command = allCommands.find((c) => c.key === cmdKey);
      if (!command) continue;

      const values = fieldValues[cmdKey] || {};
      const hex = encodeDownlinkCommand(command, values, displayTempUnit);
      const expectedResult = buildExpectedResult(command, values);

      try {
        await sendDownlink.mutateAsync({
          sensorId: sensor.id,
          commandType: "catalog",
          commandParams: {
            type: "catalog",
            hex,
            fport,
            commandKey: command.key,
            commandName: command.name,
            expectedResult,
            fieldValues: values,
          },
        });
        summaryParts.push(expectedResult);
        successCount++;
      } catch {
        // Individual error already toasted by useSendDownlink
      }
    }

    setIsApplyingAll(false);

    if (successCount > 0) {
      // Update initial values so these fields are no longer dirty
      setInitialFieldValues({ ...fieldValues });
      refetchChanges();
      toast.success(
        `Queued ${successCount} change${successCount > 1 ? "s" : ""}: ${summaryParts.join(", ")}`
      );
    }
  }, [
    catalogEntry,
    dirtyCommandKeys,
    dirtySettingCount,
    settingCommandKeys,
    fieldValues,
    displayTempUnit,
    sendDownlink,
    sensor.id,
    refetchChanges,
  ]);

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

  // --- Validate all dirty setting fields ---
  const hasValidationError = useMemo(() => {
    if (!catalogEntry?.downlink_info) return false;
    const allCommands = getExtendedCommands(catalogEntry.downlink_info);
    for (const cmdKey of dirtyCommandKeys) {
      if (!settingCommandKeys.has(cmdKey)) continue;
      const command = allCommands.find((c) => c.key === cmdKey);
      if (!command) continue;
      const values = fieldValues[cmdKey] || {};
      for (const field of command.fields) {
        if (field.type === "boolean") continue;
        const val = values[field.name];
        if (val === undefined || val === "") return true;
        const numVal = Number(val);
        if (isNaN(numVal)) return true;
        if (field.min != null && numVal < field.min) return true;
        if (field.max != null && numVal > field.max) return true;
      }
    }
    return false;
  }, [catalogEntry, dirtyCommandKeys, settingCommandKeys, fieldValues]);

  // Determine what to render
  const downlinkInfo = catalogEntry?.downlink_info;
  const supportsRemoteConfig = downlinkInfo?.supports_remote_config;
  const extendedCommands = downlinkInfo
    ? getVisibleCommands(downlinkInfo)
    : [];
  const isExtended = downlinkInfo ? hasExtendedCommands(downlinkInfo) : false;
  const hasSetTdc = extendedCommands.some((c) => c.key === "set_tdc");

  // Split commands: settings (have fields) vs actions (no fields)
  const settingCommands = sortCommands(
    extendedCommands.filter((c) => c.fields.length > 0)
  );
  const actionCommands = sortCommands(
    extendedCommands.filter((c) => c.fields.length === 0)
  );

  // Split settings: main (interval + alarm) vs advanced (mode + advanced)
  const mainSettingCommands = settingCommands.filter(
    (c) => c.category === "interval" || c.category === "alarm"
  );
  const advancedSettingCommands = settingCommands.filter(
    (c) => c.category === "mode" || c.category === "advanced"
  );
  const advancedCommandsList = [...advancedSettingCommands, ...actionCommands.filter(
    (c) => c.category !== "action" || c.category === "action"
  )];

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
            {confirmedIntervalMinutes ? (
              <>
                This sensor reports every{" "}
                <span className="font-semibold">
                  {confirmedIntervalMinutes} minutes
                </span>
                . Any changes you make will apply on the next report.
              </>
            ) : (
              <>Changes are sent as Class A downlinks and apply on the next uplink.</>
            )}
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
          {confirmedIntervalMinutes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reports every</span>
              <div className="text-right">
                <span>{confirmedIntervalMinutes} min</span>
                {pendingIntervalChange && (
                  <p className="text-[10px] text-amber-600">
                    Pending change queued{" "}
                    {formatDistanceToNow(new Date(pendingIntervalChange.requested_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
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
              estimatedMinutes={confirmedIntervalMinutes}
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
              estimatedMinutes={confirmedIntervalMinutes}
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

            {/* Main settings (interval + alarm) — no per-field Apply buttons */}
            {mainSettingCommands.length > 0 && (
              <div className="space-y-5">
                {mainSettingCommands.map((command) => (
                  <SettingCommandControl
                    key={command.key}
                    command={command}
                    fieldValues={fieldValues[command.key] || {}}
                    onFieldChange={(fieldName, value) =>
                      updateFieldValue(command.key, fieldName, value)
                    }
                    isDisabled={isDisabled}
                    dirtyFields={dirtyFieldKeys}
                  />
                ))}
              </div>
            )}

            {/* Advanced Settings (mode, advanced settings + action commands) */}
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
                      {advancedSettingCommands.map((command) => (
                        <SettingCommandControl
                          key={command.key}
                          command={command}
                          fieldValues={fieldValues[command.key] || {}}
                          onFieldChange={(fieldName, value) =>
                            updateFieldValue(command.key, fieldName, value)
                          }
                          isDisabled={isDisabled}
                          dirtyFields={dirtyFieldKeys}
                        />
                      ))}
                      {actionCommands.map((command) => (
                        <ActionCommandControl
                          key={command.key}
                          command={command}
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

            {/* Apply All Changes button — only visible when fields are dirty */}
            {dirtySettingCount > 0 && (
              <div className="sticky bottom-0 bg-background pt-3 pb-1 border-t">
                <Button
                  className="w-full"
                  size="sm"
                  disabled={isDisabled || hasValidationError || isApplyingAll}
                  onClick={handleApplyAll}
                >
                  {isApplyingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Apply All Changes ({dirtySettingCount})
                </Button>
                {hasValidationError && (
                  <p className="text-[10px] text-red-500 text-center mt-1">
                    Fix validation errors before applying
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Recent Changes */}
            <RecentChanges
              pendingChanges={pendingChanges}
              changesLoading={changesLoading}
              hasSentChanges={!!hasSentChanges}
              refetchChanges={refetchChanges}
              estimatedMinutes={confirmedIntervalMinutes}
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
                      ? "\u23F3 Pending"
                      : change.status === "applied"
                        ? "\u2705"
                        : change.status === "failed"
                          ? "\u274C"
                          : change.status === "queued"
                            ? "\u23F3 Queued"
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
                    Waiting for confirmation
                    {estimatedMinutes && (
                      <span> (~{estimatedMinutes} min)</span>
                    )}
                  </p>
                )}
                {change.status === "queued" && (
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    Waiting for next report
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
