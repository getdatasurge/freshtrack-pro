import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  ChevronDown,
  ChevronRight,
  Pencil,
  History,
  Loader2,
  Thermometer,
  DoorOpen,
} from "lucide-react";
import { format } from "date-fns";

interface UnitSettings {
  id: string;
  unit_type: string;
  temp_limit_low: number | null;
  temp_limit_high: number;
  notes?: string | null;
  door_sensor_enabled?: boolean;
  door_open_grace_minutes?: number;
}

interface SettingsHistoryEntry {
  id: string;
  changed_by: string;
  changed_at: string;
  changes: {
    field: string;
    old_value: string | number | boolean | null;
    new_value: string | number | boolean | null;
  }[];
  note: string | null;
  profile?: { email: string; full_name: string | null } | null;
}

interface UnitSettingsSectionProps {
  unitId: string;
  unitType: string;
  tempLimitLow: number | null;
  tempLimitHigh: number;
  notes?: string | null;
  doorSensorEnabled?: boolean;
  doorOpenGraceMinutes?: number;
  onSettingsUpdated: () => void;
}

const unitTypeLabels: Record<string, string> = {
  fridge: "Fridge",
  freezer: "Freezer",
  display_case: "Display Case",
  walk_in_cooler: "Walk-in Cooler",
  walk_in_freezer: "Walk-in Freezer",
  blast_chiller: "Blast Chiller",
};

