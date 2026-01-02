import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoraSensor, LoraSensorInsert } from "@/types/ttn";
import { toast } from "sonner";
import { useState } from "react";

/**
 * Hook to fetch all LoRa sensors for an organization
 */
export function useLoraSensors(orgId: string | null) {
  return useQuery({
    queryKey: ["lora-sensors", orgId],
    queryFn: async (): Promise<LoraSensor[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("lora_sensors")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Debug logging for sensor sync diagnostics
      debugLog.info('query', 'LORA_SENSORS_FETCH', {
        org_id: orgId,
        count: data?.length ?? 0,
        statuses: data?.reduce((acc, s) => {
          acc[s.status] = (acc[s.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        unassigned_count: data?.filter(s => !s.site_id || !s.unit_id).length ?? 0,
        missing_appkey_count: data?.filter(s => !s.app_key).length ?? 0,
      });
      
      return data as LoraSensor[];
    },
    enabled: !!orgId,
  });
}

/**
 * Hook to fetch a single LoRa sensor by ID
 */
export function useLoraSensor(sensorId: string | null) {
  return useQuery({
    queryKey: ["lora-sensor", sensorId],
    queryFn: async (): Promise<LoraSensor | null> => {
      if (!sensorId) return null;

      const { data, error } = await supabase
        .from("lora_sensors")
        .select("*")
        .eq("id", sensorId)
        .maybeSingle();

      if (error) throw error;
      return data as LoraSensor | null;
    },
    enabled: !!sensorId,
  });
}

/**
 * Hook to fetch a LoRa sensor by DevEUI
 */
export function useLoraSensorByDevEui(devEui: string | null) {
  return useQuery({
    queryKey: ["lora-sensor-by-eui", devEui],
    queryFn: async (): Promise<LoraSensor | null> => {
      if (!devEui) return null;

      const { data, error } = await supabase
        .from("lora_sensors")
        .select("*")
        .eq("dev_eui", devEui)
        .maybeSingle();

      if (error) throw error;
      return data as LoraSensor | null;
    },
    enabled: !!devEui,
  });
}

/**
 * Hook to fetch LoRa sensors linked to a specific unit
 */
export function useLoraSensorsByUnit(unitId: string | null) {
  return useQuery({
    queryKey: ["lora-sensors-by-unit", unitId],
    queryFn: async (): Promise<LoraSensor[]> => {
      if (!unitId) return [];

      const { data, error } = await supabase
        .from("lora_sensors")
        .select("*")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LoraSensor[];
    },
    enabled: !!unitId,
  });
}

/**
 * Hook to create a new LoRa sensor
 */
export function useCreateLoraSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sensor: LoraSensorInsert): Promise<LoraSensor> => {
      // Get current user for created_by field
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      const sensorWithCreator = {
        ...sensor,
        created_by: userId || null,
      };

      const { data, error } = await supabase
        .from("lora_sensors")
        .insert(sensorWithCreator)
        .select()
        .single();

      if (error) throw error;
      return data as LoraSensor;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["lora-sensors", data.organization_id] });
      if (data.unit_id) {
        queryClient.invalidateQueries({ queryKey: ["lora-sensors-by-unit", data.unit_id] });
      }
      toast.success("LoRa sensor created successfully");

      // Sensor registered with 'pending' status - TTN provisioning handled separately
    },
    onError: (error: Error) => {
      toast.error(`Failed to create LoRa sensor: ${error.message}`);
    },
  });
}

/**
 * Hook to update a LoRa sensor
 */
export function useUpdateLoraSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<LoraSensor>;
    }): Promise<LoraSensor> => {
      const { data, error } = await supabase
        .from("lora_sensors")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as LoraSensor;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lora-sensors", data.organization_id] });
      queryClient.invalidateQueries({ queryKey: ["lora-sensor", data.id] });
      queryClient.invalidateQueries({ queryKey: ["lora-sensor-by-eui", data.dev_eui] });
      if (data.unit_id) {
        queryClient.invalidateQueries({ queryKey: ["lora-sensors-by-unit", data.unit_id] });
      }
      toast.success("LoRa sensor updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update LoRa sensor: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a LoRa sensor
 * TTN de-provisioning is now handled by the database trigger which enqueues a job
 */
export function useDeleteLoraSensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, orgId }: { id: string; orgId: string }): Promise<void> => {
      // Delete from database - the database trigger 'trg_enqueue_deprovision'
      // automatically creates a deprovisioning job for TTN cleanup
      const { error } = await supabase
        .from("lora_sensors")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lora-sensors", variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ["ttn-deprovision-jobs"] });
      toast.success("Sensor deleted. TTN cleanup will run in the background.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete LoRa sensor: ${error.message}`);
    },
  });
}

/**
 * Hook to link a LoRa sensor to a unit
 */
export function useLinkSensorToUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sensorId,
      unitId,
    }: {
      sensorId: string;
      unitId: string | null;
    }): Promise<LoraSensor> => {
      const { data, error } = await supabase
        .from("lora_sensors")
        .update({ unit_id: unitId })
        .eq("id", sensorId)
        .select()
        .single();

      if (error) throw error;
      return data as LoraSensor;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lora-sensors", data.organization_id] });
      queryClient.invalidateQueries({ queryKey: ["lora-sensor", data.id] });
      if (variables.unitId) {
        queryClient.invalidateQueries({ queryKey: ["lora-sensors-by-unit", variables.unitId] });
      }
      toast.success(variables.unitId ? "Sensor linked to unit" : "Sensor unlinked from unit");
    },
    onError: (error: Error) => {
      toast.error(`Failed to link sensor: ${error.message}`);
    },
  });
}

