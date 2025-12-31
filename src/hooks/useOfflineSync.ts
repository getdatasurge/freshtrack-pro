import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PendingManualLog,
  savePendingLog,
  getPendingLogs,
  markLogSynced,
  deleteSyncedLogs,
} from "@/lib/offlineStorage";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingLogs();
      setPendingCount(pending.length);
    } catch (error) {
      console.error("Error getting pending logs:", error);
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncPendingLogs();
    }
  }, [isOnline, pendingCount]);

  const saveLogOffline = useCallback(
    async (log: Omit<PendingManualLog, "synced">) => {
      await savePendingLog({ ...log, synced: 0 }); // Use 0 instead of false
      await refreshPendingCount();
    },
    [refreshPendingCount]
  );

  const syncPendingLogs = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const pending = await getPendingLogs();

      for (const log of pending) {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (!session.session) continue;

          const { error } = await supabase.from("manual_temperature_logs").insert({
            unit_id: log.unit_id,
            temperature: log.temperature,
            notes: log.notes,
            logged_at: log.logged_at,
            logged_by: session.session.user.id,
          });

          if (!error) {
            await markLogSynced(log.id);
          } else {
            console.error("Failed to sync log:", error);
          }
        } catch (error) {
          console.error("Error syncing individual log:", error);
        }
      }

      await deleteSyncedLogs();
      await refreshPendingCount();
    } catch (error) {
      console.error("Error during sync:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    saveLogOffline,
    syncPendingLogs,
    refreshPendingCount,
  };
}
