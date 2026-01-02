import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PreflightError {
  code: "WRONG_KEY_TYPE" | "MISSING_GATEWAY_RIGHTS" | "API_KEY_INVALID" | "TTN_NOT_CONFIGURED";
  message: string;
  hint: string;
  fix_steps: string[];
}

export interface PreflightResult {
  ok: boolean;
  request_id: string;
  allowed: boolean;
  key_type: "personal" | "organization" | "application" | "unknown";
  owner_scope: "user" | "organization" | null;
  scope_id: string | null;
  has_gateway_rights: boolean;
  missing_rights: string[];
  error?: PreflightError;
}

export interface UseGatewayProvisioningPreflightReturn {
  status: "idle" | "checking" | "ready" | "blocked" | "error";
  result: PreflightResult | null;
  keyType: "personal" | "organization" | "application" | "unknown" | null;
  ownerScope: "user" | "organization" | null;
  hasGatewayRights: boolean;
  missingRights: string[];
  error: PreflightError | null;
  runPreflight: () => Promise<PreflightResult | null>;
  isLoading: boolean;
}

/**
 * Hook to check if gateway provisioning is allowed based on TTN API key type and permissions
 */
export function useGatewayProvisioningPreflight(
  organizationId: string | null,
  options: { autoRun?: boolean } = {}
): UseGatewayProvisioningPreflightReturn {
  const { autoRun = false } = options;
  
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "blocked" | "error">("idle");
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runPreflight = useCallback(async (): Promise<PreflightResult | null> => {
    if (!organizationId) {
      setStatus("idle");
      return null;
    }

    setStatus("checking");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ttn-gateway-preflight", {
        body: { organization_id: organizationId },
      });

      if (error) {
        console.error("[useGatewayProvisioningPreflight] Invoke error:", error);
        setStatus("error");
        setResult(null);
        return null;
      }

      const preflightResult = data as PreflightResult;
      setResult(preflightResult);

      if (preflightResult.allowed) {
        setStatus("ready");
      } else {
        setStatus("blocked");
      }

      return preflightResult;
    } catch (err) {
      console.error("[useGatewayProvisioningPreflight] Error:", err);
      setStatus("error");
      setResult(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  // Auto-run preflight if enabled
  useEffect(() => {
    if (autoRun && organizationId && status === "idle") {
      runPreflight();
    }
  }, [autoRun, organizationId, status, runPreflight]);

  return {
    status,
    result,
    keyType: result?.key_type ?? null,
    ownerScope: result?.owner_scope ?? null,
    hasGatewayRights: result?.has_gateway_rights ?? false,
    missingRights: result?.missing_rights ?? [],
    error: result?.error ?? null,
    runPreflight,
    isLoading,
  };
}
