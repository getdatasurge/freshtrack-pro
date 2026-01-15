/**
 * Site Location Modal
 * 
 * Reusable modal for editing site latitude, longitude, and timezone.
 * Features address geocoding search and static map preview.
 * Used by the External Weather widget for inline location configuration.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Globe, ExternalLink, Info, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSiteLocationMutation } from "@/hooks/useSiteLocationMutation";
import { Link } from "react-router-dom";
import { AddressSearchInput } from "./AddressSearchInput";
import { StaticMapPreview } from "./StaticMapPreview";
import { GeocodingResult } from "@/lib/geocoding/geocodingService";

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

/**
 * Simple timezone estimation based on longitude
 * Returns a reasonable timezone for the given longitude
 */
function estimateTimezoneFromLongitude(longitude: number): string {
  // Rough timezone zones by longitude
  if (longitude >= -180 && longitude < -150) return "Pacific/Honolulu";
  if (longitude >= -150 && longitude < -135) return "America/Anchorage";
  if (longitude >= -135 && longitude < -115) return "America/Los_Angeles";
  if (longitude >= -115 && longitude < -100) return "America/Denver";
  if (longitude >= -100 && longitude < -85) return "America/Chicago";
  if (longitude >= -85 && longitude < -60) return "America/New_York";
  if (longitude >= -10 && longitude < 5) return "Europe/London";
  if (longitude >= 5 && longitude < 30) return "Europe/Paris";
  if (longitude >= 120 && longitude < 150) return "Asia/Tokyo";
  if (longitude >= 150 && longitude <= 180) return "Australia/Sydney";
  return "America/New_York"; // Default fallback
}

const locationSchema = z.object({
  latitude: z
    .number({ required_error: "Latitude is required", invalid_type_error: "Latitude must be a number" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number({ required_error: "Longitude is required", invalid_type_error: "Longitude must be a number" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  timezone: z.string().min(1, "Timezone is required"),
});

type LocationFormData = z.infer<typeof locationSchema>;

export interface SiteLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentTimezone: string;
  canEdit: boolean;
  onSaved?: () => void;
}

export function SiteLocationModal({
  open,
  onOpenChange,
  siteId,
  currentLatitude,
  currentLongitude,
  currentTimezone,
  canEdit,
  onSaved,
}: SiteLocationModalProps) {
  const mutation = useSiteLocationMutation(siteId);

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      latitude: currentLatitude ?? undefined,
      longitude: currentLongitude ?? undefined,
      timezone: currentTimezone || "America/New_York",
    },
  });

  // Watch form values for map preview
  const watchedLatitude = form.watch("latitude");
  const watchedLongitude = form.watch("longitude");
  const hasValidCoordinates =
    typeof watchedLatitude === "number" &&
    typeof watchedLongitude === "number" &&
    !isNaN(watchedLatitude) &&
    !isNaN(watchedLongitude);

  // Reset form when modal opens with new values
  useEffect(() => {
    if (open) {
      form.reset({
        latitude: currentLatitude ?? undefined,
        longitude: currentLongitude ?? undefined,
        timezone: currentTimezone || "America/New_York",
      });
    }
  }, [open, currentLatitude, currentLongitude, currentTimezone, form]);

  const handleAddressSelect = (result: GeocodingResult) => {
    form.setValue("latitude", result.latitude, { shouldValidate: true });
    form.setValue("longitude", result.longitude, { shouldValidate: true });
    
    // Auto-suggest timezone based on longitude
    const suggestedTimezone = estimateTimezoneFromLongitude(result.longitude);
    form.setValue("timezone", suggestedTimezone);
  };

  const onSubmit = async (data: LocationFormData) => {
    await mutation.mutateAsync({
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
    });
    onSaved?.();
    onOpenChange(false);
  };

  // If user can't edit, show informational dialog
  if (!canEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Site Location
            </DialogTitle>
            <DialogDescription>
              Location configuration for weather data
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to edit site location. Please contact
              your administrator to update this setting.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Set Site Location
          </DialogTitle>
          <DialogDescription>
            Search for an address or enter coordinates manually.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-1">
              {/* Address Search */}
              <div className="space-y-2 min-w-0">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  Search Address
                </Label>
                <AddressSearchInput
                  onSelect={handleAddressSelect}
                  placeholder="Search city, address, or ZIP..."
                />
                <p className="text-xs text-muted-foreground">
                  Search for an address to auto-fill coordinates
                </p>
              </div>

              {/* Lat/Lon Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="40.7128"
                          className="w-full"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="-74.0060"
                          className="w-full"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Timezone */}
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      Timezone
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Map Preview */}
              {hasValidCoordinates && (
                <div className="space-y-2 min-w-0">
                  <Label className="text-xs text-muted-foreground">
                    Location Preview
                  </Label>
                  <StaticMapPreview
                    latitude={watchedLatitude}
                    longitude={watchedLongitude}
                    className="h-32 w-full"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                asChild
                className="sm:mr-auto"
              >
                <Link to={`/sites/${siteId}?tab=settings`}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open Site Settings
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save Location"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
