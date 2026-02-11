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
import { Loader2, ScanLine, Keyboard } from "lucide-react";
import { QRScanner } from "@/components/QRScanner";
import { parseGatewayQR, formatGatewayEUI } from "@/lib/qr/gatewayQR";
import { useToast } from "@/hooks/use-toast";

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

export function AddGatewayDialog({
  open,
  onOpenChange,
  organizationId,
  sites,
  defaultSiteId,
}: AddGatewayDialogProps) {
  const createGateway = useCreateGateway();
  const { toast } = useToast();
  const [showScanner, setShowScanner] = useState(true);

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
      const eui = parseGatewayQR(raw);
      if (eui) {
        form.setValue("gateway_eui", eui, { shouldValidate: true });
        setShowScanner(false);
        toast({
          title: "Gateway EUI Extracted",
          description: `EUI: ${formatGatewayEUI(eui)}`,
        });
      } else {
        toast({
          title: "Could not extract Gateway EUI from QR code",
          description: "Expected SenseCAP format. Try pasting the raw text or enter manually.",
          variant: "destructive",
        });
      }
    },
    [form, toast]
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
      
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset({
        name: "",
        gateway_eui: "",
        site_id: defaultSiteId || undefined,
        description: "",
      });
      setShowScanner(true);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Gateway</DialogTitle>
          <DialogDescription>
            Register a new LoRaWAN gateway to receive sensor data wirelessly.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* QR Scanner Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Scan Gateway QR</span>
                {showScanner ? (
                  <button
                    type="button"
                    onClick={() => setShowScanner(false)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Keyboard className="w-3 h-3" />
                    Enter Manually
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ScanLine className="w-3 h-3" />
                    Scan QR Instead
                  </button>
                )}
              </div>
              {showScanner && <QRScanner onScan={handleQRScan} />}
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
              name="gateway_eui"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gateway EUI</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="A1B2C3D4E5F67890"
                      className="font-mono"
                      maxLength={16}
                      {...field}
                      onChange={(e) => {
                        // Only allow hex characters
                        const value = e.target.value.replace(/[^0-9A-Fa-f]/g, "");
                        field.onChange(value.toUpperCase());
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    16-character hexadecimal identifier from your gateway
                  </FormDescription>
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
            
            <DialogFooter>
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
