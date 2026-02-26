import { useState, useEffect } from 'react';
import type { LeakInfo, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useLeakDetection() {
  const [leaks, setLeaks] = useState<LeakInfo[]>([]);

  // Load existing leaks
  useEffect(() => {
    api.getLeakSuspects().then((existing) => {
      setLeaks(existing ?? []);
    });
  }, []);

  // Subscribe to new leak events
  useEffect(() => {
    const unsub = api.onLeakDetected((leak: LeakInfo) => {
      setLeaks((prev) => {
        const filtered = prev.filter((l) => l.pid !== leak.pid);
        return [...filtered, leak];
      });
    });
    return unsub;
  }, []);

  const dismissLeak = (pid: number) => {
    setLeaks((prev) => prev.filter((l) => l.pid !== pid));
  };

  return { leaks, dismissLeak };
}
