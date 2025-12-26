import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  ChevronRight, 
  Building2,
  Loader2,
  Thermometer,
  Pencil,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type UnitType = Database["public"]["Enums"]["unit_type"];

interface Unit {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  last_temp_reading: number | null;
  last_reading_at: string | null;
  temp_limit_high: number;
  temp_limit_low: number | null;
}

interface AreaData {
  id: string;
  name: string;
  description: string | null;
  site: {
    id: string;
    name: string;
  };
}

const unitTypes: { value: UnitType; label: string }[] = [
  { value: "fridge", label: "Refrigerator" },
  { value: "freezer", label: "Freezer" },
  { value: "walk_in_cooler", label: "Walk-in Cooler" },
  { value: "walk_in_freezer", label: "Walk-in Freezer" },
  { value: "display_case", label: "Display Case" },
  { value: "blast_chiller", label: "Blast Chiller" },
];

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  ok: { color: "text-safe", bgColor: "bg-safe/10", label: "OK" },
  excursion: { color: "text-excursion", bgColor: "bg-excursion/10", label: "Excursion" },
  alarm_active: { color: "text-alarm", bgColor: "bg-alarm/10", label: "ALARM" },
  monitoring_interrupted: { color: "text-warning", bgColor: "bg-warning/10", label: "Interrupted" },
  manual_required: { color: "text-warning", bgColor: "bg-warning/10", label: "Manual Required" },
  restoring: { color: "text-accent", bgColor: "bg-accent/10", label: "Restoring" },
  offline: { color: "text-muted-foreground", bgColor: "bg-muted", label: "Offline" },
};

