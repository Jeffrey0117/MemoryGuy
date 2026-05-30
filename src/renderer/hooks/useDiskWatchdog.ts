import { useState, useEffect, useCallback } from 'react';
import type { DiskWatchdogSettings, DriveSpace, DiskAlertTestResult, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useDiskWatchdog() {
  const [settings, setSettings] = useState<DiskWatchdogSettings | null>(null);
  const [drives, setDrives] = useState<DriveSpace[]>([]);

  useEffect(() => {
    api.getDiskWatchdog().then(setSettings).catch(() => {});
    api.getDriveSpaces().then(setDrives).catch(() => {});
    const unsub = api.onDiskWatchdogUpdate((d) => setDrives(d));
    return unsub;
  }, []);

  const save = useCallback(async (next: Partial<DiskWatchdogSettings>): Promise<DiskWatchdogSettings> => {
    const updated = await api.setDiskWatchdog(next);
    setSettings(updated);
    api.getDriveSpaces().then(setDrives).catch(() => {});
    return updated;
  }, []);

  const test = useCallback((): Promise<DiskAlertTestResult> => api.testDiskAlert(), []);

  const refresh = useCallback(() => {
    api.getDriveSpaces().then(setDrives).catch(() => {});
  }, []);

  return { settings, drives, save, test, refresh };
}
