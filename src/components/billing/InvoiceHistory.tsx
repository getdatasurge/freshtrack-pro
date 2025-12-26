import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, Download, Loader2 } from "lucide-react";

interface Invoice {
  id: string;
  stripe_invoice_id: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  paid_at: string | null;
  period_start: string;
  period_end: string;
  invoice_pdf_url: string | null;
}

interface InvoiceHistoryProps {
  subscriptionId: string;
}

export const InvoiceHistory = ({ subscriptionId }: InvoiceHistoryProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, [subscriptionId]);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error loading invoices:", error);
    }
    setIsLoading(false);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoice History
          </CardTitle>
          <CardDescription>
            Your past invoices will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No invoices yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Invoice History
        </CardTitle>
        <CardDescription>
          View and download past invoices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {invoice.paid_at 
                      ? new Date(invoice.paid_at).toLocaleDateString()
                      : new Date(invoice.period_start).toLocaleDateString()
                    }
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(invoice.amount_paid || invoice.amount_due, invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={
                        invoice.status === "paid" 
                          ? "bg-safe/15 text-safe border-safe/30"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invoice.invoice_pdf_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a 
                          href={invoice.invoice_pdf_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