const AreaDetail = () => {
  const { siteId, areaId } = useParams();
  const { toast } = useToast();
  const [area, setArea] = useState<AreaData | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    unit_type: "fridge" as UnitType,
    temp_limit_high: "41",
    temp_limit_low: "",
  });
  const [editFormData, setEditFormData] = useState({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (areaId) {
      loadAreaData();
    }
  }, [areaId]);

  const loadAreaData = async () => {
    setIsLoading(true);
    
    // Load area with site info
    const { data: areaData, error: areaError } = await supabase
      .from("areas")
      .select(`
        id,
        name,
        description,
        site:sites!inner(id, name)
      `)
      .eq("id", areaId)
      .maybeSingle();

    if (areaError || !areaData) {
      console.error("Error loading area:", areaError);
      toast({ title: "Failed to load area", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setArea({
      id: areaData.id,
      name: areaData.name,
      description: areaData.description,
      site: {
        id: areaData.site.id,
        name: areaData.site.name,
      },
    });
    setEditFormData({
      name: areaData.name,
      description: areaData.description || "",
    });

    // Load units
    const { data: unitsData, error: unitsError } = await supabase
      .from("units")
      .select(`
        id,
        name,
        unit_type,
        status,
        last_temp_reading,
        last_reading_at,
        temp_limit_high,
        temp_limit_low
      `)
      .eq("area_id", areaId)
      .eq("is_active", true)
      .order("name");

    if (unitsError) {
      console.error("Error loading units:", unitsError);
    } else {
      setUnits(unitsData || []);
    }

    setIsLoading(false);
  };

  const handleCreateUnit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Unit name is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.rpc("create_unit_for_area", {
      p_area_id: areaId!,
      p_name: formData.name,
      p_unit_type: formData.unit_type,
      p_temp_limit_high: parseFloat(formData.temp_limit_high) || 41,
      p_temp_limit_low: formData.temp_limit_low ? parseFloat(formData.temp_limit_low) : null,
    });

    if (error) {
      console.error("Error creating unit:", error);
      toast({ title: "Failed to create unit", variant: "destructive" });
    } else {
      toast({ title: "Unit created successfully" });
      setFormData({ name: "", unit_type: "fridge", temp_limit_high: "41", temp_limit_low: "" });
      setDialogOpen(false);
      loadAreaData();
    }
    setIsSubmitting(false);
  };

  const handleUpdateArea = async () => {
    if (!editFormData.name.trim()) {
      toast({ title: "Area name is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase
      .from("areas")
      .update({
        name: editFormData.name,
        description: editFormData.description || null,
      })
      .eq("id", areaId);

    if (error) {
      console.error("Error updating area:", error);
      toast({ title: "Failed to update area", variant: "destructive" });
    } else {
      toast({ title: "Area updated successfully" });
      setEditDialogOpen(false);
      loadAreaData();
    }
    setIsSubmitting(false);
  };

  const formatTemp = (temp: number | null) => {
    if (temp === null) return "--";
    return `${temp.toFixed(1)}°F`;
  };

  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleUnitTypeChange = (value: UnitType) => {
    const isFreezer = ["freezer", "walk_in_freezer", "blast_chiller"].includes(value);
    setFormData({
      ...formData,
      unit_type: value,
      temp_limit_high: isFreezer ? "0" : "41",
      temp_limit_low: isFreezer ? "-20" : "",
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!area) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Area not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showBack backHref={`/sites/${siteId}`}>
      <div className="space-y-6">
        {/* Area Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-secondary/50 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{area.name}</h1>
              <p className="text-muted-foreground">
                {area.site.name} · {area.description || "No description"}
              </p>
            </div>
          </div>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="w-4 h-4 mr-2" />
                Edit Area
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Area</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Area Name *</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea
                    id="edit-desc"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateArea} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Units Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Refrigeration Units</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Unit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Unit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit-name">Unit Name *</Label>
                    <Input
                      id="unit-name"
                      placeholder="e.g., Prep Fridge #1"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Type</Label>
                    <Select value={formData.unit_type} onValueChange={handleUnitTypeChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="temp-high">High Limit (°F)</Label>
                      <Input
                        id="temp-high"
                        type="number"
                        value={formData.temp_limit_high}
                        onChange={(e) => setFormData({ ...formData, temp_limit_high: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temp-low">Low Limit (°F)</Label>
                      <Input
                        id="temp-low"
                        type="number"
                        placeholder="Optional"
                        value={formData.temp_limit_low}
                        onChange={(e) => setFormData({ ...formData, temp_limit_low: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateUnit} 
                      disabled={isSubmitting}
                      className="bg-accent hover:bg-accent/90"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Unit
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {units.length > 0 ? (
            <div className="grid gap-3">
              {units.map((unit) => {
                const status = statusConfig[unit.status] || statusConfig.offline;
                const isOnline = unit.status !== "offline" && unit.last_reading_at;

                return (
                  <Link key={unit.id} to={`/units/${unit.id}`}>
                    <Card className="unit-card cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl ${status.bgColor} flex items-center justify-center`}>
                              <Thermometer className={`w-6 h-6 ${status.color}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">{unit.name}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                                  {status.label}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground capitalize">
                                {unit.unit_type.replace(/_/g, " ")}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right hidden sm:block">
                              <div className={`temp-display text-xl font-semibold ${
                                unit.last_temp_reading && unit.last_temp_reading > unit.temp_limit_high
                                  ? "text-alarm"
                                  : status.color
                              }`}>
                                {formatTemp(unit.last_temp_reading)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {isOnline ? (
                                  <Wifi className="w-3 h-3 text-safe" />
                                ) : (
                                  <WifiOff className="w-3 h-3" />
                                )}
                                {getTimeAgo(unit.last_reading_at)}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>

                        {/* Mobile temp display */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border sm:hidden">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {isOnline ? (
                              <Wifi className="w-3 h-3 text-safe" />
                            ) : (
                              <WifiOff className="w-3 h-3" />
                            )}
                            {getTimeAgo(unit.last_reading_at)}
                          </div>
                          <div className={`temp-display text-xl font-semibold ${
                            unit.last_temp_reading && unit.last_temp_reading > unit.temp_limit_high
                              ? "text-alarm"
                              : status.color
                          }`}>
                            {formatTemp(unit.last_temp_reading)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                  <Thermometer className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Units Yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Add refrigeration units to this area to start monitoring temperatures.
                </p>
                <Button 
                  onClick={() => setDialogOpen(true)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Unit
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AreaDetail;
