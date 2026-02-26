import { useState, useEffect, useCallback } from 'react';
import type { DevServer, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useDevServers() {
  const [servers, setServers] = useState<DevServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Initial load
  useEffect(() => {
    api.getDevServers().then((s) => {
      setServers(s ?? []);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  // Subscribe to updates
  useEffect(() => {
    const unsub = api.onDevServersUpdate((s: DevServer[]) => {
      setServers(s ?? []);
    });
    return unsub;
  }, []);

  const scanNow = useCallback(async () => {
    setIsScanning(true);
    try {
      const result = await api.scanDevServers();
      setServers(result ?? []);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const openUrl = useCallback(async (url: string) => {
    await api.openExternalUrl(url);
  }, []);

  return {
    servers,
    isLoading,
    isScanning,
    scanNow,
    openUrl,
  };
}
