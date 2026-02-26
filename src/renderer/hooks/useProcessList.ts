import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ProcessInfo, ProcessGroup, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export type SortField = 'name' | 'ram' | 'cpu';
export type SortDir = 'asc' | 'desc';

export function useProcessList() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('ram');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [grouped, setGrouped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load
  useEffect(() => {
    api.getProcessList().then((procs) => {
      setProcesses(procs ?? []);
      setIsLoading(false);
    });
  }, []);

  // Push subscription
  useEffect(() => {
    const unsub = api.onProcessUpdate((procs: ProcessInfo[]) => {
      setProcesses(procs ?? []);
    });
    return unsub;
  }, []);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortDir(field === 'name' ? 'asc' : 'desc');
      }
    },
    [sortBy],
  );

  // Filter + sort
  const filtered = useMemo(() => {
    let result = processes;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || String(p.pid).includes(q),
      );
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'cpu':
          return dir * (a.cpu - b.cpu);
        case 'ram':
        default:
          return dir * (a.ram - b.ram);
      }
    });
  }, [processes, search, sortBy, sortDir]);

  // Group by name
  const groups = useMemo<ProcessGroup[] | null>(() => {
    if (!grouped) return null;

    const map = new Map<string, ProcessGroup>();
    for (const proc of filtered) {
      const existing = map.get(proc.name);
      if (existing) {
        map.set(proc.name, {
          ...existing,
          pids: [...existing.pids, proc.pid],
          totalRam: existing.totalRam + proc.ram,
          totalCpu: Math.round((existing.totalCpu + proc.cpu) * 10) / 10,
          count: existing.count + 1,
          processes: [...existing.processes, proc],
        });
      } else {
        map.set(proc.name, {
          name: proc.name,
          pids: [proc.pid],
          totalRam: proc.ram,
          totalCpu: proc.cpu,
          count: 1,
          processes: [proc],
        });
      }
    }

    return [...map.values()].sort((a, b) => b.totalRam - a.totalRam);
  }, [filtered, grouped]);

  const handleKill = useCallback(async (pid: number) => {
    return api.killProcess(pid);
  }, []);

  const handleKillGroup = useCallback(async (name: string) => {
    return api.killProcessGroup(name);
  }, []);

  return {
    processes: filtered,
    groups,
    search,
    setSearch,
    sortBy,
    sortDir,
    toggleSort,
    grouped,
    setGrouped,
    isLoading,
    handleKill,
    handleKillGroup,
  };
}
