import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/eventLogger";
import { toast } from "sonner";

export type SoftDeleteEntityType = "unit" | "area" | "site" | "device" | "sensor";

interface SoftDeleteResult {
  success: boolean;
  error?: string;
}

interface EntityInfo {
  name: string;
  organizationId: string;
  siteId?: string | null;
  areaId?: string | null;
  unitId?: string | null;
}

async function getUnitInfo(unitId: string): Promise<EntityInfo | null> {
  const { data, error } = await supabase
    .from("units")
    .select(`
      name,
      area:areas!inner(
        id,
        site:sites!inner(id, organization_id)
      )
    `)
    .eq("id", unitId)
    .single();

  if (error || !data) return null;
  
  return {
    name: data.name,
    organizationId: data.area.site.organization_id,
    siteId: data.area.site.id,
    areaId: data.area.id,
    unitId: unitId,
  };
}

async function getAreaInfo(areaId: string): Promise<EntityInfo | null> {
  const { data, error } = await supabase
    .from("areas")
    .select(`
      name,
      site:sites!inner(id, organization_id)
    `)
    .eq("id", areaId)
    .single();

  if (error || !data) return null;
  
  return {
    name: data.name,
    organizationId: data.site.organization_id,
    siteId: data.site.id,
    areaId: areaId,
  };
}

async function getSiteInfo(siteId: string): Promise<EntityInfo | null> {
  const { data, error } = await supabase
    .from("sites")
    .select("name, organization_id")
    .eq("id", siteId)
    .single();

  if (error || !data) return null;
  
  return {
    name: data.name,
    organizationId: data.organization_id,
    siteId: siteId,
  };
}

async function getDeviceInfo(deviceId: string): Promise<EntityInfo | null> {
  const { data, error } = await supabase
    .from("devices")
    .select(`
      serial_number,
      unit:units(
        id,
        area:areas!inner(
          id,
          site:sites!inner(id, organization_id)
        )
      )
    `)
    .eq("id", deviceId)
    .single();

  if (error || !data) return null;
  
  if (!data.unit) {
    return {
      name: data.serial_number,
      organizationId: "", // Unassigned device
    };
  }
  
  return {
    name: data.serial_number,
    organizationId: data.unit.area.site.organization_id,
    siteId: data.unit.area.site.id,
    areaId: data.unit.area.id,
    unitId: data.unit.id,
  };
}

async function getSensorInfo(sensorId: string): Promise<EntityInfo | null> {
  const { data, error } = await supabase
    .from("lora_sensors")
    .select("name, organization_id, site_id, unit_id")
    .eq("id", sensorId)
    .single();

  if (error || !data) return null;
  
  return {
    name: data.name,
    organizationId: data.organization_id,
    siteId: data.site_id,
    unitId: data.unit_id,
  };
}

export async function softDeleteSensor(
  sensorId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const info = await getSensorInfo(sensorId);
    if (!info) return { success: false, error: "Sensor not found" };

    const now = new Date().toISOString();

    // Soft delete the sensor - TTN deprovision trigger will fire
    const { error } = await supabase
      .from("lora_sensors")
      .update({
        deleted_at: now,
        deleted_by: userId,
      })
      .eq("id", sensorId);

    if (error) throw error;

    await logEvent({
      event_type: "sensor_deleted",
      category: "settings",
      severity: "warning",
      title: `Sensor Deleted: ${info.name}`,
      organization_id: info.organizationId,
      site_id: info.siteId,
      unit_id: info.unitId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "sensor", entity_name: info.name },
    });

    toast.success(`Sensor "${info.name}" has been archived`);
    return { success: true };
  } catch (error) {
    console.error("Failed to archive sensor:", error);
    toast.error("Failed to archive sensor");
    return { success: false, error: String(error) };
  }
}

export async function softDeleteUnit(
  unitId: string,
  userId: string,
  cascade: boolean = false
): Promise<SoftDeleteResult> {
  try {
    const info = await getUnitInfo(unitId);
    if (!info) return { success: false, error: "Unit not found" };

    const now = new Date().toISOString();

    // Soft delete the unit
    const { error } = await supabase
      .from("units")
      .update({
        is_active: false,
        deleted_at: now,
        deleted_by: userId,
      })
      .eq("id", unitId);

    if (error) throw error;

    // Also soft delete associated devices
    if (cascade) {
      await supabase
        .from("devices")
        .update({
          deleted_at: now,
          deleted_by: userId,
        })
        .eq("unit_id", unitId);
    }

    // Log the deletion
    await logEvent({
      event_type: "unit_deleted",
      category: "settings",
      severity: "warning",
      title: `Unit Deleted: ${info.name}`,
      organization_id: info.organizationId,
      site_id: info.siteId,
      area_id: info.areaId,
      unit_id: unitId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "unit", entity_name: info.name },
    });

    toast.success(`Unit "${info.name}" has been deleted`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete unit:", error);
    toast.error("Failed to delete unit");
    return { success: false, error: String(error) };
  }
}

