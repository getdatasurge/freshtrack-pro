import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateGateway } from "@/hooks/useGateways";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, QrCode, PenLine, ArrowLeft, Lock } from "lucide-react";
import { QRScanner } from "@/components/QRScanner";
import { parseGatewayQR, formatGatewayEUI } from "@/lib/qr/gatewayQR";

// Gateway EUI must be exactly 16 hex characters
const EUI_REGEX = /^[0-9A-Fa-f]{16}$/;

const addGatewaySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  gateway_eui: z
    .string()
    .regex(EUI_REGEX, "Gateway EUI must be exactly 16 hexadecimal characters"),
  site_id: z.string().optional(),
  description: z.string().max(500, "Description is too long").optional(),
});

type AddGatewayFormData = z.infer<typeof addGatewaySchema>;

interface Site {
  id: string;
  name: string;
}

interface AddGatewayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  sites: Site[];
  defaultSiteId?: string;
}

type ModalStep = "method-select" | "qr-scan" | "qr-complete" | "manual";

export function AddGatewayDialog({
  open,
  onOpenChange,
  organizationId,
  sites,
  defaultSiteId,
}: AddGatewayDialogProps) {
  const createGateway = useCreateGateway();
  const [step, setStep] = useState<ModalStep>("method-select");
  const [qrError, setQrError] = useState<string | null>(null);

  const form = useForm<AddGatewayFormData>({
    resolver: zodResolver(addGatewaySchema),
    defaultValues: {
      name: "",
      gateway_eui: "",
      site_id: defaultSiteId || undefined,
      description: "",
    },
  });

  const handleQRScan = useCallback(
    (raw: string) => {
      setQrError(null);
      const eui = parseGatewayQR(raw);
      if (eui) {
        form.setValue("gateway_eui", eui, { shouldValidate: true });
        setStep("qr-complete");
      } else {
        setQrError(
          "Could not extract Gateway EUI from QR code. Expected SenseCAP format. Try manual entry."
        );
      }
    },
    [form]
  );

  const onSubmit = async (data: AddGatewayFormData) => {
    try {
      await createGateway.mutateAsync({
        organization_id: organizationId,
        name: data.name,
        gateway_eui: data.gateway_eui.toUpperCase(),
        site_id: data.site_id === "none" ? null : data.site_id || null,
        description: data.description || null,
      });

      resetAll();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const resetAll = () => {
    form.reset({
      name: "",
      gateway_eui: "",
      site_id: defaultSiteId || undefined,
      description: "",
    });
    setStep("method-select");
    setQrError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetAll();
    }
    onOpenChange(newOpen);
  };

  const handleBack = () => {
    if (step === "qr-scan" || step === "manual") {
      resetAll();
    } else if (step === "qr-complete") {
      form.setValue("gateway_eui", "");
      setQrError(null);
      setStep("qr-scan");
    }
  };

  const stepTitle: Record<ModalStep, string> = {
    "method-select": "Add Gateway",
    "qr-scan": "Scan Gateway QR Code",
    "qr-complete": "Complete Gateway Setup",
    manual: "Add Gateway \u2014 Manual Entry",
  };

  const stepDescription: Record<ModalStep, string> = {
    "method-select": "Choose how you'd like to register your gateway.",
    "qr-scan":
      "Point your camera at the gateway's QR code, or paste the code data below.",
    "qr-complete":
      "Gateway EUI loaded from QR code. Fill in the remaining details.",
    manual:
      "Register a new LoRaWAN gateway by entering its EUI and details manually.",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
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
                  Auto-fill Gateway EUI from label
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
                  Enter Gateway EUI manually
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBack}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step: QR Complete (fill remaining fields) ── */}
        {step === "qr-complete" && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Read-only EUI from QR */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Gateway EUI</label>
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border text-sm font-mono">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {formatGatewayEUI(form.getValues("gateway_eui"))}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    from QR
                  </span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Building Gateway" {...field} />
                    </FormControl>
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
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No site</SelectItem>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Associate this gateway with a specific site
                    </FormDescription>
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
                        placeholder="Gateway location or notes..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createGateway.isPending}>
                    {createGateway.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Gateway"
                    )}
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
                name="gateway_eui"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway EUI</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="A1B2C3D4E5F67890"
                        className="font-mono uppercase"
                        maxLength={16}
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(
                            /[^0-9A-Fa-f]/g,
                            ""
                          );
                          field.onChange(value.toUpperCase());
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      16 hexadecimal characters (found on gateway label)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Building Gateway" {...field} />
                    </FormControl>
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
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No site</SelectItem>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Associate this gateway with a specific site
                    </FormDescription>
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
                        placeholder="Gateway location or notes..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createGateway.isPending}>
                    {createGateway.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Gateway"
                    )}
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
