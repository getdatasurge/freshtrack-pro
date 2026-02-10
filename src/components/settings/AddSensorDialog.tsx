import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateLoraSensor } from "@/hooks/useLoraSensors";
import { useSensorCatalogPublic } from "@/hooks/useSensorCatalog";
import { LoraSensorType } from "@/types/ttn";
import type { SensorCatalogPublicEntry } from "@/types/sensorCatalog";
import { SENSOR_TYPE_OPTIONS, SENSOR_TYPE_VALUES } from "@/lib/sensorTypeOptions";
import { decodeCredentials, parseModelKey } from "@/lib/qr/sensorQR";
import { QRScanner } from "@/components/QRScanner";
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
import {
  Loader2,
  Eye,
  EyeOff,
  BookOpen,
  QrCode,
  PenLine,
  ArrowLeft,
  Check,
  Lock,
} from "lucide-react";

// Maps catalog sensor_kind → lora_sensors sensor_type
const CATALOG_KIND_TO_SENSOR_TYPE: Record<string, string> = {
  temp: "temperature",
  temp_humidity: "temperature_humidity",
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

// Friendly sensor type display names
const SENSOR_TYPE_FRIENDLY: Record<string, string> = {
  temperature: "Temperature Sensor",
  temperature_humidity: "Temperature & Humidity Sensor",
  door: "Door / Contact Sensor",
  motion: "Motion Sensor",
  leak: "Water Leak Sensor",
  metering: "Metering / Pulse Counter",
  gps: "GPS / Location Sensor",
  air_quality: "CO\u2082 / Air Quality Sensor",
  multi_sensor: "Multi-Sensor",
  combo: "Combo (Temp + Door) Sensor",
  contact: "Contact Switch",
};

function friendlySensorType(type: string): string {
  return SENSOR_TYPE_FRIENDLY[type] || type;
}

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

type ModalStep = "method-select" | "qr-scan" | "qr-complete" | "manual";

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
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState<SensorCatalogPublicEntry | null>(null);
  const [step, setStep] = useState<ModalStep>("method-select");
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrModelMatched, setQrModelMatched] = useState(false);

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
          setStep("method-select");
          setQrError(null);
          setQrModelMatched(false);
          onOpenChange(false);
        },
      }
    );
  };

  const resetAll = () => {
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
    setStep("method-select");
    setQrError(null);
    setQrModelMatched(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetAll();
    }
    onOpenChange(newOpen);
  };

  const handleSiteChange = (value: string) => {
    form.setValue("site_id", value === "none" ? undefined : value);
    form.setValue("unit_id", undefined);
  };

  // --- QR scan handler ---
  const handleQRScan = (rawValue: string) => {
    setQrError(null);
    const decoded = decodeCredentials(rawValue);
    if (!decoded) {
      setQrError("Not a valid FrostGuard sensor QR code. Try manual entry.");
      return;
    }

    form.setValue("dev_eui", decoded.dev_eui);
    form.setValue("app_eui", decoded.app_eui);
    form.setValue("app_key", decoded.app_key);

    // Try to match model from catalog
    if (decoded.model_key && catalogEntries.length > 0) {
      const parsed = parseModelKey(decoded.model_key);
      if (parsed) {
        const match = catalogEntries.find(
          (e) =>
            e.manufacturer.toLowerCase() === parsed.manufacturer.toLowerCase() &&
            e.model.toLowerCase() === parsed.model.toLowerCase()
        );
        if (match) {
          setSelectedCatalogEntry(match);
          form.setValue("sensor_catalog_id", match.id);
          const mappedType = CATALOG_KIND_TO_SENSOR_TYPE[match.sensor_kind];
          if (mappedType && SENSOR_TYPE_VALUES.includes(mappedType)) {
            form.setValue("sensor_type", mappedType);
          }
          setQrModelMatched(true);
        }
      }
    }

    setStep("qr-complete");
  };

  const handleBack = () => {
    if (step === "qr-scan" || step === "manual") {
      resetAll();
    } else if (step === "qr-complete") {
      // Go back to scan — clear QR-filled fields
      form.setValue("dev_eui", "");
      form.setValue("app_eui", "");
      form.setValue("app_key", "");
      form.setValue("sensor_catalog_id", undefined);
      setSelectedCatalogEntry(null);
      setQrModelMatched(false);
      setQrError(null);
      setStep("qr-scan");
    }
  };

  // --- Dialog title/description per step ---
  const stepTitle: Record<ModalStep, string> = {
    "method-select": "Add LoRa Sensor",
    "qr-scan": "Scan Sensor QR Code",
    "qr-complete": "Complete Sensor Setup",
    manual: "Add LoRa Sensor \u2014 Manual Entry",
  };

  const stepDescription: Record<ModalStep, string> = {
    "method-select": "Choose how you'd like to register your sensor.",
    "qr-scan": "Point your camera at the sensor's QR code, or paste the code data below.",
    "qr-complete": "Credentials loaded from QR code. Fill in the remaining details.",
    manual: "Register a new LoRaWAN sensor with its OTAA credentials.",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{stepTitle[step]}</DialogTitle>
          <DialogDescription>{stepDescription[step]}</DialogDescription>
        </DialogHeader>

        {/* ── Step: Method Selection ───────────────── */}
        {step === "method-select" && (
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={() => setStep("qr-scan")}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-muted bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-center"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Scan QR Code</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-fill credentials and sensor type
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStep("manual")}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-muted bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-center"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <PenLine className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Manual Entry</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter credentials manually
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── Step: QR Scan ───────────────────────── */}
        {step === "qr-scan" && (
          <div className="space-y-4">
            <QRScanner onScan={handleQRScan} />

            {qrError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-sm text-destructive">{qrError}</p>
              </div>
            )}

            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step: QR Complete (fill remaining fields) ── */}
        {step === "qr-complete" && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* QR-identified sensor model */}
              {qrModelMatched && selectedCatalogEntry && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Identified as <strong>{friendlySensorType(CATALOG_KIND_TO_SENSOR_TYPE[selectedCatalogEntry.sensor_kind] || "")}</strong>
                    {" "}({selectedCatalogEntry.model})
                  </span>
                </div>
              )}

              {/* Sensor Name */}
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

              {/* Read-only credentials from QR */}
              <div className="space-y-2">
                <ReadOnlyCredField label="DevEUI" value={form.getValues("dev_eui")} />
                <ReadOnlyCredField label="AppEUI" value={form.getValues("app_eui")} />
                <ReadOnlyCredField label="AppKey" value={form.getValues("app_key")} masked />
              </div>

              {/* Sensor Model — only if QR didn't match */}
              {!qrModelMatched && catalogEntries.length > 0 && (
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
                            <SelectValue placeholder="Select from catalog" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Skip — select type manually</SelectItem>
                          {catalogEntries.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {friendlySensorType(CATALOG_KIND_TO_SENSOR_TYPE[entry.sensor_kind] || "")} ({entry.model})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        QR code didn't identify the model. Select it here or choose a type below.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Sensor Type — read-only display if matched, dropdown if not */}
              {qrModelMatched ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Sensor Type</label>
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-sm">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    {friendlySensorType(form.getValues("sensor_type"))}
                  </div>
                </div>
              ) : (
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
              )}

              {/* Site */}
              <FormField
                control={form.control}
                name="site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site *</FormLabel>
                    <Select onValueChange={handleSiteChange} value={field.value || ""}>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit */}
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

              {/* Description */}
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

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSensor.isPending}>
                    {createSensor.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add Sensor
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* ── Step: Manual Entry ──────────────────── */}
        {step === "manual" && (
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
                              {friendlySensorType(CATALOG_KIND_TO_SENSOR_TYPE[entry.sensor_kind] || "")} ({entry.model})
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
                    <Select onValueChange={handleSiteChange} value={field.value || ""}>
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

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSensor.isPending}>
                    {createSensor.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add Sensor
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Read-only credential display for QR flow ──────────────────

function ReadOnlyCredField({
  label,
  value,
  masked = false,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const display = masked ? value.replace(/./g, "\u2022") : value;
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-sm font-mono">
        <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{display}</span>
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">from QR</span>
      </div>
    </div>
  );
}
