import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

interface FunctionStatus {
  name: string;
  status: "checking" | "ok" | "error" | "unknown";
  details?: Record<string, unknown>;
  error?: string;
}

// Functions that support GET health check endpoint
const EDGE_FUNCTIONS_WITH_GET = [
  "ttn-provision-device",
  "ttn-manage-application",
];

// Functions that only support POST (skip GET health check)
const EDGE_FUNCTIONS_POST_ONLY = [
  { name: "ttn-webhook", note: "POST-only (receives TTN uplinks)" },
  { name: "ttn-list-devices", note: "POST-only (requires auth)" },
];

const ALL_FUNCTIONS = [
  ...EDGE_FUNCTIONS_WITH_GET,
  ...EDGE_FUNCTIONS_POST_ONLY.map((f) => f.name),
];

export function EdgeFunctionDiagnostics() {
  const [functions, setFunctions] = useState<FunctionStatus[]>(
    ALL_FUNCTIONS.map((name) => ({ name, status: "unknown" }))
  );
  const [isChecking, setIsChecking] = useState(false);

  const checkFunction = async (functionName: string): Promise<FunctionStatus> => {
    // Check if this is a POST-only function
    const postOnlyFn = EDGE_FUNCTIONS_POST_ONLY.find((f) => f.name === functionName);
    if (postOnlyFn) {
      // Skip GET check for POST-only functions, mark as skipped
      return {
        name: functionName,
        status: "ok",
        details: {
          status: "skipped",
          note: postOnlyFn.note,
          message: "This function doesn't support GET health checks",
        },
      };
    }

    try {
      // Use supabase.functions.invoke with GET-like behavior
      // Since we added a GET handler to our edge function, we try fetching it
      const { data, error } = await supabase.functions.invoke(functionName, {
        method: "GET",
      });

      if (error) {
        // Try to extract more details
        let errorMessage = error.message || "Unknown error";

        // Check if it's a FunctionsHttpError with context
        const errorContext = (error as unknown as { context?: { status?: number } })?.context;
        if (errorContext?.status) {
          errorMessage = `HTTP ${errorContext.status}: ${errorMessage}`;
        }

        return {
          name: functionName,
          status: "error",
          error: errorMessage,
        };
      }

      // Check for hints in the response (e.g., missing TTN_USER_ID)
      const responseData = data as Record<string, unknown>;
      if (responseData?.hint) {
        return {
          name: functionName,
          status: "error",
          details: responseData,
          error: responseData.hint as string,
        };
      }

      return {
        name: functionName,
        status: "ok",
        details: responseData,
      };
    } catch (err) {
      return {
        name: functionName,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  };

  const runDiagnostics = async () => {
    setIsChecking(true);

    // Mark all as checking
    setFunctions((prev) =>
      prev.map((f) => ({ ...f, status: "checking" as const }))
    );

    // Check all functions in parallel
    const results = await Promise.all(
      ALL_FUNCTIONS.map((name) => checkFunction(name))
    );

    setFunctions(results);
    setIsChecking(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "ok":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-600">OK</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "checking":
        return <Badge variant="secondary">Checking...</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Edge Function Diagnostics</span>
          <Button onClick={runDiagnostics} disabled={isChecking} size="sm">
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Run Diagnostics"
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {functions.map((fn) => (
            <div
              key={fn.name}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(fn.status)}
                <span className="font-mono text-sm">{fn.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(fn.status)}
                {fn.error && (
                  <span className="text-xs text-red-500 max-w-[200px] truncate">
                    {fn.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {functions.some((f) => f.details) && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs font-semibold mb-2">Environment Details:</p>
            <pre className="text-xs overflow-auto max-h-40">
              {JSON.stringify(
                functions
                  .filter((f) => f.details)
                  .map((f) => ({
                    name: f.name,
                    ...(f.details || {}),
                  })),
                null,
                2
              )}
            </pre>
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            This diagnostic tool checks Edge Function health and configuration.
            A successful response indicates the function is deployed and can
            reach required services.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
