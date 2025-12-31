// Offline storage utilities using IndexedDB for manual temperature logs

const DB_NAME = "frostguard-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_logs";

export interface PendingManualLog {
  id: string;
  unit_id: string;
  temperature: number;
  notes: string | null;
  logged_at: string;
  created_at: string;
  synced: 0 | 1; // Use 0/1 instead of boolean for IndexedDB compatibility
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("synced", "synced", { unique: false });
        store.createIndex("unit_id", "unit_id", { unique: false });
      }
    };
  });
}

export async function savePendingLog(log: PendingManualLog): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(log);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function getPendingLogs(): Promise<PendingManualLog[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("synced");
      // Use 0 instead of false for IndexedDB key compatibility
      const request = index.getAll(IDBKeyRange.only(0));
      request.onerror = () => {
        console.warn("[offlineStorage] getPendingLogs query error:", request.error);
        resolve([]);
      };
      request.onsuccess = () => resolve(request.result || []);
      tx.oncomplete = () => db.close();
    });
  } catch (error) {
    console.warn("[offlineStorage] getPendingLogs error:", error);
    return [];
  }
}

export async function markLogSynced(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const log = getReq.result;
        if (log) {
          log.synced = 1; // Use 1 instead of true
          store.put(log);
        }
        resolve();
      };
      getReq.onerror = () => {
        console.warn("[offlineStorage] markLogSynced error:", getReq.error);
        resolve();
      };
      tx.oncomplete = () => db.close();
    });
  } catch (error) {
    console.warn("[offlineStorage] markLogSynced error:", error);
  }
}

export async function deleteSyncedLogs(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("synced");
      // Use 1 instead of true for IndexedDB key compatibility
      const request = index.openCursor(IDBKeyRange.only(1));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      request.onerror = () => {
        console.warn("[offlineStorage] deleteSyncedLogs error:", request.error);
        resolve();
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  } catch (error) {
    console.warn("[offlineStorage] deleteSyncedLogs error:", error);
  }
}

export async function getAllLogs(): Promise<PendingManualLog[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    tx.oncomplete = () => db.close();
  });
}

// Clear all offline storage (used on logout for session isolation)
export async function clearOfflineStorage(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve(); // Resolve anyway to not block logout
    request.onblocked = () => resolve();
  });
}
