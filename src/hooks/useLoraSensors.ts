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
    }): Promise<{ success: boolean; message?: string }> => {
      setProvisioningId(sensorId);
      
      const { data, error } = await supabase.functions.invoke("ttn-provision-device", {
        body: { 
          action: "create", 
          sensor_id: sensorId, 
          organization_id: organizationId 
        },
      });

      // Extract detailed error from edge function response
      if (error) {
        // FunctionsHttpError includes context with the response body
        const errorContext = (error as any)?.context;
        let detailedMessage = error.message;
        
        // Try to get the actual response body for more details
        if (errorContext) {
          try {
            // Clone the response to avoid "body already read" issues
            const clonedContext = errorContext.clone ? errorContext.clone() : errorContext;
            if (typeof clonedContext.json === 'function') {
              const responseBody = await clonedContext.json();
              console.log("[useProvisionLoraSensor] Backend response:", responseBody);
              if (responseBody?.details) {
                detailedMessage = responseBody.details;
              } else if (responseBody?.error) {
                detailedMessage = responseBody.error;
              }
            }
          } catch (parseError) {
            // Try reading as text if JSON fails
            try {
              const clonedContext = errorContext.clone ? errorContext.clone() : errorContext;
              if (typeof clonedContext.text === 'function') {
                const textBody = await clonedContext.text();
                if (textBody) {
                  console.log("[useProvisionLoraSensor] Backend text response:", textBody);
                  detailedMessage = textBody;
                }
              }
            } catch {
              // Keep original message
            }
          }
        }
        
        throw new Error(detailedMessage);
      }
      
      // Check if data indicates failure (with detailed error info)
      if (data && !data.success && data.error) {
        // Build error message with hint if available
        let errorMessage = data.error;
        if (data.hint) {
          errorMessage = `${data.error}\n\n${data.hint}`;
        } else if (data.details) {
          errorMessage = `${data.error}: ${data.details}`;
        }
        throw new Error(errorMessage);
      }
      
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lora-sensors"] });
      queryClient.invalidateQueries({ queryKey: ["lora-sensor", variables.sensorId] });
      queryClient.invalidateQueries({ queryKey: ["lora-sensors-by-unit"] });
      toast.success("Sensor provisioned to TTN - awaiting network join");
      setProvisioningId(null);
    },
    onError: (error: Error) => {
      console.error("[useProvisionLoraSensor] Provisioning error:", error);
      toast.error(`TTN provisioning failed: ${error.message}`);
      setProvisioningId(null);
    },
  });

  return {
    ...mutation,
    provisioningId,
    isProvisioning: (sensorId: string) => provisioningId === sensorId,
  };
}
