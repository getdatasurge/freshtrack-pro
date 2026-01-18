import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoraSensor, LoraSensorType } from "@/types/ttn";
import { toast } from "sonner";
import { qk } from "@/lib/queryKeys";
import { invalidateSensorAssignment } from "@/lib/invalidation";

/**
 * Get sensor types in the same "primary group" for mutual exclusivity
 * - Temperature-capable sensors share primary status
 * - Door-only sensors have their own primary (if no combo sensor)
 */
function getSameTypeGroup(sensorType: LoraSensorType): LoraSensorType[] {
  if (sensorType === 'door' || sensorType === 'contact') {
    return ['door', 'contact'];
  }
  // Temperature-capable sensors (temperature, temperature_humidity, combo)
  return ['temperature', 'temperature_humidity', 'combo'];
}

/**
 * Hook to set a sensor as the primary sensor for its unit
 */
export function useSetPrimarySensor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sensorId,
      unitId,
      sensorType,
    }: {
      sensorId: string;
      unitId: string;
      sensorType: LoraSensorType;
    }): Promise<LoraSensor> => {
      // Get the type group for this sensor
      const typeGroup = getSameTypeGroup(sensorType);

      // First, unset any existing primary sensors of the same type group for this unit
      const { error: unsetError } = await supabase
        .from("lora_sensors")
        .update({ is_primary: false })
        .eq("unit_id", unitId)
        .eq("is_primary", true)
        .in("sensor_type", typeGroup);

      if (unsetError) throw unsetError;

      // Then set this sensor as primary
      const { data, error } = await supabase
        .from("lora_sensors")
        .update({ is_primary: true })
        .eq("id", sensorId)
        .select()
        .single();

      if (error) throw error;
      return data as LoraSensor;
    },
    onSuccess: async (data) => {
      // Use centralized invalidation for sensor assignment changes
      await invalidateSensorAssignment(
        queryClient,
        data.id,
        data.organization_id,
        data.unit_id
      );
      toast.success(`${data.name} set as primary sensor`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to set primary sensor: ${error.message}`);
    },
  });
}