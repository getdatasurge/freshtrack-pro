import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateLoraSensor } from "@/hooks/useLoraSensors";
import { LoraSensor, LoraSensorType } from "@/types/ttn";
import { SENSOR_TYPE_OPTIONS, SENSOR_TYPE_VALUES } from "@/lib/sensorTypeOptions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Lock } from "lucide-react";

const editSensorSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  sensor_type: z.enum(SENSOR_TYPE_VALUES),
  site_id: z.string().optional(),
  unit_id: z.string().optional(),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type EditSensorFormData = z.infer<typeof editSensorSchema>;

interface Site {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  site_id: string;
}

interface EditSensorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sensor: LoraSensor;
  sites: Site[];
  units: Unit[];
}

export function EditSensorDialog({
  open,
  onOpenChange,
  sensor,
  sites,
  units,
}: EditSensorDialogProps) {
  const updateSensor = useUpdateLoraSensor();

  const form = useForm<EditSensorFormData>({
    resolver: zodResolver(editSensorSchema),
    defaultValues: {
      name: sensor.name,
      sensor_type: sensor.sensor_type,
      site_id: sensor.site_id || undefined,
      unit_id: sensor.unit_id || undefined,
      description: sensor.description || "",
    },
  });

  // Reset form when sensor changes
  useEffect(() => {
    form.reset({
      name: sensor.name,
      sensor_type: sensor.sensor_type,
      site_id: sensor.site_id || undefined,
      unit_id: sensor.unit_id || undefined,
      description: sensor.description || "",
    });
  }, [sensor, form]);

  const selectedSiteId = form.watch("site_id");

  // Filter units based on selected site
  const filteredUnits = selectedSiteId
    ? units.filter((u) => u.site_id === selectedSiteId)
    : [];

  const formatEUI = (eui: string) => {
    return eui.toUpperCase().match(/.{1,2}/g)?.join(":") || eui.toUpperCase();
  };

  const maskAppKey = (key: string | null) => {
    if (!key || key.length < 4) return "••••••••••••••••••••••••••••";
    return "••••••••••••••••••••••••••••" + key.slice(-4).toUpperCase();
  };

  const onSubmit = (data: EditSensorFormData) => {
    updateSensor.mutate(
      {
        id: sensor.id,
        updates: {
          name: data.name,
          sensor_type: data.sensor_type as LoraSensorType,
          site_id: data.site_id || null,
          unit_id: data.unit_id || null,
          description: data.description || null,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  // Reset unit when site changes
  const handleSiteChange = (value: string) => {
    const newSiteId = value === "none" ? undefined : value;
    form.setValue("site_id", newSiteId);
    // Only reset unit if it's not in the new site
    const currentUnitId = form.getValues("unit_id");
    if (currentUnitId) {
      const unitInNewSite = units.find(
        (u) => u.id === currentUnitId && u.site_id === newSiteId
      );
      if (!unitInNewSite) {
        form.setValue("unit_id", undefined);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sensor</DialogTitle>
          <DialogDescription>
            Update sensor details. EUI credentials cannot be changed after registration.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sensor Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Walk-in Freezer Sensor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Read-only EUI fields */}
            <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Credentials (read-only)</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">DevEUI</label>
                <Input
                  value={formatEUI(sensor.dev_eui)}
                  disabled
                  className="font-mono text-xs bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">AppEUI</label>
                <Input
                  value={sensor.app_eui ? formatEUI(sensor.app_eui) : "—"}
                  disabled
                  className="font-mono text-xs bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">AppKey</label>
                <Input
                  value={maskAppKey(sensor.app_key)}
                  disabled
                  className="font-mono text-xs bg-background"
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="sensor_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sensor Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sensor type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SENSOR_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4 text-muted-foreground" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site (Optional)</FormLabel>
                  <Select
                    onValueChange={handleSiteChange}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a site" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No site assigned</SelectItem>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit (Optional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                    value={field.value || "none"}
                    disabled={!selectedSiteId || filteredUnits.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !selectedSiteId 
                            ? "Select a site first" 
                            : filteredUnits.length === 0 
                              ? "No units in this site" 
                              : "Select a unit"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No unit assigned</SelectItem>
                      {filteredUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this sensor..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateSensor.isPending}>
                {updateSensor.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
