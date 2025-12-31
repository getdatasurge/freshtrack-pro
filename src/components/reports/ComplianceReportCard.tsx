import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

interface ComplianceReportCardProps {
  siteId?: string;
  unitId?: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  siteName?: string;
  unitName?: string;
}

export function ComplianceReportCard({
  siteId,
  unitId,
  startDate,
  endDate,
  siteName,
  unitName,
}: ComplianceReportCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");

  const handleExport = async (formatType: "csv" | "pdf") => {
    if (!startDate || !endDate) {
      toast.error("Please select a date range");
      return;
    }

    setIsExporting(true);
    setExportFormat(formatType);

    try {
      // Ensure fresh session token before invoking edge function
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Session expired. Please sign in again.");
        window.location.href = "/auth";
        return;
      }

      const requestBody: Record<string, unknown> = {
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        report_type: "compliance",
        format: formatType,
      };

      if (unitId) {
        requestBody.unit_id = unitId;
      } else if (siteId) {
        requestBody.site_id = siteId;
      }

      const response = await supabase.functions.invoke("export-temperature-logs", {
        body: requestBody,
      });

      if (response.error) throw new Error(response.error.message);

      const contentType = formatType === "pdf" ? "application/pdf" : "text/csv";
      const extension = formatType === "pdf" ? "pdf" : "csv";
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Compliance report exported");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export report");
    }
    setIsExporting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-safe/10 text-safe">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Compliance Report</CardTitle>
              <CardDescription className="mt-1">
                Complete audit-ready report with all temperature logs, exceptions,
                corrective actions, and compliance status
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Includes:</p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              <li>Site and unit information</li>
              <li>Manual logging interval compliance</li>
              <li>All temperature logs (manual + automated)</li>
              <li>Out-of-range flags with timestamps</li>
              <li>Missed manual log entries</li>
              <li>Corrective action notes</li>
              <li>User attribution for each entry</li>
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleExport("csv")}
              disabled={isExporting || !startDate || !endDate}
              variant="outline"
            >
              {isExporting && exportFormat === "csv" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Export CSV
            </Button>
            <Button
              onClick={() => handleExport("pdf")}
              disabled={isExporting || !startDate || !endDate}
            >
              {isExporting && exportFormat === "pdf" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export PDF
            </Button>
          </div>
        </div>
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            Footer: "Generated by FrostGuard on {format(new Date(), "MMM d, yyyy 'at' h:mm a")}"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
