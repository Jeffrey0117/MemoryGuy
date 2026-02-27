import { useState, useEffect, useCallback } from 'react';
import type { VirtScanItem, VirtScanResult, VirtProgress, VirtPushResult, VirtPullResult, VirtStatusResult, VirtConfig, MemoryGuyAPI } from '@shared/types';

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

  useEffect(() => {
    const unsub = api.onVirtProgress((p: VirtProgress) => {
      setProgress(p);
    });
    return unsub;
  }, []);

  useEffect(() => {
    api.virtConfigLoad().then((c) => setConfig(c)).catch(() => { /* ignore */ });
  }, []);

  const scan = useCallback(async (thresholdBytes: number) => {
    setIsScanning(true);
    setItems([]);
    setPushResult(null);
    setPullResult(null);
    setScanDurationMs(0);
    setProgress(null);
    try {
      const result: VirtScanResult = await api.virtScan(thresholdBytes);
      setItems(result.items);
      setScanDurationMs(result.scanDurationMs);
    } catch {
      // Scan cancelled or failed
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, []);

  const push = useCallback(async (filePaths: string[]) => {
    setIsPushing(true);
    setPushResult(null);
    setProgress(null);
    try {
      const result = await api.virtPush(filePaths);
      setPushResult(result);
      // Remove pushed items from the list
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
      // Remove pulled items from the list
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
    push,
    pull,
    cancel,
    loadStatus,
    saveConfig,
  };
}
