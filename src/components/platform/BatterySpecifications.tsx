import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Battery, Pencil, Save, X, AlertTriangle, Zap, Info } from "lucide-react";
import type { SensorCatalogBatteryInfo, BatteryChemistry } from "@/types/sensorCatalog";

// ─── Chemistry presets ──────────────────────────────────────
interface ChemistryPreset {
  label: string;
  voltage_nominal: number;
  rechargeable: boolean;
  notes: string;
}

const CHEMISTRY_PRESETS: Record<BatteryChemistry, ChemistryPreset> = {
  "Li-SOCl2": {
    label: "Lithium Thionyl Chloride (Li-SOCl\u2082)",
    voltage_nominal: 3.6,
    rechargeable: false,
    notes: "ER14505 AA lithium thionyl chloride. 10-year shelf life. Non-linear discharge curve. Watch for passivation on first use; may need 15\u201330 min activation under load.",
  },
  "Li-MnO2": {
    label: "Lithium Manganese Dioxide (Li-MnO\u2082)",
    voltage_nominal: 3.0,
    rechargeable: false,
    notes: "Replaceable Li-MnO\u2082 AA battery. Non-linear discharge curve \u2014 percentage estimates unreliable. Replace all batteries at once.",
  },
  Alkaline: {
    label: "Alkaline (1.5V per cell)",
    voltage_nominal: 1.5,
    rechargeable: false,
    notes: "Standard AA alkaline batteries (1.5V each). Budget option with 2\u20133 year lifespan. Not interchangeable with lithium. Shorter life than lithium alternatives.",
  },
  "Li-ion": {
    label: "Lithium Ion (Li-ion) \u2014 Rechargeable",
    voltage_nominal: 3.7,
    rechargeable: true,
    notes: "High energy density rechargeable cells. Use quality brand cells (Panasonic/Samsung). Capacity degrades over charge cycles.",
  },
  LiFePO4: {
    label: "Lithium Iron Phosphate (LiFePO\u2084) \u2014 Rechargeable",
    voltage_nominal: 3.2,
    rechargeable: true,
    notes: "Excellent thermal stability and safety. Long cycle life (2000+). Good for temperature-extreme environments.",
  },
  Other: {
    label: "Other / Unknown",
    voltage_nominal: 3.0,
    rechargeable: false,
    notes: "",
  },
};

// ─── Battery form state ─────────────────────────────────────
interface BatteryFormState {
  chemistry: BatteryChemistry | string;
  type: string;
  quantity: number;
  capacity_mah: number;
  voltage_nominal: number;
  voltage_range_min: number;
  voltage_range_max: number;
  expected_life_years: number;
  low_threshold_v: number;
  rechargeable: boolean;
  reporting_format: string;
  notes: string;
}

function batteryInfoToForm(info: SensorCatalogBatteryInfo): BatteryFormState {
  return {
    chemistry: info.chemistry ?? "Other",
    type: info.type ?? "",
    quantity: info.quantity ?? 1,
    capacity_mah: info.capacity_mah ?? 0,
    voltage_nominal: info.voltage_nominal ?? 3.0,
    voltage_range_min: info.voltage_range?.[0] ?? 2.0,
    voltage_range_max: info.voltage_range?.[1] ?? 3.6,
    expected_life_years: info.expected_life_years ?? 0,
    low_threshold_v: info.low_threshold_v ?? 0,
    rechargeable: info.rechargeable ?? false,
    reporting_format: info.reporting_format ?? "",
    notes: info.notes ?? "",
  };
}

function formToBatteryInfo(form: BatteryFormState): SensorCatalogBatteryInfo {
  const info: SensorCatalogBatteryInfo = {
    chemistry: form.chemistry || undefined,
    type: form.type || undefined,
    quantity: form.quantity || 1,
    capacity_mah: form.capacity_mah || undefined,
    voltage_nominal: form.voltage_nominal || undefined,
    voltage_range:
      form.voltage_range_min && form.voltage_range_max
        ? [form.voltage_range_min, form.voltage_range_max]
        : undefined,
    expected_life_years: form.expected_life_years || undefined,
    low_threshold_v: form.low_threshold_v || undefined,
    rechargeable: form.rechargeable,
    reporting_format: form.reporting_format || undefined,
    notes: form.notes || undefined,
  };
  return info;
}

// ─── Props ──────────────────────────────────────────────────
interface BatterySpecificationsProps {
  batteryInfo: SensorCatalogBatteryInfo;
  sensorId: string;
  onSave: (updated: SensorCatalogBatteryInfo) => void;
  isSaving?: boolean;
  /** When the parent component is already in edit mode */
  parentEditing?: boolean;
}

