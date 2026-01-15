import { useState } from "react";
import { MapPin, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaticMapPreviewProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
}

/**
 * Converts lat/lon to tile coordinates for OpenStreetMap
 */
function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/**
 * Calculate pixel offset within the tile for the exact coordinate
 */
function getPixelOffset(
  lat: number,
  lon: number,
  zoom: number,
  tileX: number,
  tileY: number
) {
  const n = Math.pow(2, zoom);
  const xTile = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yTile =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  // Offset within tile (tiles are 256px)
  const offsetX = (xTile - tileX) * 256;
  const offsetY = (yTile - tileY) * 256;

  return { offsetX, offsetY };
}

export function StaticMapPreview({
  latitude,
  longitude,
  zoom = 12,
  className,
}: StaticMapPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Validate coordinates
  const isValidLat = latitude >= -90 && latitude <= 90;
  const isValidLon = longitude >= -180 && longitude <= 180;

  if (!isValidLat || !isValidLon) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md border",
          className
        )}
      >
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span className="text-xs">Invalid coordinates</span>
        </div>
      </div>
    );
  }

  const { x, y } = latLonToTile(latitude, longitude, zoom);
  const { offsetX, offsetY } = getPixelOffset(latitude, longitude, zoom, x, y);

  // Build tile URL - using OpenStreetMap's tile server
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;

  if (imageError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md border",
          className
        )}
      >
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <MapPin className="h-5 w-5" />
          <span className="text-xs">
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-muted",
        className
      )}
    >
      {/* Loading state */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <MapPin className="h-5 w-5 animate-pulse" />
            <span className="text-xs">Loading map...</span>
          </div>
        </div>
      )}

      {/* Map tile - single centered tile with overflow hidden to prevent modal overflow */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={tileUrl}
          alt=""
          className="absolute w-[256px] h-[256px] object-cover"
          style={{
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% - ${offsetX - 128}px), calc(-50% - ${offsetY - 128}px))`,
          }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          crossOrigin="anonymous"
        />
      </div>

      {/* Pin marker - centered */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -100%)",
        }}
      >
        <div className="relative">
          <MapPin className="h-8 w-8 text-destructive drop-shadow-lg fill-destructive/20" />
        </div>
      </div>

      {/* Coordinates overlay */}
      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/80 rounded text-[10px] text-muted-foreground backdrop-blur-sm">
        {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </div>

      {/* Attribution (required by OSM) */}
      <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-background/80 rounded text-[8px] text-muted-foreground backdrop-blur-sm">
        © OpenStreetMap
      </div>
    </div>
  );
}
