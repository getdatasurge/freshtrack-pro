import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateGateway } from "@/hooks/useGateways";
import { Gateway } from "@/types/ttn";
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
import { Loader2 } from "lucide-react";

const editGatewaySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  site_id: z.string().optional(),
  description: z.string().max(500, "Description is too long").optional(),
});

type EditGatewayFormData = z.infer<typeof editGatewaySchema>;

interface Site {
  id: string;
  name: string;
}

interface EditGatewayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gateway: Gateway;
  sites: Site[];
}

export function EditGatewayDialog({
  open,
  onOpenChange,
  gateway,
  sites,
}: EditGatewayDialogProps) {
  const updateGateway = useUpdateGateway();
  
  const form = useForm<EditGatewayFormData>({
    resolver: zodResolver(editGatewaySchema),
    defaultValues: {
      name: gateway.name,
      site_id: gateway.site_id || "none",
      description: gateway.description || "",
    },
  });

  // Reset form when gateway changes
  useEffect(() => {
    form.reset({
      name: gateway.name,
      site_id: gateway.site_id || "none",
      description: gateway.description || "",
    });
  }, [gateway, form]);

  const onSubmit = async (data: EditGatewayFormData) => {
    try {
      await updateGateway.mutateAsync({
        id: gateway.id,
        updates: {
          name: data.name,
          site_id: data.site_id === "none" ? null : data.site_id || null,
          description: data.description || null,
        },
      });
      
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const formatEUI = (eui: string): string => {
    return eui.toUpperCase().match(/.{2}/g)?.join(":") || eui.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Gateway</DialogTitle>
          <DialogDescription>
            Update gateway settings. Gateway EUI cannot be changed after registration.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            
            <div className="space-y-2">
              <FormLabel>Gateway EUI</FormLabel>
              <Input 
                value={formatEUI(gateway.gateway_eui)}
                disabled
                className="font-mono bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Gateway EUI cannot be changed after registration
              </p>
            </div>
            
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateGateway.isPending}>
                {updateGateway.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