export async function softDeleteArea(
  areaId: string,
  userId: string,
  cascade: boolean = false
): Promise<SoftDeleteResult> {
  try {
    const info = await getAreaInfo(areaId);
    if (!info) return { success: false, error: "Area not found" };

    const now = new Date().toISOString();

    // Check for active units
    const { count: activeUnits } = await supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("area_id", areaId)
      .eq("is_active", true);

    if (activeUnits && activeUnits > 0 && !cascade) {
      return { 
        success: false, 
        error: `Area contains ${activeUnits} active unit(s). Use cascade delete to remove them.` 
      };
    }

    // Cascade delete units if requested
    if (cascade && activeUnits && activeUnits > 0) {
      await supabase
        .from("units")
        .update({
          is_active: false,
          deleted_at: now,
          deleted_by: userId,
        })
        .eq("area_id", areaId)
        .eq("is_active", true);
    }

    // Soft delete the area
    const { error } = await supabase
      .from("areas")
      .update({
        is_active: false,
        deleted_at: now,
        deleted_by: userId,
      })
      .eq("id", areaId);

    if (error) throw error;

    await logEvent({
      event_type: "area_deleted",
      category: "settings",
      severity: "warning",
      title: `Area Deleted: ${info.name}`,
      organization_id: info.organizationId,
      site_id: info.siteId,
      area_id: areaId,
      actor_id: userId,
      actor_type: "user",
      event_data: { 
        entity_type: "area", 
        entity_name: info.name,
        cascade_deleted_units: cascade ? activeUnits : 0,
      },
    });

    toast.success(`Area "${info.name}" has been deleted`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete area:", error);
    toast.error("Failed to delete area");
    return { success: false, error: String(error) };
  }
}

export async function softDeleteSite(
  siteId: string,
  userId: string,
  cascade: boolean = false
): Promise<SoftDeleteResult> {
  try {
    const info = await getSiteInfo(siteId);
    if (!info) return { success: false, error: "Site not found" };

    const now = new Date().toISOString();

    // Check for active areas
    const { count: activeAreas } = await supabase
      .from("areas")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("is_active", true);

    if (activeAreas && activeAreas > 0 && !cascade) {
      return { 
        success: false, 
        error: `Site contains ${activeAreas} active area(s). Use cascade delete to remove them.` 
      };
    }

    // Cascade delete areas and their units
    if (cascade && activeAreas && activeAreas > 0) {
      // Get all areas for this site
      const { data: areas } = await supabase
        .from("areas")
        .select("id")
        .eq("site_id", siteId)
        .eq("is_active", true);

      if (areas) {
        const areaIds = areas.map(a => a.id);
        
        // Delete all units in these areas
        await supabase
          .from("units")
          .update({
            is_active: false,
            deleted_at: now,
            deleted_by: userId,
          })
          .in("area_id", areaIds)
          .eq("is_active", true);

        // Delete all areas
        await supabase
          .from("areas")
          .update({
            is_active: false,
            deleted_at: now,
            deleted_by: userId,
          })
          .eq("site_id", siteId)
          .eq("is_active", true);
      }
    }

    // Soft delete the site
    const { error } = await supabase
      .from("sites")
      .update({
        is_active: false,
        deleted_at: now,
        deleted_by: userId,
      })
      .eq("id", siteId);

    if (error) throw error;

    await logEvent({
      event_type: "site_deleted",
      category: "settings",
      severity: "warning",
      title: `Site Deleted: ${info.name}`,
      organization_id: info.organizationId,
      site_id: siteId,
      actor_id: userId,
      actor_type: "user",
      event_data: { 
        entity_type: "site", 
        entity_name: info.name,
        cascade_deleted_areas: cascade ? activeAreas : 0,
      },
    });

    toast.success(`Site "${info.name}" has been deleted`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete site:", error);
    toast.error("Failed to delete site");
    return { success: false, error: String(error) };
  }
}

export async function softDeleteDevice(
  deviceId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const info = await getDeviceInfo(deviceId);
    if (!info) return { success: false, error: "Device not found" };

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("devices")
      .update({
        deleted_at: now,
        deleted_by: userId,
      })
      .eq("id", deviceId);

    if (error) throw error;

    await logEvent({
      event_type: "device_deleted",
      category: "settings",
      severity: "warning",
      title: `Device Deleted: ${info.name}`,
      organization_id: info.organizationId,
      site_id: info.siteId,
      area_id: info.areaId,
      unit_id: info.unitId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "device", entity_name: info.name },
    });

    toast.success(`Device "${info.name}" has been deleted`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete device:", error);
    toast.error("Failed to delete device");
    return { success: false, error: String(error) };
  }
}

export async function restoreUnit(
  unitId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const { data: unit, error: fetchError } = await supabase
      .from("units")
      .select(`
        name,
        area:areas!inner(
          id,
          is_active,
          site:sites!inner(id, is_active, organization_id)
        )
      `)
      .eq("id", unitId)
      .single();

    if (fetchError || !unit) return { success: false, error: "Unit not found" };

    // Check if parent area/site are active
    if (!unit.area.is_active || !unit.area.site.is_active) {
      return { 
        success: false, 
        error: "Cannot restore unit: parent area or site is deleted. Restore them first." 
      };
    }

    const { error } = await supabase
      .from("units")
      .update({
        is_active: true,
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", unitId);

    if (error) throw error;

    await logEvent({
      event_type: "unit_restored",
      category: "settings",
      severity: "info",
      title: `Unit Restored: ${unit.name}`,
      organization_id: unit.area.site.organization_id,
      site_id: unit.area.site.id,
      area_id: unit.area.id,
      unit_id: unitId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "unit", entity_name: unit.name },
    });

    toast.success(`Unit "${unit.name}" has been restored`);
    return { success: true };
  } catch (error) {
    console.error("Failed to restore unit:", error);
    toast.error("Failed to restore unit");
    return { success: false, error: String(error) };
  }
}

export async function restoreArea(
  areaId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const { data: area, error: fetchError } = await supabase
      .from("areas")
      .select(`
        name,
        site:sites!inner(id, is_active, organization_id)
      `)
      .eq("id", areaId)
      .single();

    if (fetchError || !area) return { success: false, error: "Area not found" };

    if (!area.site.is_active) {
      return { 
        success: false, 
        error: "Cannot restore area: parent site is deleted. Restore it first." 
      };
    }

    const { error } = await supabase
      .from("areas")
      .update({
        is_active: true,
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", areaId);

    if (error) throw error;

    await logEvent({
      event_type: "area_restored",
      category: "settings",
      severity: "info",
      title: `Area Restored: ${area.name}`,
      organization_id: area.site.organization_id,
      site_id: area.site.id,
      area_id: areaId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "area", entity_name: area.name },
    });

    toast.success(`Area "${area.name}" has been restored`);
    return { success: true };
  } catch (error) {
    console.error("Failed to restore area:", error);
    toast.error("Failed to restore area");
    return { success: false, error: String(error) };
  }
}

export async function restoreSite(
  siteId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const { data: site, error: fetchError } = await supabase
      .from("sites")
      .select("name, organization_id")
      .eq("id", siteId)
      .single();

    if (fetchError || !site) return { success: false, error: "Site not found" };

    const { error } = await supabase
      .from("sites")
      .update({
        is_active: true,
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", siteId);

    if (error) throw error;

    await logEvent({
      event_type: "site_restored",
      category: "settings",
      severity: "info",
      title: `Site Restored: ${site.name}`,
      organization_id: site.organization_id,
      site_id: siteId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "site", entity_name: site.name },
    });

    toast.success(`Site "${site.name}" has been restored`);
    return { success: true };
  } catch (error) {
    console.error("Failed to restore site:", error);
    toast.error("Failed to restore site");
    return { success: false, error: String(error) };
  }
}

export async function restoreDevice(
  deviceId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const info = await getDeviceInfo(deviceId);
    if (!info) return { success: false, error: "Device not found" };

    const { error } = await supabase
      .from("devices")
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", deviceId);

    if (error) throw error;

    await logEvent({
      event_type: "device_restored",
      category: "settings",
      severity: "info",
      title: `Device Restored: ${info.name}`,
      organization_id: info.organizationId,
      site_id: info.siteId,
      area_id: info.areaId,
      unit_id: info.unitId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "device", entity_name: info.name },
    });

    toast.success(`Device "${info.name}" has been restored`);
    return { success: true };
  } catch (error) {
    console.error("Failed to restore device:", error);
    toast.error("Failed to restore device");
    return { success: false, error: String(error) };
  }
}