import { debugLog } from "@/lib/debugLogger";

// Helper to get user-friendly error message for TTN provisioning errors
const getProvisionErrorMessage = (error: string): string => {
  if (error.includes('PERMISSION_MISSING') || error.includes('403')) {
    return "TTN API key missing required permissions. Regenerate key with devices:write permission.";
  }
  if (error.includes('CONFIG_MISSING') || error.includes('TTN not configured')) {
    return "TTN not configured. Go to Developer settings to set up TTN connection.";
  }
  if (error.includes('connectivity failed') || error.includes('network')) {
    return "Could not reach TTN. Check your network or TTN application settings.";
  }
  if (error.includes('SENSOR_KEYS_MISSING')) {
    return "Sensor missing OTAA credentials (AppKey). Edit sensor to add credentials.";
  }
  if (error.includes('already exists') || error.includes('409')) {
    return "Device already registered in TTN.";
  }
  return error;
};

/**
 * Hook to provision a LoRa sensor to TTN
 */
export function useProvisionLoraSensor() {
  const queryClient = useQueryClient();
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      sensorId,
      organizationId,
    }: {
      sensorId: string;
      organizationId: string;
    }): Promise<{ success: boolean; message?: string; already_exists?: boolean; device_id?: string }> => {
      setProvisioningId(sensorId);
      const requestId = crypto.randomUUID().slice(0, 8);
      const startTime = Date.now();

      debugLog.info('ttn', 'TTN_PROVISION_SENSOR_REQUEST', {
        request_id: requestId,
        sensor_id: sensorId,
        org_id: organizationId,
      });
      
      try {
        const { data, error } = await supabase.functions.invoke("ttn-provision-device", {
          body: { 
            action: "create", 
            sensor_id: sensorId, 
            organization_id: organizationId 
          },
        });

        const durationMs = Date.now() - startTime;

        // Extract detailed error from edge function response
        if (error) {
          const errorContext = (error as any)?.context;
          let detailedMessage = error.message;
          
          if (errorContext) {
            try {
              const clonedContext = errorContext.clone ? errorContext.clone() : errorContext;
              if (typeof clonedContext.json === 'function') {
                const responseBody = await clonedContext.json();
                if (responseBody?.details) {
                  detailedMessage = responseBody.details;
                } else if (responseBody?.error) {
                  detailedMessage = responseBody.error;
                }
              }
            } catch {
              try {
                const clonedContext = errorContext.clone ? errorContext.clone() : errorContext;
                if (typeof clonedContext.text === 'function') {
                  const textBody = await clonedContext.text();
                  if (textBody) detailedMessage = textBody;
                }
              } catch {
                // Keep original message
              }
            }
          }
          
          debugLog.error('ttn', 'TTN_PROVISION_SENSOR_ERROR', {
            request_id: requestId,
            sensor_id: sensorId,
            error_code: 'FUNCTION_ERROR',
            message: detailedMessage,
            duration_ms: durationMs,
          });
          
          throw new Error(detailedMessage);
        }
        
        // Check if data indicates failure
        if (data && !data.success && data.error) {
          let errorMessage = data.error;
          if (data.hint) {
            errorMessage = `${data.error}\n\n${data.hint}`;
          } else if (data.details) {
            errorMessage = `${data.error}: ${data.details}`;
          }
          
          debugLog.error('ttn', 'TTN_PROVISION_SENSOR_ERROR', {
            request_id: requestId,
            sensor_id: sensorId,
            error_code: data.error_code || 'UNKNOWN',
            message: errorMessage,
            hint: data.hint,
            duration_ms: durationMs,
          });
          
          throw new Error(errorMessage);
        }
        
        // Success
        debugLog.info('ttn', 'TTN_PROVISION_SENSOR_SUCCESS', {
          request_id: requestId,
          sensor_id: sensorId,
          ttn_device_id: data?.device_id,
          ttn_application_id: data?.application_id,
          outcome: data?.already_exists ? 'already_exists' : 'created',
          duration_ms: durationMs,
        });
        
        return data;
      } catch (err) {
        const durationMs = Date.now() - startTime;
        
        // Only log if not already logged above
        if (!(err instanceof Error && err.message)) {
          debugLog.error('ttn', 'TTN_PROVISION_SENSOR_ERROR', {
            request_id: requestId,
            sensor_id: sensorId,
            error: String(err),
            duration_ms: durationMs,
          });
        }
        
        throw err;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lora-sensors"] });
      queryClient.invalidateQueries({ queryKey: ["lora-sensor", variables.sensorId] });
      queryClient.invalidateQueries({ queryKey: ["lora-sensors-by-unit"] });
      
      if (data?.already_exists) {
        toast.success("Sensor already registered in TTN - ready to use");
      } else {
        toast.success("Sensor provisioned to TTN - awaiting network join");
      }
      setProvisioningId(null);
    },
    onError: (error: Error) => {
      const friendlyMessage = getProvisionErrorMessage(error.message);
      toast.error(`TTN provisioning failed: ${friendlyMessage}`);
      setProvisioningId(null);
    },
  });

  return {
    ...mutation,
    provisioningId,
    isProvisioning: (sensorId: string) => provisioningId === sensorId,
  };
}
