import { useState, useEffect, useCallback } from 'react';
import type { ProtectionRule, GuardianEvent, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useGuardian() {
  const [rules, setRules] = useState<ProtectionRule[]>([]);
  const [watchedProcesses, setWatchedProcesses] = useState<{ pid: number; name: string; detectedAt: number }[]>([]);
  const [eventLog, setEventLog] = useState<GuardianEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load
  useEffect(() => {
    Promise.all([
      api.getProtectionRules(),
      api.getWatchedProcesses(),
      api.getGuardianLog(),
    ]).then(([r, w, e]) => {
      setRules(r ?? []);
      setWatchedProcesses(w ?? []);
      setEventLog(e ?? []);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  // Subscribe to termination events
  useEffect(() => {
    const unsub = api.onProcessTerminated((event: GuardianEvent) => {
      setEventLog((prev) => [event, ...prev].slice(0, 100));
    });
    return unsub;
  }, []);

  // Refresh watched processes on process updates
  useEffect(() => {
    const unsub = api.onProcessUpdate(() => {
      api.getWatchedProcesses().then((w) => setWatchedProcesses(w ?? []));
    });
    return unsub;
  }, []);

  const addRule = useCallback(async (input: { pattern: string; label: string; mode: 'watch' | 'protect'; enabled: boolean }) => {
    const rule = await api.addProtectionRule(input);
    if (rule) {
      setRules((prev) => [...prev, rule]);
    }
    return rule;
  }, []);

  const removeRule = useCallback(async (id: string) => {
    await api.removeProtectionRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRule = useCallback(async (id: string, updates: Partial<Pick<ProtectionRule, 'enabled' | 'mode' | 'label'>>) => {
    const updated = await api.updateProtectionRule(id, updates);
    if (updated) {
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    }
    return updated;
  }, []);

  const clearLog = useCallback(async () => {
    await api.clearGuardianLog();
    setEventLog([]);
  }, []);

  const generateHook = useCallback(async () => {
    return api.generateHook();
  }, []);

  return {
    rules,
    watchedProcesses,
    eventLog,
    isLoading,
    addRule,
    removeRule,
    updateRule,
    clearLog,
    generateHook,
  };
}
