/**
 * External Weather Widget
 * 
 * Displays current weather conditions and hourly forecast for the site location.
 * Requires site latitude/longitude to be configured.
 * Includes auto-prompt for setting location and edit icon.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CloudSun, MapPin, Wind, Droplets, RefreshCw, AlertCircle, Pencil } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { usePermissions } from "@/hooks/useUserRole";
import { getWeatherCondition, getConditionBgClass, getConditionTextClass } from "@/lib/weather/weatherConditions";
import { isValidLocation } from "@/lib/weather/weatherService";
import { format } from "date-fns";
import { SiteLocationModal } from "@/components/site/SiteLocationModal";
import type { WidgetProps } from "../types";

export function ExternalWeatherWidget({ 
  site, 
  recentlyAddedWidgetId,
  onClearRecentlyAdded,
  onSiteLocationChange,
}: WidgetProps & { onSiteLocationChange?: () => void }) {
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const { canManageSites } = usePermissions();
  
  const hasLocation = isValidLocation(site?.latitude, site?.longitude);
  
  const { 
    data: weather, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useWeather(
    site?.latitude,
    site?.longitude,
    site?.timezone
  );

  // Auto-prompt when widget was just added and location is missing
  useEffect(() => {
    if (
      recentlyAddedWidgetId === "external-weather" &&
      !hasLocation &&
      canManageSites
    ) {
      setLocationModalOpen(true);
      onClearRecentlyAdded?.();
    }
  }, [recentlyAddedWidgetId, hasLocation, canManageSites, onClearRecentlyAdded]);

  // No location configured - show CTA
  if (!hasLocation) {
    return (
      <>
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CloudSun className="h-4 w-4" />
              External Weather
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="p-3 rounded-full bg-muted">
              <MapPin className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Location Required</p>
              <p className="text-xs text-muted-foreground mt-1">
                Set site location to enable weather data
              </p>
            </div>
            {canManageSites ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLocationModalOpen(true)}
              >
                <MapPin className="h-3 w-3 mr-1" />
                Set Location
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Contact your admin to configure site location
              </p>
            )}
          </CardContent>
        </Card>
        
        <SiteLocationModal
          open={locationModalOpen}
          onOpenChange={setLocationModalOpen}
          siteId={site?.id || ""}
          currentLatitude={site?.latitude ?? null}
          currentLongitude={site?.longitude ?? null}
          currentTimezone={site?.timezone || "America/New_York"}
          canEdit={canManageSites}
          onSaved={() => {
            onSiteLocationChange?.();
            refetch();
          }}
        />
      </>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CloudSun className="h-4 w-4" />
            External Weather
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-16 flex-1" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !weather) {
    return (
      <>
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CloudSun className="h-4 w-4" />
                External Weather
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setLocationModalOpen(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit site location</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium">Weather Unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error?.message || "Unable to fetch weather data"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
        
        <SiteLocationModal
          open={locationModalOpen}
          onOpenChange={setLocationModalOpen}
          siteId={site?.id || ""}
          currentLatitude={site?.latitude ?? null}
          currentLongitude={site?.longitude ?? null}
          currentTimezone={site?.timezone || "America/New_York"}
          canEdit={canManageSites}
          onSaved={() => {
            onSiteLocationChange?.();
            refetch();
          }}
        />
      </>
    );
  }

  const currentCondition = getWeatherCondition(weather.current.conditionCode);
  const ConditionIcon = currentCondition.icon;

  // Get next 6 hours of forecast
  const now = new Date();
  const hourlyForecast = weather.hourly
    .filter((h) => new Date(h.time) > now)
    .slice(0, 6);

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CloudSun className="h-4 w-4" />
              External Weather
            </CardTitle>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setLocationModalOpen(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit site location</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <RefreshCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          {/* Current conditions */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${getConditionBgClass(currentCondition.category)}`}>
              <ConditionIcon className={`h-10 w-10 ${getConditionTextClass(currentCondition.category)}`} />
            </div>
            <div>
              <p className="text-3xl font-bold">{Math.round(weather.current.temperature)}°</p>
              <p className="text-sm text-muted-foreground">{currentCondition.description}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Droplets className="h-4 w-4" />
              <span>{weather.current.humidity}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="h-4 w-4" />
              <span>{Math.round(weather.current.windSpeed)} km/h</span>
            </div>
          </div>

          {/* Hourly forecast */}
          {hourlyForecast.length > 0 && (
            <div className="mt-auto">
              <p className="text-xs text-muted-foreground mb-2">Next 6 hours</p>
              <div className="flex gap-1">
                {hourlyForecast.map((hour) => {
                  const condition = getWeatherCondition(hour.conditionCode);
                  const HourIcon = condition.icon;
                  return (
                    <div 
                      key={hour.time}
                      className="flex-1 flex flex-col items-center p-2 rounded bg-muted/50"
                    >
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(hour.time), "ha")}
                      </span>
                      <HourIcon className={`h-4 w-4 my-1 ${getConditionTextClass(condition.category)}`} />
                      <span className="text-sm font-medium">{Math.round(hour.temperature)}°</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last updated */}
          <p className="text-xs text-muted-foreground text-center">
            Updated {format(new Date(weather.current.lastUpdated), "h:mm a")}
          </p>
        </CardContent>
      </Card>
      
      <SiteLocationModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        siteId={site?.id || ""}
        currentLatitude={site?.latitude ?? null}
        currentLongitude={site?.longitude ?? null}
        currentTimezone={site?.timezone || "America/New_York"}
        canEdit={canManageSites}
        onSaved={() => {
          onSiteLocationChange?.();
          refetch();
        }}
      />
    </>
  );
}
