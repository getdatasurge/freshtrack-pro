import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateLoraSensor } from "@/hooks/useLoraSensors";
import { useSensorCatalogPublic } from "@/hooks/useSensorCatalog";
import { LoraSensorType } from "@/types/ttn";
import type { SensorCatalogEntry } from "@/types/sensorCatalog";
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
  FormDescription,
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
import { Loader2, Eye, EyeOff, BookOpen } from "lucide-react";

// Maps catalog sensor_kind → lora_sensors sensor_type
const CATALOG_KIND_TO_SENSOR_TYPE: Record<string, string> = {
  temp: "temperature",
  door: "door",
  combo: "combo",
  co2: "air_quality",
  leak: "leak",
  gps: "gps",
  pulse: "metering",
  soil: "temperature",
  air_quality: "air_quality",
  vibration: "multi_sensor",
  meter: "metering",
  tilt: "multi_sensor",
};

const EUI_REGEX = /^[0-9A-Fa-f]{16}$/;
const APPKEY_REGEX = /^[0-9A-Fa-f]{32}$/;

const addSensorSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  sensor_catalog_id: z.string().optional(),
  dev_eui: z
    .string()
    .min(1, "DevEUI is required")
    .regex(EUI_REGEX, "DevEUI must be exactly 16 hexadecimal characters"),
  app_eui: z
    .string()
    .min(1, "AppEUI is required")
    .regex(EUI_REGEX, "AppEUI must be exactly 16 hexadecimal characters"),
  app_key: z
    .string()
    .min(1, "AppKey is required")
    .regex(APPKEY_REGEX, "AppKey must be exactly 32 hexadecimal characters"),
  sensor_type: z.enum(SENSOR_TYPE_VALUES),
  site_id: z.string().min(1, "Site is required"),
  unit_id: z.string().optional(),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type AddSensorFormData = z.infer<typeof addSensorSchema>;

interface Site {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  site_id: string;
}

interface AddSensorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sites: Site[];
  units: Unit[];
  defaultSiteId?: string;
  defaultUnitId?: string;
}

export function AddSensorDialog({
  open,
  onOpenChange,
  organizationId,
  sites,
  units,
  defaultSiteId,
  defaultUnitId,
}: AddSensorDialogProps) {
  const createSensor = useCreateLoraSensor();
  const { data: catalogEntries = [] } = useSensorCatalogPublic();
  const [showAppKey, setShowAppKey] = useState(false);
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState<SensorCatalogEntry | null>(null);

  const form = useForm<AddSensorFormData>({
    resolver: zodResolver(addSensorSchema),
    defaultValues: {
      name: "",
      sensor_catalog_id: undefined,
      dev_eui: "",
      app_eui: "",
      app_key: "",
      sensor_type: "temperature",
      site_id: defaultSiteId || "",
      unit_id: defaultUnitId || undefined,
      description: "",
    },
  });

  const handleCatalogSelect = (catalogId: string) => {
    if (catalogId === "none") {
      setSelectedCatalogEntry(null);
      form.setValue("sensor_catalog_id", undefined);
      return;
    }
    const entry = catalogEntries.find((e) => e.id === catalogId);
    if (entry) {
      setSelectedCatalogEntry(entry);
      form.setValue("sensor_catalog_id", catalogId);
      const mappedType = CATALOG_KIND_TO_SENSOR_TYPE[entry.sensor_kind];
      if (mappedType && SENSOR_TYPE_VALUES.includes(mappedType)) {
        form.setValue("sensor_type", mappedType);
      }
    }
  };

  const selectedSiteId = form.watch("site_id");

  // Filter units based on selected site
  const filteredUnits = selectedSiteId
    ? units.filter((u) => u.site_id === selectedSiteId)
    : [];

  const onSubmit = (data: AddSensorFormData) => {
    createSensor.mutate(
      {
        organization_id: organizationId,
        name: data.name,
        dev_eui: data.dev_eui.toUpperCase(),
        app_eui: data.app_eui.toUpperCase(),
        app_key: data.app_key.toUpperCase(),
        sensor_type: data.sensor_type as LoraSensorType,
        site_id: data.site_id || null,
        unit_id: data.unit_id || null,
        description: data.description || null,
        sensor_catalog_id: data.sensor_catalog_id || null,
        manufacturer: selectedCatalogEntry?.manufacturer || null,
        model: selectedCatalogEntry?.model || null,
      },
      {
        onSuccess: () => {
          form.reset();
          setShowAppKey(false);
          setSelectedCatalogEntry(null);
          onOpenChange(false);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset({
        name: "",
        sensor_catalog_id: undefined,
        dev_eui: "",
        app_eui: "",
        app_key: "",
        sensor_type: "temperature",
        site_id: defaultSiteId || "",
        unit_id: defaultUnitId || undefined,
        description: "",
      });
      setShowAppKey(false);
      setSelectedCatalogEntry(null);
    }
    onOpenChange(newOpen);
  };

  // Reset unit when site changes
  const handleSiteChange = (value: string) => {
    form.setValue("site_id", value === "none" ? undefined : value);
    form.setValue("unit_id", undefined);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add LoRa Sensor</DialogTitle>
          <DialogDescription>
            Register a new LoRaWAN sensor with its OTAA credentials.
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

            {catalogEntries.length > 0 && (
              <FormField
                control={form.control}
                name="sensor_catalog_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" /> Sensor Model
                    </FormLabel>
                    <Select
                      onValueChange={handleCatalogSelect}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select from catalog (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Manual entry (skip catalog)</SelectItem>
                        {catalogEntries.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.manufacturer} {entry.model} — {entry.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose a model to auto-fill type, manufacturer & specs
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedCatalogEntry && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm space-y-1.5 border border-blue-200 dark:border-blue-800">
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  {selectedCatalogEntry.display_name}
                </p>
                {selectedCatalogEntry.description && (
                  <p className="text-blue-700 dark:text-blue-300 text-xs line-clamp-2">
                    {selectedCatalogEntry.description}
                  </p>
                )}
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {selectedCatalogEntry.frequency_bands?.map((b) => (
                    <span key={b} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
                      {b}
                    </span>
                  ))}
                  {selectedCatalogEntry.battery_info?.type && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
                      Battery: {selectedCatalogEntry.battery_info.type}
                    </span>
                  )}
                  {selectedCatalogEntry.supports_class && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200">
                      Class {selectedCatalogEntry.supports_class}
                    </span>
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="dev_eui"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DevEUI</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="A1B2C3D4E5F67890"
                      className="font-mono uppercase"
                      maxLength={16}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    16 hexadecimal characters (found on sensor label)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="app_eui"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AppEUI (JoinEUI)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0000000000000001"
                      className="font-mono uppercase"
                      maxLength={16}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    16 hexadecimal characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="app_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AppKey</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showAppKey ? "text" : "password"}
                        placeholder="32 character hex key"
                        className="font-mono uppercase pr-10"
                        maxLength={32}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowAppKey(!showAppKey)}
                      >
                        {showAppKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    32 hexadecimal characters (128-bit encryption key)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sensor_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sensor Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormLabel>Site *</FormLabel>
                  <Select
                    onValueChange={handleSiteChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a site" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Site assignment is required for sensor provisioning
                  </FormDescription>
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
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createSensor.isPending}>
                {createSensor.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Sensor
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
