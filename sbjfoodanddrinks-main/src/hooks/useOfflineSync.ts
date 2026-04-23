import { useState, useEffect, useCallback, useRef } from 'react';

const DB_NAME = 'sbj-pos-offline';
const STORE_NAME = 'pending-orders';
const MENU_CACHE_KEY = 'sbj-menu-cache';
const LAST_SYNC_KEY = 'sbj-last-sync';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface OfflineOrder {
  localId: string;            // also used as offline_id (UUID)
  payload: any;               // { order, items, payments?, customer? }
  createdAt: string;
  branchId: string;
  retries: number;
  syncFailed?: boolean;
  lastError?: string;
}

// Generate a UUID (works in modern browsers; falls back to a pseudo UUID)
function uuid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// localStorage fallback if IndexedDB fails
function lsKey() {
  return 'sbj-offline-orders-fallback';
}
function lsGetAll(): OfflineOrder[] {
  try { return JSON.parse(localStorage.getItem(lsKey()) || '[]'); } catch { return []; }
}
function lsSetAll(orders: OfflineOrder[]) {
  try { localStorage.setItem(lsKey(), JSON.stringify(orders)); } catch { /* quota */ }
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const useFallbackRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      if (useFallbackRef.current) {
        setPendingCount(lsGetAll().length);
        return;
      }
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const count = await new Promise<number>((resolve, reject) => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      setPendingCount(count);
      db.close();
    } catch {
      useFallbackRef.current = true;
      setPendingCount(lsGetAll().length);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    refreshCount();
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    if (stored) setLastSync(stored);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshCount]);

  const markSynced = useCallback(() => {
    const ts = new Date().toLocaleTimeString();
    setLastSync(ts);
    localStorage.setItem(LAST_SYNC_KEY, ts);
  }, []);

  const saveOfflineOrder = useCallback(async (payload: any, branchId: string): Promise<string> => {
    const localId = uuid();
    const order: OfflineOrder = {
      localId,
      payload,
      createdAt: new Date().toISOString(),
      branchId,
      retries: 0,
    };

    try {
      if (useFallbackRef.current) throw new Error('use-fallback');
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(order);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      useFallbackRef.current = true;
      const all = lsGetAll();
      all.push(order);
      lsSetAll(all);
    }

    await refreshCount();
    return localId;
  }, [refreshCount]);

  const getPendingOrders = useCallback(async (): Promise<OfflineOrder[]> => {
    try {
      if (useFallbackRef.current) return lsGetAll();
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const orders = await new Promise<OfflineOrder[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return orders;
    } catch {
      useFallbackRef.current = true;
      return lsGetAll();
    }
  }, []);

  const removeOrder = useCallback(async (localId: string) => {
    try {
      if (useFallbackRef.current) throw new Error('use-fallback');
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(localId);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      useFallbackRef.current = true;
      lsSetAll(lsGetAll().filter(o => o.localId !== localId));
    }
    await refreshCount();
    markSynced();
  }, [refreshCount, markSynced]);

  const updateOrder = useCallback(async (localId: string, patch: Partial<OfflineOrder>) => {
    try {
      if (useFallbackRef.current) throw new Error('use-fallback');
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const existing = await new Promise<OfflineOrder | undefined>((resolve, reject) => {
        const req = store.get(localId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (existing) {
        store.put({ ...existing, ...patch });
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      useFallbackRef.current = true;
      const all = lsGetAll();
      const idx = all.findIndex(o => o.localId === localId);
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...patch };
        lsSetAll(all);
      }
    }
    await refreshCount();
  }, [refreshCount]);

  return {
    isOnline,
    pendingCount,
    syncing,
    setSyncing,
    lastSync,
    saveOfflineOrder,
    getPendingOrders,
    removeOrder,
    updateOrder,
    refreshCount,
    markSynced,
  };
}

// ============================================================
// Menu cache helpers — preload menu locally for offline POS
// ============================================================

interface MenuCache {
  branchId: string;
  cachedAt: string;
  categories: any[];
  items: any[];
  addons: any[];
}

export function saveMenuCache(branchId: string, data: { categories: any[]; items: any[]; addons: any[] }) {
  try {
    const cache: MenuCache = {
      branchId,
      cachedAt: new Date().toISOString(),
      ...data,
    };
    localStorage.setItem(`${MENU_CACHE_KEY}-${branchId}`, JSON.stringify(cache));
  } catch { /* quota */ }
}

export function loadMenuCache(branchId: string): MenuCache | null {
  try {
    const raw = localStorage.getItem(`${MENU_CACHE_KEY}-${branchId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