export async function restoreSensor(
  sensorId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const info = await getSensorInfo(sensorId);
    if (!info) return { success: false, error: "Sensor not found" };

    const { error } = await supabase
      .from("lora_sensors")
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", sensorId);

    if (error) throw error;

    await logEvent({
      event_type: "sensor_restored",
      category: "settings",
      severity: "info",
      title: `Sensor Restored: ${info.name}`,
      organization_id: info.organizationId,
      site_id: info.siteId,
      unit_id: info.unitId,
      actor_id: userId,
      actor_type: "user",
      event_data: { entity_type: "sensor", entity_name: info.name },
    });

    toast.success(`Sensor "${info.name}" has been restored`);
    return { success: true };
  } catch (error) {
    console.error("Failed to restore sensor:", error);
    toast.error("Failed to restore sensor");
    return { success: false, error: String(error) };
  }
}

// Permanent delete functions
export async function permanentlyDeleteUnit(
  unitId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const info = await getUnitInfo(unitId);
    
    const { error } = await supabase
      .from("units")
      .delete()
      .eq("id", unitId);

    if (error) throw error;

    if (info) {
      await logEvent({
        event_type: "unit_permanently_deleted",
        category: "settings",
        severity: "critical",
        title: `Unit Permanently Deleted: ${info.name}`,
        organization_id: info.organizationId,
        site_id: info.siteId,
        area_id: info.areaId,
        actor_id: userId,
        actor_type: "user",
        event_data: { entity_type: "unit", entity_name: info.name, permanent: true },
      });
    }

    toast.success("Unit permanently deleted");
    return { success: true };
  } catch (error) {
    console.error("Failed to permanently delete unit:", error);
    toast.error("Failed to permanently delete unit");
    return { success: false, error: String(error) };
  }
}

