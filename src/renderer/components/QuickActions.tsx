import { useState, useEffect, useCallback } from 'react';
import type {
  ProcessInfo,
  ProcessGroup,
  OptimizeAnalysis,
  OptimizeResult,
  AutoProtectSettings,
  MemoryGuyAPI,
} from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const REASON_LABEL: Record<string, string> = {
  duplicate: 'Duplicate',
  heavy: 'Heavy (>500MB)',
  'leak-suspect': 'Leak Suspect',
};

const REASON_COLOR: Record<string, string> = {
  duplicate: 'text-blue-400',
  heavy: 'text-amber-400',
  'leak-suspect': 'text-red-400',
};

export function QuickActions() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [analysis, setAnalysis] = useState<OptimizeAnalysis | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
  const [autoProtect, setAutoProtect] = useState<AutoProtectSettings>({
    enabled: false,
    threshold: 85,
    autoKill: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load initial data
  useEffect(() => {
    Promise.all([
      api.getProcessList(),
      api.getAutoProtect(),
    ]).then(([procs, protect]) => {
      setProcesses(procs ?? []);
      setAutoProtect(protect);
      setIsLoading(false);
    });
  }, []);

  // Subscribe to process updates
  useEffect(() => {
    const unsub = api.onProcessUpdate((procs: ProcessInfo[]) => {
      setProcesses(procs ?? []);
    });
    return unsub;
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setResult(null);
    const data = await api.analyzeOptimize();
    setAnalysis(data);
    // Select all duplicates by default
    const defaultSelected = new Set(
      data.targets.filter((t) => t.reason === 'duplicate').map((t) => t.pid),
    );
    setSelectedPids(defaultSelected);
    setIsAnalyzing(false);
  }, []);

  const handleOptimize = useCallback(async () => {
    if (selectedPids.size === 0) return;
    setIsOptimizing(true);
    const res = await api.executeOptimize([...selectedPids]);
    setResult(res);
    setAnalysis(null);
    setSelectedPids(new Set());
    setIsOptimizing(false);
  }, [selectedPids]);

  const togglePid = (pid: number) => {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!analysis) return;
    setSelectedPids(new Set(analysis.targets.map((t) => t.pid)));
  };

  const selectNone = () => setSelectedPids(new Set());

  const handleAutoProtectToggle = async (
    field: keyof AutoProtectSettings,
    value: boolean | number,
  ) => {
    const updated = { ...autoProtect, [field]: value };
    setAutoProtect(updated);
    await api.setAutoProtect(updated);
  };

  const top5 = processes.slice(0, 5);

  // Duplicate groups
  const duplicates: ProcessGroup[] = [];
  const nameMap = new Map<string, ProcessInfo[]>();
  for (const proc of processes) {
    const group = nameMap.get(proc.name) ?? [];
    nameMap.set(proc.name, [...group, proc]);
  }
  for (const [name, procs] of nameMap) {
    if (procs.length > 1) {
      duplicates.push({
        name,
        pids: procs.map((p) => p.pid),
        totalRam: procs.reduce((s, p) => s + p.ram, 0),
        totalCpu: Math.round(procs.reduce((s, p) => s + p.cpu, 0) * 10) / 10,
        count: procs.length,
        processes: procs,
      });
    }
  }
  duplicates.sort((a, b) => b.totalRam - a.totalRam);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* One-Click Optimize */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">One-Click Optimize</h3>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white
              hover:bg-mg-primary/80 transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-mg-muted">
              <span>
                RAM: {analysis.currentRamPercent.toFixed(0)}% | Found{' '}
                {analysis.targets.length} targets | Estimated savings:{' '}
                <span className="text-green-400">
                  {formatBytes(analysis.estimatedSavings)}
                </span>
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-mg-primary hover:underline">
                  All
                </button>
                <button onClick={selectNone} className="text-mg-primary hover:underline">
                  None
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {analysis.targets.map((target) => (
                <label
                  key={target.pid}
                  className="flex items-center gap-3 py-1.5 px-3 rounded bg-mg-bg/50
                    hover:bg-mg-bg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedPids.has(target.pid)}
                    onChange={() => togglePid(target.pid)}
                    className="accent-mg-primary"
                  />
                  <span className="text-sm text-white flex-1">{target.name}</span>
                  <span className={`text-xs ${REASON_COLOR[target.reason]}`}>
                    {REASON_LABEL[target.reason]}
                  </span>
                  <span className="text-xs font-mono text-mg-muted w-20 text-right">
                    {formatBytes(target.ram)}
                  </span>
                </label>
              ))}
            </div>

            {analysis.targets.length === 0 && (
              <div className="text-center text-mg-muted text-sm py-4">
                System looks clean — no optimization targets found
              </div>
            )}

            {selectedPids.size > 0 && (
              <button
                onClick={handleOptimize}
                disabled={isOptimizing}
                className="w-full py-2 rounded bg-green-600 text-white text-sm font-medium
                  hover:bg-green-500 transition-colors disabled:opacity-50"
              >
                {isOptimizing
                  ? 'Optimizing...'
                  : `Optimize (${selectedPids.size} targets)`}
              </button>
            )}
          </div>
        )}

        {/* Optimize Result */}
        {result && (
          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-4 py-3 px-4 rounded bg-green-900/20 border border-green-500/30">
              <span className="text-green-400 text-sm font-medium">Done</span>
              <span className="text-white text-sm">
                Killed {result.killed.length} processes — freed{' '}
                <span className="text-green-400 font-mono">
                  {formatBytes(result.ramFreed)}
                </span>
              </span>
            </div>
            {result.failed.length > 0 && (
              <div className="text-xs text-red-400 px-4">
                {result.failed.length} failed:{' '}
                {result.failed.map((f) => `${f.name} (${f.error})`).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-Protect */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-white mb-3">Auto-Protect</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-mg-muted">Enable auto-protect</span>
            <input
              type="checkbox"
              checked={autoProtect.enabled}
              onChange={(e) => handleAutoProtectToggle('enabled', e.target.checked)}
              className="accent-mg-primary w-4 h-4"
            />
          </label>

          {autoProtect.enabled && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-mg-muted">RAM threshold</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={50}
                    max={95}
                    step={5}
                    value={autoProtect.threshold}
                    onChange={(e) =>
                      handleAutoProtectToggle('threshold', Number(e.target.value))
                    }
                    className="w-24 accent-mg-primary"
                  />
                  <span className="text-sm text-white font-mono w-10 text-right">
                    {autoProtect.threshold}%
                  </span>
                </div>
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm text-mg-muted">Auto-kill duplicates</span>
                  <p className="text-xs text-mg-muted/60 mt-0.5">
                    Automatically kill duplicate processes when threshold exceeded
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoProtect.autoKill}
                  onChange={(e) => handleAutoProtectToggle('autoKill', e.target.checked)}
                  className="accent-mg-primary w-4 h-4"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Top 5 RAM */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-mg-muted mb-3">Top 5 RAM Usage</h3>
        <div className="space-y-2">
          {top5.map((proc, i) => (
            <div
              key={proc.pid}
              className="flex items-center justify-between py-2 px-3 rounded bg-mg-bg/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-mg-muted w-5">{i + 1}.</span>
                <span className="text-sm text-white">{proc.name}</span>
                <span className="text-xs text-mg-muted">PID {proc.pid}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-white">
                  {formatBytes(proc.ram)}
                </span>
                <span className="text-xs font-mono text-mg-muted w-12 text-right">
                  {proc.cpu.toFixed(1)}%
                </span>
                <KillButton onClick={() => api.killProcess(proc.pid)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Duplicates */}
      {duplicates.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-mg-muted mb-3">
            Duplicate Processes ({duplicates.length} groups)
          </h3>
          <div className="space-y-2">
            {duplicates.slice(0, 10).map((group) => (
              <div
                key={group.name}
                className="flex items-center justify-between py-2 px-3 rounded bg-mg-bg/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white">{group.name}</span>
                  <span className="text-xs text-mg-muted">
                    {group.count} instances
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-white">
                    {formatBytes(group.totalRam)}
                  </span>
                  <KillButton
                    label="Kill All"
                    confirmLabel="Kill All?"
                    onClick={() => api.killProcessGroup(group.name)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KillButton({
  onClick,
  label = 'Kill',
  confirmLabel = 'Sure?',
}: {
  onClick: () => void;
  label?: string;
  confirmLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setConfirming(false);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`text-xs px-2 py-1 rounded transition-colors ${
        confirming
          ? 'bg-red-600 text-white hover:bg-red-500'
          : 'bg-mg-border/50 text-mg-muted hover:text-white hover:bg-mg-border'
      }`}
    >
      {confirming ? confirmLabel : label}
    </button>
  );
}
