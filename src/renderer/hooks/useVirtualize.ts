import { useState, useEffect, useCallback } from 'react';
import type { VirtScanItem, VirtScanResult, VirtProgress, VirtPushResult, VirtPullResult, VirtStatusResult, VirtConfig, WatchFolder, WatchEvent, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useVirtualize() {
  const [items, setItems] = useState<readonly VirtScanItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [scanDurationMs, setScanDurationMs] = useState(0);
  const [progress, setProgress] = useState<VirtProgress | null>(null);
  const [pushResult, setPushResult] = useState<VirtPushResult | null>(null);
  const [pullResult, setPullResult] = useState<VirtPullResult | null>(null);
  const [status, setStatus] = useState<VirtStatusResult | null>(null);
  const [config, setConfig] = useState<VirtConfig | null>(null);

  // Watch state
  const [watchFolders, setWatchFolders] = useState<readonly WatchFolder[]>([]);
  const [watchEvents, setWatchEvents] = useState<readonly WatchEvent[]>([]);

  useEffect(() => {
    const unsub = api.onVirtProgress((p: VirtProgress) => {
      setProgress(p);
    });
    return unsub;
  }, []);

  useEffect(() => {
    api.virtConfigLoad().then((c) => setConfig(c)).catch(() => { /* ignore */ });
  }, []);

  // Subscribe to watch events
  useEffect(() => {
    const unsub = api.onVirtWatchEvent((event: WatchEvent) => {
      setWatchEvents((prev) => [...prev, event]);
    });
    return unsub;
  }, []);

  const scan = useCallback(async () => {
    setIsScanning(true);
    setItems([]);
    setPushResult(null);
    setPullResult(null);
    setScanDurationMs(0);
    setProgress(null);
    try {
      const result: VirtScanResult = await api.virtScan();
      setItems(result.items);
      setScanDurationMs(result.scanDurationMs);
    } catch {
      // Scan cancelled or failed
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, []);

  const scanFolder = useCallback(async (folderPath: string) => {
    setIsScanning(true);
    setItems([]);
    setScanDurationMs(0);
    setProgress(null);
    try {
      const result: VirtScanResult = await api.virtScanFolder(folderPath);
      setItems(result.items);
      setScanDurationMs(result.scanDurationMs);
    } catch {
      // Scan cancelled or failed
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, []);

  const selectFolder = useCallback(async (): Promise<string | null> => {
    return api.virtSelectFolder();
  }, []);

  const push = useCallback(async (filePaths: string[]) => {
    setIsPushing(true);
    setPushResult(null);
    setProgress(null);
    try {
      const result = await api.virtPush(filePaths);
      setPushResult(result);
      const pushedPaths = new Set(filePaths);
      setItems((prev) => prev.filter((item) => !pushedPaths.has(item.path) || result.errors.some((e) => e.startsWith(`${item.path}:`))));
    } finally {
      setIsPushing(false);
      setProgress(null);
    }
  }, []);

  const pull = useCallback(async (refilePaths: string[]) => {
    setIsPulling(true);
    setPullResult(null);
    setProgress(null);
    try {
      const result = await api.virtPull(refilePaths);
      setPullResult(result);
      const pulledPaths = new Set(refilePaths);
      setItems((prev) => prev.filter((item) => !pulledPaths.has(item.path) || result.errors.some((e) => e.startsWith(`${item.path}:`))));
    } finally {
      setIsPulling(false);
      setProgress(null);
    }
  }, []);

  const cancel = useCallback(async () => {
    await api.virtCancel();
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.virtStatus();
      setStatus(s);
    } catch {
      // ignore
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: VirtConfig) => {
    await api.virtConfigSave(newConfig);
    setConfig(newConfig);
  }, []);

  // Watch folder operations
  const loadWatchFolders = useCallback(async () => {
    try {
      const folders = await api.virtGetWatchFolders();
      setWatchFolders(folders);
    } catch {
      // ignore
    }
  }, []);

  const loadWatchEvents = useCallback(async () => {
    try {
      const events = await api.virtGetWatchEvents();
      setWatchEvents(events);
    } catch {
      // ignore
    }
  }, []);

  const addWatchFolder = useCallback(async (folderPath: string, thresholdBytes: number) => {
    await api.virtAddWatchFolder(folderPath, thresholdBytes);
    await loadWatchFolders();
  }, [loadWatchFolders]);

  const removeWatchFolder = useCallback(async (id: string) => {
    await api.virtRemoveWatchFolder(id);
    await loadWatchFolders();
  }, [loadWatchFolders]);

  const toggleWatchFolder = useCallback(async (id: string) => {
    await api.virtToggleWatchFolder(id);
    await loadWatchFolders();
  }, [loadWatchFolders]);

  const clearWatchEvents = useCallback(async () => {
    await api.virtClearWatchEvents();
    setWatchEvents([]);
  }, []);

  const selectWatchFolder = useCallback(async (): Promise<string | null> => {
    return api.virtSelectWatchFolder();
  }, []);

  return {
    items,
    isScanning,
    isPushing,
    isPulling,
    scanDurationMs,
    progress,
    pushResult,
    pullResult,
    status,
    config,
    scan,
    scanFolder,
    selectFolder,
    push,
    pull,
    cancel,
    loadStatus,
    saveConfig,
    // Watch
    watchFolders,
    watchEvents,
    loadWatchFolders,
    loadWatchEvents,
    addWatchFolder,
    removeWatchFolder,
    toggleWatchFolder,
    clearWatchEvents,
    selectWatchFolder,
  };
}
