import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, ClipboardPaste, X, Info } from "lucide-react";

interface QRScannerProps {
  onScan: (rawValue: string) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (!("BarcodeDetector" in window)) {
      const msg = "BarcodeDetector API not supported in this browser. Use the manual paste below.";
      setCameraError(msg);
      onError?.(msg);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

      const scanFrame = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const barcodes: any[] = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            stopCamera();
            onScan(barcodes[0].rawValue);
            return;
          }
        } catch {
          // frame detection error — continue scanning
        }
        if (streamRef.current) {
          requestAnimationFrame(scanFrame);
        }
      };
      requestAnimationFrame(scanFrame);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to access camera.";
      setCameraError(msg);
      onError?.(msg);
    }
  }, [onScan, onError, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleManualDecode = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera scanner */}
      {!scanning && !cameraError && (
        <Button onClick={startCamera} variant="outline" className="w-full">
          <Camera className="w-4 h-4 mr-2" />
          Start Camera Scanner
        </Button>
      )}

      {/* Video element always rendered so videoRef is available when stream starts */}
      <div className={`relative rounded-lg overflow-hidden bg-black ${scanning ? "" : "hidden"}`}>
        <video
          ref={videoRef}
          className="w-full"
          playsInline
          muted
        />
        <div className="absolute inset-4 border-2 border-green-400 rounded-lg pointer-events-none opacity-60" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-300 font-medium">Scanning...</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={stopCamera}
          className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {cameraError && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">{cameraError}</p>
        </div>
      )}

      {/* Manual paste fallback */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Or paste QR code data manually
        </Label>
        <Textarea
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Paste QR code raw data here..."
          className="font-mono text-sm min-h-[60px]"
          spellCheck={false}
        />
        <Button
          onClick={handleManualDecode}
          disabled={!manualInput.trim()}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <ClipboardPaste className="w-4 h-4 mr-2" />
          Decode
        </Button>
      </div>
    </div>
  );
}
