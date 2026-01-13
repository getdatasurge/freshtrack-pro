import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Battery, 
  Signal, 
  Clock, 
  Star, 
  Unlink,
  CloudUpload,
  Loader2,
  DoorOpen,
  DoorClosed,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LoraSensor } from "@/types/ttn";

interface SensorDetailsPopoverProps {
  sensor: LoraSensor;
  children: React.ReactNode;
  canEdit?: boolean;
  onSetPrimary?: () => void;
  onUnlink?: () => void;
  onProvision?: () => void;
  isProvisioning?: boolean;
  isSettingPrimary?: boolean;
  doorState?: 'open' | 'closed' | null;
  doorLastChangedAt?: string | null;
}

const formatEUI = (eui: string) => {
  return eui.match(/.{1,2}/g)?.join(":") || eui;
};

export function SensorDetailsPopover({
  sensor,
  children,
  canEdit = true,
  onSetPrimary,
  onUnlink,
  onProvision,
  isProvisioning = false,
  isSettingPrimary = false,
  doorState,
  doorLastChangedAt,
}: SensorDetailsPopoverProps) {
  const isDoorSensor = 
    sensor.sensor_type === 'door' || 
    sensor.sensor_type === 'contact';
    
  const canBePrimary = 
    sensor.sensor_type === 'temperature' || 
    sensor.sensor_type === 'temperature_humidity' || 
    sensor.sensor_type === 'combo';

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-foreground">{sensor.name}</h4>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {formatEUI(sensor.dev_eui)}
            </p>
          </div>

          <Separator />

          {/* Telemetry */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Battery className="w-3 h-3" />
                Battery
              </p>
              <p className="text-sm font-medium">
                {sensor.battery_level !== null ? `${sensor.battery_level}%` : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Signal className="w-3 h-3" />
                Signal
              </p>
              <p className="text-sm font-medium">
                {sensor.signal_strength !== null ? `${sensor.signal_strength} dBm` : "—"}
              </p>
            </div>
          </div>

          {/* Last Seen */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last Seen
            </p>
            <p className="text-sm font-medium">
              {sensor.last_seen_at 
                ? formatDistanceToNow(new Date(sensor.last_seen_at), { addSuffix: true })
                : "Never"
              }
            </p>
          </div>

          {/* Door State (for door/contact sensors) */}
          {isDoorSensor && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {doorState === 'open' ? (
                  <DoorOpen className="w-3 h-3" />
                ) : (
                  <DoorClosed className="w-3 h-3" />
                )}
                Door State
              </p>
              {doorState ? (
                <Badge 
                  variant="outline"
                  className={doorState === 'open' 
                    ? 'border-warning text-warning bg-warning/10' 
                    : 'border-safe text-safe bg-safe/10'
                  }
                >
                  {doorState === 'open' ? 'Open' : 'Closed'}
                  {doorLastChangedAt && (
                    <span className="ml-1 text-muted-foreground">
                      · {formatDistanceToNow(new Date(doorLastChangedAt), { addSuffix: true })}
                    </span>
                  )}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">Unknown</p>
              )}
            </div>
          )}

          {/* Door Sensor Label */}
          {isDoorSensor && (
            <div className="flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Door Sensor</span>
            </div>
          )}

          {/* Primary Status (only for temperature-capable sensors) */}
          {canBePrimary && (
            <div className="flex items-center gap-2">
              <Star className={`w-4 h-4 ${sensor.is_primary ? 'text-accent fill-accent' : 'text-muted-foreground'}`} />
              <span className="text-sm">
                {sensor.is_primary ? (
                  <Badge className="bg-accent/20 text-accent border-0">Primary Sensor</Badge>
                ) : (
                  "Secondary Sensor"
                )}
              </span>
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                {sensor.status === "pending" && onProvision && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onProvision}
                    disabled={isProvisioning}
                    className="w-full justify-start"
                  >
                    {isProvisioning ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CloudUpload className="w-4 h-4 mr-2 text-blue-600" />
                    )}
                    Provision to TTN
                  </Button>
                )}

                {canBePrimary && !sensor.is_primary && onSetPrimary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSetPrimary}
                    disabled={isSettingPrimary}
                    className="w-full justify-start"
                  >
                    {isSettingPrimary ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Star className="w-4 h-4 mr-2" />
                    )}
                    Set as Primary
                  </Button>
                )}

                {onUnlink && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUnlink}
                    className="w-full justify-start text-warning hover:text-warning"
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Unlink from Unit
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}