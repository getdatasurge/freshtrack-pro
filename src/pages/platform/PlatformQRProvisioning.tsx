import { useState, useRef, useEffect, useCallback } from "react";
import PlatformLayout from "@/components/platform/PlatformLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  Download,
  Copy,
  Check,
  Camera,
  ClipboardPaste,
  Info,
  X,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import {
  encodeCredentials,
  decodeCredentials,
  isValidHex,
  cleanHex,
  formatEUI,
  type SensorCredentials,
} from "@/lib/qr/sensorQR";

// ─── Hex Input with validation ─────────────────────────────────

function HexField({
  label,
  value,
  onChange,
  expectedLength,
  placeholder,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  expectedLength: number;
  placeholder: string;
  helpText?: string;
}) {
  const cleaned = cleanHex(value);
  const valid = isValidHex(value, expectedLength);
  const hasInput = cleaned.length > 0;

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm pr-8"
          spellCheck={false}
        />
        {hasInput && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm">
            {valid ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <X className="w-4 h-4 text-red-400" />
            )}
          </span>
        )}
      </div>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
      {hasInput && !valid && (
        <p className="text-xs text-red-400">
          Expected {expectedLength} hex characters ({expectedLength / 2} bytes), got {cleaned.length}
        </p>
      )}
    </div>
  );
}

// ─── Generate Tab ──────────────────────────────────────────────

