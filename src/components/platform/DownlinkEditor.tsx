/**
 * DownlinkEditor — Editable downlink configuration for the Sensor Library
 *
 * Allows super-admins to configure:
 * - supports_remote_config toggle
 * - config_port (fPort for downlinks)
 * - native_temp_unit and native_temp_resolution
 * - Full command list with CRUD (key, name, hex_template, category, fields, etc.)
 * - Per-command field definitions (encoding, control, validation, transforms)
 *
 * Follows the same pattern as BatterySpecifications: self-contained editor
 * with its own edit/save/cancel lifecycle tied to parentEditing.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import type {
  SensorCatalogDownlinkInfo,
  CatalogDownlinkCommand,
  CatalogDownlinkField,
  DownlinkCommandCategory,
  DownlinkFieldType,
  DownlinkFieldControl,
  DownlinkFieldEncoding,
  DownlinkFieldInputTransform,
} from "@/types/sensorCatalog";
import { isExtendedCommand } from "@/types/sensorCatalog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: { value: DownlinkCommandCategory; label: string }[] = [
  { value: "interval", label: "Interval" },
  { value: "alarm", label: "Alarm" },
  { value: "mode", label: "Mode" },
  { value: "action", label: "Action" },
  { value: "advanced", label: "Advanced" },
];

const ENCODINGS: { value: DownlinkFieldEncoding; label: string; bytes: string }[] = [
  { value: "u8", label: "u8", bytes: "1 byte" },
  { value: "u16be", label: "u16be", bytes: "2 bytes" },
  { value: "u24be", label: "u24be", bytes: "3 bytes" },
  { value: "u32be", label: "u32be", bytes: "4 bytes" },
  { value: "bool01", label: "bool01", bytes: "1 byte" },
  { value: "invertBool01", label: "invertBool01", bytes: "1 byte" },
  { value: "temp_celsius_x100", label: "temp_celsius_x100", bytes: "2 bytes signed" },
];

const FIELD_TYPES: { value: DownlinkFieldType; label: string }[] = [
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "select", label: "Select" },
];

const CONTROLS: { value: DownlinkFieldControl; label: string }[] = [
  { value: "number", label: "Number Input" },
  { value: "toggle", label: "Toggle Switch" },
  { value: "select", label: "Dropdown" },
  { value: "slider", label: "Slider" },
];

// INPUT_TRANSFORMS are listed inline in the Select component

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmptyCommand(): CatalogDownlinkCommand {
  return {
    key: "",
    name: "",
    description: "",
    hex_template: "",
    category: "action",
    fields: [],
  };
}

function makeEmptyField(): CatalogDownlinkField {
  return {
    name: "",
    label: "",
    type: "integer",
    control: "number",
    encoding: "u8",
  };
}

function cloneDownlinkInfo(info: SensorCatalogDownlinkInfo): SensorCatalogDownlinkInfo {
  return JSON.parse(JSON.stringify(info));
}

const CATEGORY_COLORS: Record<DownlinkCommandCategory, string> = {
  interval: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  alarm: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  mode: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  action: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  advanced: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
};

// ---------------------------------------------------------------------------
// Field Editor Row
// ---------------------------------------------------------------------------

function FieldEditorRow({
  field,
  onChange,
  onRemove,
}: {
  field: CatalogDownlinkField;
  onChange: (updated: CatalogDownlinkField) => void;
  onRemove: () => void;
}) {
  const update = (patch: Partial<CatalogDownlinkField>) => onChange({ ...field, ...patch });

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      {/* Row 1: name, label, type, encoding */}
      <div className="grid grid-cols-5 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Key</Label>
          <Input
            value={field.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="minutes"
            className="h-7 text-xs font-mono"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Label</Label>
          <Input
            value={field.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="Minutes"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Type</Label>
          <Select value={field.type} onValueChange={(v) => update({ type: v as DownlinkFieldType })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Encoding</Label>
          <Select value={field.encoding} onValueChange={(v) => update({ encoding: v as DownlinkFieldEncoding })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENCODINGS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label} <span className="text-muted-foreground ml-1">({e.bytes})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Control</Label>
          <Select value={field.control} onValueChange={(v) => update({ control: v as DownlinkFieldControl })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTROLS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: unit, min, max, default, step, inputTransform */}
      <div className="grid grid-cols-7 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Unit</Label>
          <Input
            value={field.unit ?? ""}
            onChange={(e) => update({ unit: e.target.value || undefined })}
            placeholder="min"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Min</Label>
          <Input
            type="number"
            value={field.min ?? ""}
            onChange={(e) => update({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Max</Label>
          <Input
            type="number"
            value={field.max ?? ""}
            onChange={(e) => update({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Default</Label>
          <Input
            value={field.default === undefined ? "" : String(field.default)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") { update({ default: undefined }); return; }
              if (v === "true") { update({ default: true }); return; }
              if (v === "false") { update({ default: false }); return; }
              const n = Number(v);
              update({ default: isNaN(n) ? v : n });
            }}
            placeholder="10"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Step</Label>
          <Input
            type="number"
            value={field.step ?? ""}
            onChange={(e) => update({ step: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Transform</Label>
          <Select
            value={field.inputTransform ?? "none"}
            onValueChange={(v) => update({ inputTransform: (v === "none" ? undefined : v) as DownlinkFieldInputTransform | undefined })}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="minutes_to_seconds">minutes_to_seconds</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Row 3: boolean labels + helper text (conditional) */}
      {field.type === "boolean" && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">True Label</Label>
            <Input
              value={field.trueLabel ?? ""}
              onChange={(e) => update({ trueLabel: e.target.value || undefined })}
              placeholder="Enabled"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">False Label</Label>
            <Input
              value={field.falseLabel ?? ""}
              onChange={(e) => update({ falseLabel: e.target.value || undefined })}
              placeholder="Disabled"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">Helper Text</Label>
            <Input
              value={field.helperText ?? ""}
              onChange={(e) => update({ helperText: e.target.value || undefined })}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
      {field.type !== "boolean" && field.helperText !== undefined && (
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase">Helper Text</Label>
          <Input
            value={field.helperText ?? ""}
            onChange={(e) => update({ helperText: e.target.value || undefined })}
            className="h-7 text-xs"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command Editor Card
// ---------------------------------------------------------------------------

function CommandEditorCard({
  command,
  index,
  onChange,
  onRemove,
  onDuplicate,
}: {
  command: CatalogDownlinkCommand;
  index: number;
  onChange: (updated: CatalogDownlinkCommand) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const update = (patch: Partial<CatalogDownlinkCommand>) => onChange({ ...command, ...patch });

  const updateField = useCallback(
    (fieldIndex: number, updated: CatalogDownlinkField) => {
      const newFields = [...command.fields];
      newFields[fieldIndex] = updated;
      onChange({ ...command, fields: newFields });
    },
    [command, onChange]
  );

  const removeField = useCallback(
    (fieldIndex: number) => {
      const newFields = command.fields.filter((_, i) => i !== fieldIndex);
      onChange({ ...command, fields: newFields });
    },
    [command, onChange]
  );

  const addField = useCallback(() => {
    onChange({ ...command, fields: [...command.fields, makeEmptyField()] });
  }, [command, onChange]);

  const categoryColor = CATEGORY_COLORS[command.category] || CATEGORY_COLORS.action;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-lg overflow-hidden">
        {/* Collapsed header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <Badge className={`text-[10px] ${categoryColor}`}>{command.category}</Badge>
            <span className="font-mono text-xs text-muted-foreground">{command.key || "(no key)"}</span>
            <span className="text-sm font-medium flex-1">{command.name || "(unnamed)"}</span>
            <code className="text-xs text-amber-600 font-mono">{command.hex_template}</code>
            {command.hidden && <Badge variant="outline" className="text-[10px]"><EyeOff className="w-3 h-3 mr-0.5" /> Hidden</Badge>}
            {command.dangerous && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" /> Dangerous</Badge>}
            <span className="text-xs text-muted-foreground">{command.fields.length} field{command.fields.length !== 1 ? "s" : ""}</span>
          </div>
        </CollapsibleTrigger>

        {/* Expanded editor */}
        <CollapsibleContent>
          <div className="border-t p-4 space-y-4 bg-muted/20">
            {/* Command properties */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Command Key</Label>
                <Input
                  value={command.key}
                  onChange={(e) => update({ key: e.target.value })}
                  placeholder="set_tdc"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Name</Label>
                <Input
                  value={command.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="How often this sensor reports"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Hex Template</Label>
                <Input
                  value={command.hex_template}
                  onChange={(e) => update({ hex_template: e.target.value })}
                  placeholder="01{seconds_3byte_hex}"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Category</Label>
                <Select value={command.category} onValueChange={(v) => update({ category: v as DownlinkCommandCategory })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">Description</Label>
              <Input
                value={command.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="The sensor sends a reading at this interval."
                className="h-8 text-xs"
              />
            </div>

            {/* Flags */}
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Switch
                  checked={command.hidden ?? false}
                  onCheckedChange={(v) => update({ hidden: v || undefined })}
                  className="scale-75"
                />
                <span>Hidden <span className="text-muted-foreground">(auto-provisioning only)</span></span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Switch
                  checked={command.dangerous ?? false}
                  onCheckedChange={(v) => update({ dangerous: v || undefined })}
                  className="scale-75"
                />
                <span className="text-red-600">Dangerous</span>
              </label>
              <div className="flex-1">
                <Input
                  value={command.confirmation ?? ""}
                  onChange={(e) => update({ confirmation: e.target.value || undefined })}
                  placeholder="Confirmation message (optional)"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Fields ({command.fields.length})</Label>
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addField}>
                  <Plus className="w-3 h-3 mr-1" /> Add Field
                </Button>
              </div>
              {command.fields.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-2">
                  No fields — this command sends a fixed payload ({command.hex_template}).
                </p>
              )}
              {command.fields.map((field, fi) => (
                <FieldEditorRow
                  key={fi}
                  field={field}
                  onChange={(updated) => updateField(fi, updated)}
                  onRemove={() => removeField(fi)}
                />
              ))}
            </div>

            {/* Command actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDuplicate}>
                <Copy className="w-3 h-3 mr-1" /> Duplicate
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onRemove}>
                <Trash2 className="w-3 h-3 mr-1" /> Remove Command
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Read-only display (non-editing mode)
// ---------------------------------------------------------------------------

function DownlinkReadOnly({ info }: { info: SensorCatalogDownlinkInfo }) {
  if (!info.supports_remote_config) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Settings className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>This sensor does not support remote configuration via downlinks.</p>
      </div>
    );
  }

  const commands = (info.commands ?? []).filter(isExtendedCommand) as CatalogDownlinkCommand[];
  const legacyCommands = (info.commands ?? []).filter((c) => !isExtendedCommand(c));

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Remote Config Supported
        </Badge>
        {info.config_port != null && (
          <Badge variant="outline">fPort: {info.config_port}</Badge>
        )}
        {info.native_temp_unit && (
          <Badge variant="outline">Temp: {info.native_temp_unit}</Badge>
        )}
        {info.native_temp_resolution != null && (
          <Badge variant="outline">Resolution: {info.native_temp_resolution}</Badge>
        )}
      </div>

      {/* Extended commands */}
      {commands.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Category</TableHead>
                  <TableHead className="w-[120px]">Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[160px]">Hex Template</TableHead>
                  <TableHead className="w-[60px]">Fields</TableHead>
                  <TableHead className="w-[80px]">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge className={`text-[10px] ${CATEGORY_COLORS[c.category] || ""}`}>
                        {c.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.key}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-amber-600">{c.hex_template}</TableCell>
                    <TableCell className="text-xs text-center">{c.fields.length}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.hidden && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                        {c.dangerous && <Badge variant="destructive" className="text-[10px]">Danger</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Legacy commands (if any) */}
      {legacyCommands.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-xs text-muted-foreground">Legacy Commands (read-only reference)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Hex Template</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {legacyCommands.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-semibold">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs text-amber-600">{c.hex_template}</TableCell>
                    <TableCell className="text-muted-foreground">{c.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No commands at all */}
      {commands.length === 0 && legacyCommands.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          Remote config is supported but no commands are defined yet.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DownlinkEditor
// ---------------------------------------------------------------------------

interface DownlinkEditorProps {
  downlinkInfo: SensorCatalogDownlinkInfo;
  sensorId: string;
  parentEditing: boolean;
  onSave: (updated: SensorCatalogDownlinkInfo) => void;
  isSaving: boolean;
}

export default function DownlinkEditor({
  downlinkInfo,
  parentEditing,
  onSave,
  isSaving,
}: DownlinkEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SensorCatalogDownlinkInfo>(() => cloneDownlinkInfo(downlinkInfo));

  // Sync draft when parent data changes (e.g. after save)
  useEffect(() => {
    if (!editing) {
      setDraft(cloneDownlinkInfo(downlinkInfo));
    }
  }, [downlinkInfo, editing]);

  // Auto-enter edit mode when parent triggers Edit
  useEffect(() => {
    if (parentEditing && !editing) {
      setEditing(true);
      setDraft(cloneDownlinkInfo(downlinkInfo));
    }
    if (!parentEditing && editing) {
      setEditing(false);
      setDraft(cloneDownlinkInfo(downlinkInfo));
    }
  }, [parentEditing]);

  const handleSave = () => {
    // Clean up: remove empty commands and fields with no name
    const cleaned = cloneDownlinkInfo(draft);
    if (cleaned.commands) {
      cleaned.commands = cleaned.commands.filter((c) => {
        if (!isExtendedCommand(c)) return true;
        return c.key && c.name;
      });
      for (const cmd of cleaned.commands) {
        if (isExtendedCommand(cmd)) {
          cmd.fields = cmd.fields.filter((f) => f.name && f.encoding);
        }
      }
    }
    onSave(cleaned);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(cloneDownlinkInfo(downlinkInfo));
    setEditing(false);
  };

  // Command CRUD
  const extendedCommands = ((draft.commands ?? []).filter(isExtendedCommand)) as CatalogDownlinkCommand[];

  const updateCommand = useCallback(
    (index: number, updated: CatalogDownlinkCommand) => {
      setDraft((prev) => {
        const next = cloneDownlinkInfo(prev);
        const cmds = (next.commands ?? []).filter(isExtendedCommand) as CatalogDownlinkCommand[];
        cmds[index] = updated;
        next.commands = cmds;
        return next;
      });
    },
    []
  );

  const removeCommand = useCallback(
    (index: number) => {
      setDraft((prev) => {
        const next = cloneDownlinkInfo(prev);
        const cmds = (next.commands ?? []).filter(isExtendedCommand) as CatalogDownlinkCommand[];
        cmds.splice(index, 1);
        next.commands = cmds;
        return next;
      });
    },
    []
  );

  const duplicateCommand = useCallback(
    (index: number) => {
      setDraft((prev) => {
        const next = cloneDownlinkInfo(prev);
        const cmds = (next.commands ?? []).filter(isExtendedCommand) as CatalogDownlinkCommand[];
        const copy = JSON.parse(JSON.stringify(cmds[index])) as CatalogDownlinkCommand;
        copy.key = copy.key + "_copy";
        copy.name = copy.name + " (copy)";
        cmds.splice(index + 1, 0, copy);
        next.commands = cmds;
        return next;
      });
    },
    []
  );

  const addCommand = useCallback(() => {
    setDraft((prev) => {
      const next = cloneDownlinkInfo(prev);
      if (!next.commands) next.commands = [];
      (next.commands as CatalogDownlinkCommand[]).push(makeEmptyCommand());
      return next;
    });
  }, []);

  // Non-editing mode
  if (!editing) {
    return <DownlinkReadOnly info={downlinkInfo} />;
  }

  // Editing mode
  return (
    <div className="space-y-4">
      {/* Config section */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-6 items-center flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={draft.supports_remote_config ?? false}
                onCheckedChange={(v) => setDraft({ ...draft, supports_remote_config: v })}
              />
              <span className="font-medium">Supports Remote Config</span>
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Config fPort</Label>
              <Input
                type="number"
                value={draft.config_port ?? ""}
                onChange={(e) => setDraft({ ...draft, config_port: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="h-8 w-20 text-xs"
                placeholder="2"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Native Temp Unit</Label>
              <Select
                value={draft.native_temp_unit ?? "none"}
                onValueChange={(v) => setDraft({ ...draft, native_temp_unit: (v === "none" ? undefined : v) as "celsius" | "fahrenheit" | undefined })}
              >
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="celsius">Celsius</SelectItem>
                  <SelectItem value="fahrenheit">Fahrenheit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Temp Resolution</Label>
              <Input
                type="number"
                step="0.01"
                value={draft.native_temp_resolution ?? ""}
                onChange={(e) => setDraft({ ...draft, native_temp_resolution: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="h-8 w-20 text-xs"
                placeholder="0.01"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commands */}
      {draft.supports_remote_config && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4" />
              Commands ({extendedCommands.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addCommand}>
              <Plus className="w-4 h-4 mr-1" /> Add Command
            </Button>
          </div>

          {extendedCommands.map((cmd, i) => (
            <CommandEditorCard
              key={`${cmd.key}-${i}`}
              command={cmd}
              index={i}
              onChange={(updated) => updateCommand(i, updated)}
              onRemove={() => removeCommand(i)}
              onDuplicate={() => duplicateCommand(i)}
            />
          ))}

          {extendedCommands.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <ArrowDownToLine className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No commands defined yet.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={addCommand}>
                <Plus className="w-4 h-4 mr-1" /> Add First Command
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Save/Cancel bar */}
      {!parentEditing && (
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-1" /> Save Downlink Config
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