// ─── Component ──────────────────────────────────────────────
export default function BatterySpecifications({
  batteryInfo,
  sensorId,
  onSave,
  isSaving,
  parentEditing,
}: BatterySpecificationsProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BatteryFormState>(() => batteryInfoToForm(batteryInfo));

  // Sync form when batteryInfo prop changes (e.g. after mutation success)
  useEffect(() => {
    if (!editing) {
      setForm(batteryInfoToForm(batteryInfo));
    }
  }, [batteryInfo, editing]);

  const isEditing = editing || parentEditing;

  const handleChemistryChange = (value: string) => {
    const chem = value as BatteryChemistry;
    const preset = CHEMISTRY_PRESETS[chem];
    if (preset) {
      setForm((prev) => ({
        ...prev,
        chemistry: chem,
        voltage_nominal: preset.voltage_nominal,
        rechargeable: preset.rechargeable,
        notes: prev.notes || preset.notes,
      }));
    } else {
      setForm((prev) => ({ ...prev, chemistry: value }));
    }
  };

  const handleSave = () => {
    const info = formToBatteryInfo(form);
    onSave(info);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm(batteryInfoToForm(batteryInfo));
    setEditing(false);
  };

  const chemistryLabel =
    CHEMISTRY_PRESETS[form.chemistry as BatteryChemistry]?.label ?? form.chemistry ?? "Unknown";

  const hasData =
    batteryInfo.chemistry || batteryInfo.type || batteryInfo.capacity_mah || batteryInfo.voltage_nominal;

  // Validation
  const capacityWarning = form.capacity_mah > 0 && form.capacity_mah < 100;
  const voltageWarning = form.voltage_nominal > 0 && form.voltage_nominal > 50;
  const chemistryMissing = isEditing && !form.chemistry;

  // ─── Edit Mode ──────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Battery className="w-4 h-4" /> Battery Specifications
          </h3>
          {!parentEditing && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving || chemistryMissing}>
                <Save className="w-4 h-4 mr-1" /> {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Left column: Core specs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Chemistry & Capacity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`battery-chemistry-${sensorId}`} className="text-xs">
                  Battery Chemistry *
                </Label>
                <Select value={form.chemistry} onValueChange={handleChemistryChange}>
                  <SelectTrigger id={`battery-chemistry-${sensorId}`} className="mt-1">
                    <SelectValue placeholder="Select chemistry..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHEMISTRY_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {chemistryMissing && (
                  <p className="text-xs text-red-500 mt-1" role="alert">
                    Chemistry is required
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor={`battery-type-${sensorId}`} className="text-xs">
                  Battery Type Label
                </Label>
                <Input
                  id={`battery-type-${sensorId}`}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="e.g., 2x AA, CR2450, 18650"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`battery-qty-${sensorId}`} className="text-xs">
                    Quantity
                  </Label>
                  <Input
                    id={`battery-qty-${sensorId}`}
                    type="number"
                    min={1}
                    max={10}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`battery-cap-${sensorId}`} className="text-xs">
                    Capacity (mAh)
                  </Label>
                  <Input
                    id={`battery-cap-${sensorId}`}
                    type="number"
                    min={0}
                    max={10000}
                    value={form.capacity_mah || ""}
                    onChange={(e) =>
                      setForm({ ...form, capacity_mah: parseInt(e.target.value) || 0 })
                    }
                    placeholder="e.g., 2600"
                    className="mt-1"
                  />
                  {capacityWarning && (
                    <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Unusually low capacity
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id={`battery-rechargeable-${sensorId}`}
                  checked={form.rechargeable}
                  onCheckedChange={(checked) => setForm({ ...form, rechargeable: checked })}
                />
                <Label htmlFor={`battery-rechargeable-${sensorId}`} className="text-xs cursor-pointer">
                  Rechargeable
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Right column: Voltage & Life */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Voltage & Lifespan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`battery-vnominal-${sensorId}`} className="text-xs">
                  Nominal Voltage (V)
                </Label>
                <Input
                  id={`battery-vnominal-${sensorId}`}
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={50}
                  value={form.voltage_nominal || ""}
                  onChange={(e) =>
                    setForm({ ...form, voltage_nominal: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
                {voltageWarning && (
                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Unusually high voltage
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`battery-vmin-${sensorId}`} className="text-xs">
                    Voltage Min (V)
                  </Label>
                  <Input
                    id={`battery-vmin-${sensorId}`}
                    type="number"
                    step={0.1}
                    value={form.voltage_range_min || ""}
                    onChange={(e) =>
                      setForm({ ...form, voltage_range_min: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`battery-vmax-${sensorId}`} className="text-xs">
                    Voltage Max (V)
                  </Label>
                  <Input
                    id={`battery-vmax-${sensorId}`}
                    type="number"
                    step={0.1}
                    value={form.voltage_range_max || ""}
                    onChange={(e) =>
                      setForm({ ...form, voltage_range_max: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`battery-low-${sensorId}`} className="text-xs">
                    Low Threshold (V)
                  </Label>
                  <Input
                    id={`battery-low-${sensorId}`}
                    type="number"
                    step={0.1}
                    value={form.low_threshold_v || ""}
                    onChange={(e) =>
                      setForm({ ...form, low_threshold_v: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`battery-life-${sensorId}`} className="text-xs">
                    Expected Life (years)
                  </Label>
                  <Input
                    id={`battery-life-${sensorId}`}
                    type="number"
                    min={0}
                    max={50}
                    value={form.expected_life_years || ""}
                    onChange={(e) =>
                      setForm({ ...form, expected_life_years: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`battery-format-${sensorId}`} className="text-xs">
                  Reporting Format
                </Label>
                <Input
                  id={`battery-format-${sensorId}`}
                  value={form.reporting_format}
                  onChange={(e) => setForm({ ...form, reporting_format: e.target.value })}
                  placeholder="e.g., millivolts_div10"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        <Card>
          <CardContent className="pt-4">
            <Label htmlFor={`battery-notes-${sensorId}`} className="text-xs">
              Battery Notes & Maintenance Tips
            </Label>
            <Textarea
              id={`battery-notes-${sensorId}`}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="mt-1 text-sm"
              placeholder="Replacement info, passivation warnings, non-linear discharge notes..."
            />
          </CardContent>
        </Card>

        {/* Live summary */}
        {form.chemistry && (
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Summary
            </p>
            <p>
              {form.quantity}x {chemistryLabel} &mdash;{" "}
              {form.capacity_mah ? `${form.capacity_mah} mAh` : "capacity TBD"},{" "}
              {form.voltage_nominal}V nominal
              {form.rechargeable ? " (rechargeable)" : " (primary cell)"}
              {form.expected_life_years ? `, ~${form.expected_life_years} year life` : ""}
            </p>
          </div>
        )}

        {parentEditing && (
          <p className="text-xs text-muted-foreground">
            Battery changes will be saved when you click Save at the top of the page.
          </p>
        )}
      </div>
    );
  }

  // ─── View Mode ──────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Battery className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No battery specifications yet.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
          <Pencil className="w-4 h-4 mr-1" /> Add Battery Info
        </Button>
      </div>
    );
  }

  const info = batteryInfo;
  const voltageRange = info.voltage_range;
  const lowV = info.low_threshold_v;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {info.rechargeable && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Zap className="w-3 h-3 mr-1" /> Rechargeable
            </Badge>
          )}
          {!info.rechargeable && info.chemistry && (
            <Badge variant="secondary">Primary Cell</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="w-4 h-4 mr-1" /> Edit
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Specifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Battery className="w-4 h-4 text-blue-500" /> Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {info.chemistry && (
              <SpecRow label="Chemistry" value={CHEMISTRY_PRESETS[info.chemistry as BatteryChemistry]?.label ?? info.chemistry} />
            )}
            {info.type && <SpecRow label="Type" value={info.type} />}
            {info.quantity && info.quantity > 1 && (
              <SpecRow label="Quantity" value={`${info.quantity} cells`} />
            )}
            {info.capacity_mah && (
              <SpecRow label="Capacity" value={`${info.capacity_mah} mAh`} />
            )}
            {info.voltage_nominal && (
              <SpecRow label="Nominal Voltage" value={`${info.voltage_nominal}V`} />
            )}
            {info.expected_life_years && (
              <SpecRow label="Expected Life" value={`~${info.expected_life_years} years`} />
            )}
            {info.reporting_format && (
              <SpecRow label="Reporting" value={info.reporting_format.replace(/_/g, " ")} />
            )}
          </CardContent>
        </Card>

        {/* Voltage Range Visualization */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Voltage Range
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {voltageRange ? (() => {
              const [min, max] = voltageRange;
              const low = lowV ?? min + (max - min) * 0.3;
              const pctLow = ((low - min) / (max - min)) * 100;
              return (
                <div className="w-full max-w-[280px]">
                  <div className="relative h-7 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-amber-500 rounded-l-full"
                      style={{ width: `${pctLow}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-gradient-to-r from-green-400 to-green-600 rounded-r-full"
                      style={{ left: `${pctLow}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs font-mono font-semibold">
                    <span className="text-red-500">{min}V</span>
                    <span className="text-amber-500">{low}V low</span>
                    <span className="text-green-600">{max}V</span>
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-muted-foreground">No voltage range data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {info.notes && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Maintenance Notes
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{info.notes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Helper ─────────────────────────────────────────────────
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-xs">{value}</span>
    </div>
  );
}