export default function UnitSettingsSection({
  unitId,
  unitType,
  tempLimitLow,
  tempLimitHigh,
  notes,
  doorSensorEnabled = false,
  doorOpenGraceMinutes = 20,
  onSettingsUpdated,
}: UnitSettingsSectionProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [history, setHistory] = useState<SettingsHistoryEntry[]>([]);

  // Edit form state
  const [editUnitType, setEditUnitType] = useState(unitType);
  const [editLowLimit, setEditLowLimit] = useState(
    tempLimitLow !== null ? tempLimitLow.toString() : ""
  );
  const [editHighLimit, setEditHighLimit] = useState(tempLimitHigh.toString());
  const [editNotes, setEditNotes] = useState(notes || "");
  const [editDoorSensorEnabled, setEditDoorSensorEnabled] = useState(doorSensorEnabled);
  const [editDoorGraceMinutes, setEditDoorGraceMinutes] = useState(doorOpenGraceMinutes.toString());
  const [validationError, setValidationError] = useState<string | null>(null);

  const formatTemp = (temp: number | null) => {
    if (temp === null) return "Not set";
    return `${temp}°F`;
  };

  const openEditModal = () => {
    setEditUnitType(unitType);
    setEditLowLimit(tempLimitLow !== null ? tempLimitLow.toString() : "");
    setEditHighLimit(tempLimitHigh.toString());
    setEditNotes(notes || "");
    setEditDoorSensorEnabled(doorSensorEnabled);
    setEditDoorGraceMinutes(doorOpenGraceMinutes.toString());
    setValidationError(null);
    setShowEditModal(true);
  };

  const validateAndSave = async () => {
    const lowVal = editLowLimit ? parseFloat(editLowLimit) : null;
    const highVal = parseFloat(editHighLimit);
    const graceVal = parseInt(editDoorGraceMinutes) || 20;

    if (isNaN(highVal)) {
      setValidationError("High limit is required");
      return;
    }

    if (lowVal !== null && lowVal >= highVal) {
      setValidationError("Low limit must be less than high limit");
      return;
    }

    if (graceVal < 1 || graceVal > 60) {
      setValidationError("Grace minutes must be between 1 and 60");
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build changes array for history
      const changes: { field: string; old_value: any; new_value: any }[] = [];

      if (editUnitType !== unitType) {
        changes.push({
          field: "unit_type",
          old_value: unitType,
          new_value: editUnitType,
        });
      }

      if (lowVal !== tempLimitLow) {
        changes.push({
          field: "temp_limit_low",
          old_value: tempLimitLow,
          new_value: lowVal,
        });
      }

      if (highVal !== tempLimitHigh) {
        changes.push({
          field: "temp_limit_high",
          old_value: tempLimitHigh,
          new_value: highVal,
        });
      }

      if (editDoorSensorEnabled !== doorSensorEnabled) {
        changes.push({
          field: "door_sensor_enabled",
          old_value: doorSensorEnabled,
          new_value: editDoorSensorEnabled,
        });
      }

      if (graceVal !== doorOpenGraceMinutes) {
        changes.push({
          field: "door_open_grace_minutes",
          old_value: doorOpenGraceMinutes,
          new_value: graceVal,
        });
      }

      if (changes.length === 0 && editNotes === (notes || "")) {
        toast({ title: "No changes to save" });
        setShowEditModal(false);
        setIsSaving(false);
        return;
      }

      // Update unit
      const { error: updateError } = await supabase
        .from("units")
        .update({
          unit_type: editUnitType as any,
          temp_limit_low: lowVal,
          temp_limit_high: highVal,
          notes: editNotes || null,
          door_sensor_enabled: editDoorSensorEnabled,
          door_open_grace_minutes: graceVal,
        })
        .eq("id", unitId);

      if (updateError) throw updateError;

      // Insert history record if there were changes
      if (changes.length > 0) {
        const { error: historyError } = await supabase
          .from("unit_settings_history")
          .insert({
            unit_id: unitId,
            changed_by: user.id,
            changes: changes,
            note: editNotes !== (notes || "") ? "Notes updated" : null,
          });

        if (historyError) {
          console.error("History insert error:", historyError);
          // Don't fail the whole operation for history
        }
      }

      toast({ title: "Unit settings updated" });
      setShowEditModal(false);
      onSettingsUpdated();
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    }

    setIsSaving(false);
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("unit_settings_history")
        .select("id, changed_by, changed_at, changes, note")
        .eq("unit_id", unitId)
        .order("changed_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Fetch user profiles for changed_by
      const userIds = [...new Set((data || []).map((h) => h.changed_by))];
      let profileMap: Record<string, { email: string; full_name: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profileMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { email: p.email, full_name: p.full_name };
            return acc;
          }, {} as Record<string, { email: string; full_name: string | null }>);
        }
      }

      const historyWithProfiles = (data || []).map((h) => ({
        ...h,
        changes: h.changes as SettingsHistoryEntry["changes"],
        profile: profileMap[h.changed_by] || null,
      }));

      setHistory(historyWithProfiles);
    } catch (error) {
      console.error("Load history error:", error);
      toast({
        title: "Failed to load history",
        variant: "destructive",
      });
    }
    setIsLoadingHistory(false);
  };

  const openHistoryModal = () => {
    setShowHistoryModal(true);
    loadHistory();
  };

  const getFieldLabel = (field: string): string => {
    switch (field) {
      case "unit_type":
        return "Unit Type";
      case "temp_limit_low":
        return "Low Limit";
      case "temp_limit_high":
        return "High Limit";
      case "door_sensor_enabled":
        return "Door Sensor";
      case "door_open_grace_minutes":
        return "Door Grace Minutes";
      default:
        return field;
    }
  };

  const formatValue = (field: string, value: any): string => {
    if (value === null || value === undefined) return "Not set";
    if (field === "unit_type") return unitTypeLabels[value] || value;
    if (field.includes("temp_limit")) return `${value}°F`;
    if (field === "door_sensor_enabled") return value ? "Enabled" : "Disabled";
    if (field === "door_open_grace_minutes") return `${value} min`;
    return String(value);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Unit Settings
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!isOpen && (
                    <span className="text-sm text-muted-foreground hidden sm:inline">
                      {unitTypeLabels[unitType] || unitType} · Low: {formatTemp(tempLimitLow)} · High: {formatTemp(tempLimitHigh)}
                    </span>
                  )}
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Thermometer className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium">{unitTypeLabels[unitType] || unitType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-[10px] text-blue-400">L</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Low Limit</p>
                    <p className="font-medium">{formatTemp(tempLimitLow)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-[10px] text-red-400">H</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">High Limit</p>
                    <p className="font-medium">{formatTemp(tempLimitHigh)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <DoorOpen className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Door Sensor</p>
                    <p className="font-medium">{doorSensorEnabled ? `On (${doorOpenGraceMinutes}m grace)` : "Off"}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={openEditModal}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={openHistoryModal}>
                  <History className="w-3 h-3 mr-1" />
                  View History
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unit Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit Type</Label>
              <Select value={editUnitType} onValueChange={setEditUnitType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                  <SelectItem value="display_case">Display Case</SelectItem>
                  <SelectItem value="walk_in_cooler">Walk-in Cooler</SelectItem>
                  <SelectItem value="walk_in_freezer">Walk-in Freezer</SelectItem>
                  <SelectItem value="blast_chiller">Blast Chiller</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Low Limit (°F)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 32 or -10"
                  value={editLowLimit}
                  onChange={(e) => setEditLowLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Negative values for freezers
                </p>
              </div>
              <div className="space-y-2">
                <Label>High Limit (°F)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 41"
                  value={editHighLimit}
                  onChange={(e) => setEditHighLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-muted-foreground" />
                  <Label>Door Sensor Enabled</Label>
                </div>
                <Switch
                  checked={editDoorSensorEnabled}
                  onCheckedChange={setEditDoorSensorEnabled}
                />
              </div>
              
              {editDoorSensorEnabled && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-sm">Door Open Grace (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={editDoorGraceMinutes}
                    onChange={(e) => setEditDoorGraceMinutes(e.target.value)}
                    className="w-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Time before door-open masks temp excursions (1-60 min)
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this unit..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>

            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={validateAndSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Settings History</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No changes recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-muted/30 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {entry.profile?.full_name || entry.profile?.email || "Unknown user"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.changed_at), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {entry.changes.map((change, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="text-muted-foreground">
                            {getFieldLabel(change.field)}:
                          </span>{" "}
                          <span className="text-destructive/70 line-through">
                            {formatValue(change.field, change.old_value)}
                          </span>
                          {" → "}
                          <span className="text-safe">
                            {formatValue(change.field, change.new_value)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {entry.note && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {entry.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
