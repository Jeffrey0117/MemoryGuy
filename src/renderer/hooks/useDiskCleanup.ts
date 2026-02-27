import { useState, useEffect, useCallback } from 'react';
import type { DiskCleanupItem, DiskScanResult, DiskCleanResult, DiskScanProgress, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useDiskCleanup() {
  const [items, setItems] = useState<readonly DiskCleanupItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanDurationMs, setScanDurationMs] = useState(0);
  const [progress, setProgress] = useState<DiskScanProgress>({ scanned: 0, found: 0, totalBytes: 0 });
  const [cleanResult, setCleanResult] = useState<DiskCleanResult | null>(null);

  useEffect(() => {
    const unsub = api.onDiskScanProgress((p: DiskScanProgress) => {
      setProgress(p);
    });
    return unsub;
  }, []);

  const scan = useCallback(async () => {
    setIsScanning(true);
    setItems([]);
    setCleanResult(null);
    setScanDurationMs(0);
    setProgress({ scanned: 0, found: 0, totalBytes: 0 });
    try {
      const result: DiskScanResult = await api.scanDiskCleanup();
      setItems(result.items);
      setScanDurationMs(result.scanDurationMs);
    } catch {
      // Scan cancelled or failed
    } finally {
      setIsScanning(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    await api.cancelDiskScan();
  }, []);

  const clean = useCallback(async (paths: string[], sizes: Record<string, number>) => {
    setIsCleaning(true);
    setCleanResult(null);
    try {
      const result = await api.executeDiskCleanup(paths, sizes);
      setCleanResult(result);
      // Remove cleaned items from the list
      const cleanedPaths = new Set(result.cleaned.map((c) => c.path));
      setItems((prev) => prev.filter((item) => !cleanedPaths.has(item.path)));
    } finally {
      setIsCleaning(false);
    }
  }, []);

  return {
    items,
    isScanning,
    isCleaning,
    scanDurationMs,
    progress,
    cleanResult,
    scan,
    cancel,
    clean,
  };
}