export async function permanentlyDeleteArea(
  areaId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const info = await getAreaInfo(areaId);
    
    const { error } = await supabase
      .from("areas")
      .delete()
      .eq("id", areaId);

    if (error) throw error;

    if (info) {
      await logEvent({
        event_type: "area_permanently_deleted",
        category: "settings",
        severity: "critical",
        title: `Area Permanently Deleted: ${info.name}`,
        organization_id: info.organizationId,
        site_id: info.siteId,
        actor_id: userId,
        actor_type: "user",
        event_data: { entity_type: "area", entity_name: info.name, permanent: true },
      });
    }

    toast.success("Area permanently deleted");
    return { success: true };
  } catch (error) {
    console.error("Failed to permanently delete area:", error);
    toast.error("Failed to permanently delete area");
    return { success: false, error: String(error) };
  }
}

export async function permanentlyDeleteSite(
  siteId: string,
  userId: string
): Promise<SoftDeleteResult> {
  try {
    const info = await getSiteInfo(siteId);
    
    const { error } = await supabase
      .from("sites")
      .delete()
      .eq("id", siteId);

    if (error) throw error;

    if (info) {
      await logEvent({
        event_type: "site_permanently_deleted",
        category: "settings",
        severity: "critical",
        title: `Site Permanently Deleted: ${info.name}`,
        organization_id: info.organizationId,
        actor_id: userId,
        actor_type: "user",
        event_data: { entity_type: "site", entity_name: info.name, permanent: true },
      });
    }

    toast.success("Site permanently deleted");
    return { success: true };
  } catch (error) {
    console.error("Failed to permanently delete site:", error);
    toast.error("Failed to permanently delete site");
    return { success: false, error: String(error) };
  }
}

export async function getActiveChildrenCount(
  entityType: SoftDeleteEntityType,
  entityId: string
): Promise<number> {
  try {
    if (entityType === "site") {
      const { count } = await supabase
        .from("areas")
        .select("id", { count: "exact", head: true })
        .eq("site_id", entityId)
        .eq("is_active", true);
      return count || 0;
    }
    
    if (entityType === "area") {
      const { count } = await supabase
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("area_id", entityId)
        .eq("is_active", true);
      return count || 0;
    }
    
    if (entityType === "unit") {
      const { count } = await supabase
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", entityId)
        .is("deleted_at", null);
      return count || 0;
    }
    
    return 0;
  } catch (error) {
    console.error("Failed to get children count:", error);
    return 0;
  }
}