function GenerateTab() {
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [devEui, setDevEui] = useState("");
  const [appEui, setAppEui] = useState("");
  const [appKey, setAppKey] = useState("");
  const [generated, setGenerated] = useState<{ qrValue: string; creds: SensorCredentials } | null>(null);
  const [copied, setCopied] = useState(false);

  const allValid =
    isValidHex(devEui, 16) &&
    isValidHex(appEui, 16) &&
    isValidHex(appKey, 32);

  const handleGenerate = () => {
    const creds: SensorCredentials = {
      serial_number: serialNumber.trim(),
      dev_eui: cleanHex(devEui),
      app_eui: cleanHex(appEui),
      app_key: cleanHex(appKey),
    };
    const qrValue = encodeCredentials(creds);
    setGenerated({ qrValue, creds });
  };

  const handleDownloadPNG = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `frostguard-qr-${generated?.creds.dev_eui || "sensor"}.png`;
    a.click();
  };

  const handleCopyJSON = async () => {
    if (!generated) return;
    const json = JSON.stringify(generated.creds, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    toast({ title: "Copied", description: "Credentials JSON copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Input fields */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Serial Number</Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. LHT65N-001"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Printed on label &middot; not stored in QR code
            </p>
          </div>

          <HexField
            label="DEV EUI"
            value={devEui}
            onChange={setDevEui}
            expectedLength={16}
            placeholder="A8:40:41:5A:61:89:77:57"
            helpText="8-byte device identifier (16 hex chars)"
          />

          <HexField
            label="APP EUI"
            value={appEui}
            onChange={setAppEui}
            expectedLength={16}
            placeholder="A8:40:41:00:00:00:01:07"
            helpText="8-byte application identifier (16 hex chars)"
          />

          <HexField
            label="APP KEY"
            value={appKey}
            onChange={setAppKey}
            expectedLength={32}
            placeholder="2B7E151628AED2A6ABF7158809CF4F3C"
            helpText="16-byte application key (32 hex chars)"
          />

          <Button
            onClick={handleGenerate}
            disabled={!allValid}
            className="w-full"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Generate QR Code
          </Button>
        </CardContent>
      </Card>

      {/* Generated output */}
      {generated && (
        <div className="space-y-4">
          {/* Label preview */}
          <Card>
            <CardContent className="p-5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                Label Preview
              </Label>
              <div className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200">
                <div ref={qrRef} className="shrink-0">
                  <QRCodeCanvas
                    value={generated.qrValue.toUpperCase()}
                    size={80}
                    level="L"
                    marginSize={1}
                  />
                </div>
                <div className="min-w-0">
                  {generated.creds.serial_number && (
                    <div className="text-black font-bold text-sm font-mono">
                      {generated.creds.serial_number}
                    </div>
                  )}
                  <div className="text-gray-600 text-xs font-mono mt-0.5">
                    {formatEUI(generated.creds.dev_eui)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Full-size QR */}
          <Card>
            <CardContent className="p-5 flex flex-col items-center">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block w-full">
                Full-Size QR Code
              </Label>
              <div className="bg-white rounded-lg p-4 inline-block">
                <QRCodeCanvas
                  value={generated.qrValue.toUpperCase()}
                  size={200}
                  level="L"
                  marginSize={2}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center font-mono">
                {generated.qrValue.length} chars &middot; QR Alphanumeric &middot; EC Level L
              </p>
            </CardContent>
          </Card>

          {/* Info callout */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              QR contains only keys ({generated.qrValue.length} chars). Serial number is printed on the physical label.
            </p>
          </div>

          {/* Credential summary */}
          <Card>
            <CardContent className="p-5 space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Credential Summary
              </Label>
              {generated.creds.serial_number && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 text-xs">
                    Serial
                  </Badge>
                  <span className="font-mono text-sm">{generated.creds.serial_number}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 text-xs">
                  DEV EUI
                </Badge>
                <span className="font-mono text-sm">{formatEUI(generated.creds.dev_eui)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 text-xs">
                  APP EUI
                </Badge>
                <span className="font-mono text-sm">{formatEUI(generated.creds.app_eui)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs">
                  APP KEY
                </Badge>
                <span className="font-mono text-sm break-all">{generated.creds.app_key}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyJSON}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy JSON"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scan Tab ──────────────────────────────────────────────────

function ScanTab() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<SensorCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleDecode = useCallback(
    (raw: string) => {
      const decoded = decodeCredentials(raw.trim());
      if (decoded) {
        setResult(decoded);
        stopCamera();
        toast({ title: "QR Decoded", description: `DEV EUI: ${formatEUI(decoded.dev_eui)}` });
      } else {
        toast({ title: "Invalid QR", description: "Not a recognized FrostGuard sensor QR code.", variant: "destructive" });
      }
    },
    [stopCamera, toast]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setResult(null);

    if (!("BarcodeDetector" in window)) {
      setCameraError("BarcodeDetector API not supported in this browser. Use the manual paste below.");
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
            handleDecode(barcodes[0].rawValue);
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
      setCameraError(
        err instanceof Error ? err.message : "Failed to access camera."
      );
    }
  }, [handleDecode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleManualDecode = () => {
    if (manualInput.trim()) {
      handleDecode(manualInput);
    }
  };

  const handleCopyField = async (field: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Camera scanner */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Camera Scanner
          </Label>

          {!scanning && !cameraError && (
            <Button onClick={startCamera} variant="outline" className="w-full">
              <Camera className="w-4 h-4 mr-2" />
              Start Camera Scanner
            </Button>
          )}

          {scanning && (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full"
                playsInline
                muted
              />
              {/* Green scanning frame overlay */}
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
          )}

          {cameraError && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">{cameraError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual paste fallback */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Manual Paste
          </Label>
          <Textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Paste QR code raw data here..."
            className="font-mono text-sm min-h-[80px]"
            spellCheck={false}
          />
          <Button
            onClick={handleManualDecode}
            disabled={!manualInput.trim()}
            variant="outline"
            className="w-full"
          >
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Decode
          </Button>
        </CardContent>
      </Card>

      {/* Scan result */}
      {result && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Decoded Credentials
            </Label>

            {[
              { label: "Serial", value: result.serial_number, color: "text-purple-600 dark:text-purple-400" },
              { label: "DEV EUI", value: result.dev_eui ? formatEUI(result.dev_eui) : "", raw: result.dev_eui, color: "text-green-600 dark:text-green-400" },
              { label: "APP EUI", value: result.app_eui ? formatEUI(result.app_eui) : "", raw: result.app_eui, color: "text-blue-600 dark:text-blue-400" },
              { label: "APP KEY", value: result.app_key, color: "text-amber-600 dark:text-amber-400" },
            ].map(
              (field) =>
                (field.value || field.label === "Serial") && (
                  <div key={field.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-semibold shrink-0 ${field.color}`}>
                        {field.label}
                      </span>
                      {field.value ? (
                        <span className="font-mono text-sm truncate">{field.value}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Printed on physical label
                        </span>
                      )}
                    </div>
                    {field.value && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-7 w-7"
                        onClick={() => handleCopyField(field.label, field.raw || field.value)}
                      >
                        {copiedField === field.label ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                )
            )}

            {!result.serial_number && (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5 mt-2">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Serial number is printed on the physical label — not stored in the QR code.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────

export default function PlatformQRProvisioning() {
  return (
    <PlatformLayout title="QR Provisioning">
      {/* Header section */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 dark:from-slate-700 dark:to-slate-900">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Sensor QR Provisioning</h2>
            <p className="text-sm text-muted-foreground">
              Generate and scan LoRaWAN credential QR codes for physical labels
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="generate" className="text-sm">
            <QrCode className="w-4 h-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="scan" className="text-sm">
            <Camera className="w-4 h-4 mr-2" />
            Scan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <GenerateTab />
        </TabsContent>
        <TabsContent value="scan">
          <ScanTab />
        </TabsContent>
      </Tabs>
    </PlatformLayout>
  );
}
