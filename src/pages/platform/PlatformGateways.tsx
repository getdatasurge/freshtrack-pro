import { useState, useEffect, useCallback } from "react";
import PlatformLayout from "@/components/platform/PlatformLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRScanner } from "@/components/QRScanner";
import {
  parseGatewayQR,
  formatGatewayEUI,
  isValidGatewayEUI,
  cleanGatewayEUI,
} from "@/lib/qr/gatewayQR";
import {
  Radio,
  Plus,
  List,
  Pencil,
  Trash2,
  Check,
  Info,
  Keyboard,
  ScanLine,
} from "lucide-react";
import type { Gateway } from "@/types/ttn";

// ─── Types ──────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  slug: string;
}

const FREQUENCY_PLANS = [
  { value: "US_902_928_FSB_2", label: "US 902-928 FSB 2" },
  { value: "EU_863_870_TTN", label: "EU 863-870 (TTN)" },
  { value: "AU_915_928_FSB_2", label: "AU 915-928 FSB 2" },
] as const;

// ─── Add Gateway Tab ────────────────────────────────────────────

function AddGatewayTab({ onGatewayAdded }: { onGatewayAdded: () => void }) {
  const { toast } = useToast();

  // Organizations
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);

  // Form state
  const [gatewayName, setGatewayName] = useState("");
  const [gatewayEUI, setGatewayEUI] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [frequencyPlan, setFrequencyPlan] = useState("US_902_928_FSB_2");
  const [placementNotes, setPlacementNotes] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [euiFromQR, setEuiFromQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [duplicateOrg, setDuplicateOrg] = useState<string | null>(null);

  // Load organizations
  useEffect(() => {
    async function loadOrgs() {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .order("name");
      if (!error && data) {
        setOrganizations(data);
      }
      setOrgsLoading(false);
    }
    loadOrgs();
  }, []);

  // Check for duplicate EUI
  useEffect(() => {
    const clean = cleanGatewayEUI(gatewayEUI);
    if (clean.length !== 16) {
      setDuplicateOrg(null);
      return;
    }

    let cancelled = false;
    async function checkDuplicate() {
      const { data } = await supabase
        .from("gateways")
        .select("id, organization_id")
        .eq("gateway_eui", clean)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        const org = organizations.find((o) => o.id === data.organization_id);
        setDuplicateOrg(org?.name ?? "another organization");
      } else {
        setDuplicateOrg(null);
      }
    }
    checkDuplicate();
    return () => { cancelled = true; };
  }, [gatewayEUI, organizations]);

  const handleQRScan = useCallback(
    (raw: string) => {
      const eui = parseGatewayQR(raw);
      if (eui) {
        setGatewayEUI(eui);
        setEuiFromQR(true);
        setManualMode(false);
        toast({
          title: "Gateway EUI Extracted",
          description: `EUI: ${formatGatewayEUI(eui)}`,
        });
      } else {
        toast({
          title: "Could not extract Gateway EUI from QR code",
          description: "Expected SenseCAP format: G1-XXXXX;EUI;... — try pasting the raw text.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const cleanEUI = cleanGatewayEUI(gatewayEUI);
  const euiValid = isValidGatewayEUI(gatewayEUI);
  const formValid =
    gatewayName.trim() !== "" &&
    euiValid &&
    organizationId !== "" &&
    !duplicateOrg;

  const handleSubmit = async () => {
    if (!formValid) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Build description with frequency plan and placement notes
      const descParts: string[] = [];
      if (frequencyPlan) descParts.push(`Frequency Plan: ${frequencyPlan}`);
      if (placementNotes.trim()) descParts.push(placementNotes.trim());
      const description = descParts.length > 0 ? descParts.join("\n") : null;

      const { error } = await supabase.from("gateways").insert({
        gateway_eui: cleanEUI,
        name: gatewayName.trim(),
        organization_id: organizationId,
        description,
        status: "pending" as const,
        created_by: user?.id ?? null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Duplicate Gateway EUI",
            description: "This gateway EUI is already registered.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: "Gateway Registered", description: `${gatewayName.trim()} has been added.` });
      setSubmitted(true);
      onGatewayAdded();
    } catch (err) {
      toast({
        title: "Registration Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAnother = () => {
    setGatewayName("");
    setGatewayEUI("");
    setOrganizationId("");
    setFrequencyPlan("US_902_928_FSB_2");
    setPlacementNotes("");
    setManualMode(false);
    setEuiFromQR(false);
    setSubmitted(false);
    setDuplicateOrg(null);
  };

  // ── Success state ──
  if (submitted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Gateway Registered</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {gatewayName} ({formatGatewayEUI(cleanEUI)}) has been registered.
              </p>
            </div>
            <Button variant="outline" disabled className="w-full opacity-60">
              Register on TTN (Coming Soon)
            </Button>
            <Button onClick={handleAddAnother} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Another Gateway
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="space-y-6">
      {/* QR Scanner / Manual Toggle */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gateway EUI
            </Label>
            {!manualMode ? (
              <button
                onClick={() => { setManualMode(true); setEuiFromQR(false); }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Keyboard className="w-3 h-3" />
                Enter Manually
              </button>
            ) : (
              <button
                onClick={() => setManualMode(false)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ScanLine className="w-3 h-3" />
                Scan QR Instead
              </button>
            )}
          </div>

          {!manualMode && (
            <QRScanner onScan={handleQRScan} />
          )}

          {/* EUI display / input */}
          {(manualMode || euiFromQR) && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Gateway EUI</Label>
              <div className="relative">
                <Input
                  value={gatewayEUI}
                  onChange={(e) => {
                    setGatewayEUI(e.target.value);
                    setEuiFromQR(false);
                  }}
                  readOnly={euiFromQR && !manualMode}
                  placeholder="2CF7F1117280001E"
                  className="font-mono text-sm uppercase pr-8"
                  maxLength={16}
                  spellCheck={false}
                />
                {cleanEUI.length > 0 && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {euiValid ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-red-400">
                        {cleanEUI.length}/16
                      </span>
                    )}
                  </span>
                )}
              </div>
              {euiValid && (
                <p className="text-xs text-muted-foreground font-mono">
                  {formatGatewayEUI(cleanEUI)}
                </p>
              )}
              {cleanEUI.length > 0 && !euiValid && (
                <p className="text-xs text-red-400">
                  Expected 16 hex characters (8 bytes), got {cleanEUI.length}
                </p>
              )}
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateOrg && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This gateway is already registered to <strong>{duplicateOrg}</strong>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gateway Details Form */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Gateway Details
          </Label>

          {/* Gateway Name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Gateway Name <span className="text-red-400">*</span>
            </Label>
            <Input
              value={gatewayName}
              onChange={(e) => setGatewayName(e.target.value)}
              placeholder='e.g. "Main Dining Gateway"'
              className="text-sm"
            />
          </div>

          {/* Organization */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Organization <span className="text-red-400">*</span>
            </Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={orgsLoading ? "Loading organizations..." : "Select an organization"}
                />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequency Plan */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Frequency Plan</Label>
            <Select value={frequencyPlan} onValueChange={setFrequencyPlan}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_PLANS.map((fp) => (
                  <SelectItem key={fp.value} value={fp.value}>
                    {fp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used when registering on TTN
            </p>
          </div>

          {/* Placement Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Placement Notes</Label>
            <Textarea
              value={placementNotes}
              onChange={(e) => setPlacementNotes(e.target.value)}
              placeholder="Mounted above walk-in cooler, near back exit..."
              className="text-sm min-h-[60px]"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!formValid || submitting}
            className="w-full"
          >
            {submitting ? "Registering..." : "Register Gateway"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Registered Gateways Tab ────────────────────────────────────

interface GatewayWithOrg extends Gateway {
  org_name?: string;
}

function RegisteredGatewaysTab({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<GatewayWithOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGateways = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gateways")
      .select("*, organizations(name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Failed to load gateways",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const mapped: GatewayWithOrg[] = (data ?? []).map((row: Record<string, unknown>) => {
      const orgData = row.organizations as { name: string } | null;
      return {
        ...(row as unknown as Gateway),
        org_name: orgData?.name ?? "Unknown",
      };
    });
    setGateways(mapped);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadGateways();
  }, [loadGateways, refreshKey]);

  const handleDelete = async (gw: GatewayWithOrg) => {
    const { error } = await supabase
      .from("gateways")
      .delete()
      .eq("id", gw.id);

    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Gateway deleted", description: `${gw.name} has been removed.` });
    loadGateways();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Online</Badge>;
      case "offline":
        return <Badge variant="secondary">Offline</Badge>;
      case "maintenance":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Maintenance</Badge>;
      default:
        return <Badge variant="outline">Registered</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading gateways...
        </CardContent>
      </Card>
    );
  }

  if (gateways.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <Radio className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No gateways registered yet.</p>
          <p className="text-xs text-muted-foreground">
            Use the "Add Gateway" tab to register your first gateway.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gateway EUI</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gateways.map((gw) => (
              <TableRow key={gw.id}>
                <TableCell className="font-medium">{gw.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {formatGatewayEUI(gw.gateway_eui)}
                </TableCell>
                <TableCell>{gw.org_name}</TableCell>
                <TableCell>{statusBadge(gw.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(gw.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Gateway</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{gw.name}" ({formatGatewayEUI(gw.gateway_eui)})?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(gw)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function PlatformGateways() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PlatformLayout title="Gateways">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 dark:from-slate-700 dark:to-slate-900">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Gateway Provisioning</h2>
            <p className="text-sm text-muted-foreground">
              Scan SenseCAP gateway QR codes to extract EUI and register gateways
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="add" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="add" className="text-sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Gateway
          </TabsTrigger>
          <TabsTrigger value="list" className="text-sm">
            <List className="w-4 h-4 mr-2" />
            Registered Gateways
          </TabsTrigger>
        </TabsList>

        <TabsContent value="add">
          <AddGatewayTab onGatewayAdded={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="list">
          <RegisteredGatewaysTab refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </PlatformLayout>
  );
}
