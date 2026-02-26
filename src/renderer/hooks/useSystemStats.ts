import { useState, useEffect, useCallback } from 'react';
import type { SystemStats, MemorySnapshot } from '@shared/types';
import type { MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [ramHistory, setRamHistory] = useState<MemorySnapshot[]>([]);
  const [cpuHistory, setCpuHistory] = useState<MemorySnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    async function init() {
      const [initialStats, history] = await Promise.all([
        api.getSystemStats(),
        api.getMemoryHistory(),
      ]);
      if (initialStats) setStats(initialStats);
      if (history) {
        const h = history as { ram: MemorySnapshot[]; cpu: MemorySnapshot[] };
        setRamHistory(h.ram || []);
        setCpuHistory(h.cpu || []);
      }
      setIsLoading(false);
    }
    init();
  }, []);

  // Subscribe to push updates
  const handleUpdate = useCallback((newStats: SystemStats) => {
    setStats(newStats);
    setRamHistory((prev) => {
      const next = [...prev, { timestamp: newStats.timestamp, value: newStats.usedMem }];
      return next.length > 1800 ? next.slice(-1800) : next;
    });
    setCpuHistory((prev) => {
      const next = [...prev, { timestamp: newStats.timestamp, value: newStats.cpuLoad }];
      return next.length > 1800 ? next.slice(-1800) : next;
    });
  }, []);

  useEffect(() => {
    const unsub = api.onSystemUpdate(handleUpdate as (s: unknown) => void);
    return unsub;
  }, [handleUpdate]);

  return { stats, ramHistory, cpuHistory, isLoading };
}
