import { useState } from "react";
import PlatformLayout from "@/components/platform/PlatformLayout";
import {
  useDecoderConfidence,
  useDecoderMismatches,
  type DecoderConfidenceRow,
} from "@/hooks/useDecoderConfidence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Activity,
} from "lucide-react";

function matchRateBadge(rate: number | null) {
  if (rate === null) return <Badge variant="secondary">No data</Badge>;
  if (rate >= 99.5) return <Badge className="bg-green-600 text-white">{rate}%</Badge>;
  if (rate >= 95) return <Badge className="bg-yellow-500 text-white">{rate}%</Badge>;
  return <Badge variant="destructive">{rate}%</Badge>;
}

function matchRateIcon(rate: number | null) {
  if (rate === null) return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  if (rate >= 99.5) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (rate >= 95) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function parseDecoderId(decoderId: string) {
  // Format: "catalog:<uuid>:rev<N>"
  const match = decoderId.match(/^catalog:(.+):rev(\d+)$/);
  if (match) {
    return { catalogId: match[1], revision: parseInt(match[2], 10) };
  }
  return { catalogId: decoderId, revision: null };
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  if (!data) return <p className="text-xs text-muted-foreground italic">No {label}</p>;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function MismatchDrilldown({ decoderId, onClose }: { decoderId: string; onClose: () => void }) {
  const { data: mismatches = [], isLoading } = useDecoderMismatches(decoderId);
  const parsed = parseDecoderId(decoderId);

  return (
    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" />
          Mismatches for rev{parsed.revision}
        </DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground mb-4">
        Catalog ID: <code className="text-xs">{parsed.catalogId}</code>
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : mismatches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No mismatches found.</p>
      ) : (
        <div className="space-y-4">
          {mismatches.map((m) => (
            <Card key={m.id} className="border-destructive/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.recorded_at).toLocaleString()}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    f_port {m.f_port ?? "—"}
                  </Badge>
                </div>
                {m.decode_mismatch_reason && (
                  <p className="text-sm font-medium text-destructive">
                    {m.decode_mismatch_reason}
                  </p>
                )}
                {m.raw_payload_hex && (
                  <p className="text-xs font-mono bg-muted p-1 rounded">
                    HEX: {m.raw_payload_hex}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <JsonBlock data={m.network_decoded_payload} label="TTN (network)" />
                  <JsonBlock data={m.app_decoded_payload} label="App (catalog decoder)" />
                </div>
                {(m.decoder_warnings || m.decoder_errors) && (
                  <div className="grid grid-cols-2 gap-3">
                    <JsonBlock data={m.decoder_warnings} label="Warnings" />
                    <JsonBlock data={m.decoder_errors} label="Errors" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DialogContent>
  );
}

export default function PlatformDecoderConfidence() {
  const { data: rows = [], isLoading, refetch } = useDecoderConfidence();
  const [selectedDecoder, setSelectedDecoder] = useState<string | null>(null);

  const totalCompared = rows.reduce((s, r) => s + r.compared_count, 0);
  const totalMatches = rows.reduce((s, r) => s + r.match_count, 0);
  const totalMismatches = rows.reduce((s, r) => s + r.mismatch_count, 0);
  const overallRate = totalCompared > 0 ? ((totalMatches / totalCompared) * 100).toFixed(2) : null;

  return (
    <PlatformLayout title="Decoder Confidence">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Decoders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compared</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCompared.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mismatches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{totalMismatches.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Match Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {matchRateIcon(overallRate !== null ? parseFloat(overallRate) : null)}
              <p className="text-2xl font-bold">
                {overallRate !== null ? `${overallRate}%` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Decoder Breakdown</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
          <Activity className="h-5 w-5 animate-pulse" /> Loading decoder stats...
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No trust-mode data yet. Decoder comparisons will appear here
            once sensors with catalog decoders start reporting.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Decoder</TableHead>
                <TableHead className="text-right">Compared</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Mismatches</TableHead>
                <TableHead>Match Rate</TableHead>
                <TableHead>Top Mismatch</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const parsed = parseDecoderId(row.decoder_id);
                return (
                  <TableRow key={row.decoder_id}>
                    <TableCell>
                      <div>
                        <span className="font-mono text-sm">
                          rev{parsed.revision ?? "?"}
                        </span>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {parsed.catalogId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.compared_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {row.match_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      {row.mismatch_count.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {matchRateIcon(row.match_rate_pct)}
                        {matchRateBadge(row.match_rate_pct)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.top_mismatch_reason ? (
                        <span className="text-xs font-mono text-muted-foreground truncate block max-w-[200px]">
                          {row.top_mismatch_reason}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimeAgo(row.last_seen_at)}
                    </TableCell>
                    <TableCell>
                      {row.mismatch_count > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDecoder(row.decoder_id)}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mismatch drilldown dialog */}
      <Dialog open={!!selectedDecoder} onOpenChange={() => setSelectedDecoder(null)}>
        {selectedDecoder && (
          <MismatchDrilldown
            decoderId={selectedDecoder}
            onClose={() => setSelectedDecoder(null)}
          />
        )}
      </Dialog>
    </PlatformLayout>
  );
}
