import { Notification } from 'electron';
import type { SystemMonitor } from './system-monitor';
import type { ProcessMonitor } from './process-monitor';
import type { MemoryTracker } from './memory-tracker';
import { killByPid, trimWorkingSets } from './process-killer';
import type {
  TrimTarget,
  TrimResult,
  Recommendation,
  MultiProcessSummary,
  OptimizeAnalysis,
  OptimizeResult,
  AutoProtectSettings,
  ProcessInfo,
} from '@shared/types';
import {
  SYSTEM_PROTECTED,
  MULTI_PROCESS_APPS,
  IDLE_CPU_THRESHOLD,
  IDLE_HIGH_RAM_MB,
  TRIM_RAM_MEASURE_DELAY_MS,
} from '@shared/constants';

const MB = 1024 * 1024;

function isMultiProcessApp(name: string): boolean {
  return MULTI_PROCESS_APPS.has(name);
}

export class Optimizer {
  private autoProtect: AutoProtectSettings = {
    enabled: false,
    threshold: 85,
    autoTrim: false,
  };
  private lastAutoProtectNotify = 0;
  private readonly notifyCooldownMs = 60_000;
  private readonly onUpdate = (): void => { this.checkAutoProtect(); };

  constructor(
    private systemMonitor: SystemMonitor,
    private processMonitor: ProcessMonitor,
    private memoryTracker: MemoryTracker,
  ) {}

  start(): void {
    this.systemMonitor.on('update', this.onUpdate);
  }

  stop(): void {
    this.systemMonitor.off('update', this.onUpdate);
  }

  getAutoProtect(): AutoProtectSettings {
    return { ...this.autoProtect };
  }

  setAutoProtect(settings: AutoProtectSettings): void {
    // Handle migration from old schema (autoKill → autoTrim)
    const raw = settings as unknown as Record<string, unknown>;
    this.autoProtect = {
      enabled: Boolean(settings.enabled),
      threshold: Number.isFinite(settings.threshold) ? settings.threshold : 85,
      autoTrim: raw.autoTrim === true || raw.autoKill === true,
    };
  }

  // --- 3-tier analysis ---

  analyze(): OptimizeAnalysis {
    const processes = this.processMonitor.getProcesses();
    const stats = this.systemMonitor.getStats();
    const leaks = this.memoryTracker.getLeaks();

    // Tier 1: trim targets (all non-system processes)
    const trimTargets: TrimTarget[] = processes
      .filter((proc) => !SYSTEM_PROTECTED.has(proc.name))
      .map((proc) => ({
        pid: proc.pid,
        name: proc.name,
        currentWorkingSet: proc.ram,
        estimatedReclaimable: proc.cpu < IDLE_CPU_THRESHOLD
          ? Math.round(proc.ram * 0.4)
          : Math.round(proc.ram * 0.1),
      }));

    const estimatedTrimSavings = trimTargets.reduce(
      (sum, t) => sum + t.estimatedReclaimable,
      0,
    );

    // Tier 2: smart recommendations
    const recommendations: Recommendation[] = [];
    const multiProcessApps: MultiProcessSummary[] = [];
    const leakPids = new Set(leaks.map((l) => l.pid));

    // 2a. Real leak suspects from MemoryTracker
    for (const leak of leaks) {
      const growthMB = (leak.growthRate / MB).toFixed(1);
      const isCritical = leak.severity === 'critical';
      recommendations.push({
        pid: leak.pid,
        name: leak.name,
        ram: leak.currentMem,
        reason: isCritical ? 'leak-critical' : 'leak-suspect',
        riskLevel: isCritical ? 'medium' : 'low',
        description: `Growing ${growthMB} MB/min for ${leak.duration.toFixed(0)} min`,
      });
    }

    // 2b. Idle processes with high RAM
    for (const proc of processes) {
      if (SYSTEM_PROTECTED.has(proc.name)) continue;
      if (leakPids.has(proc.pid)) continue;
      if (proc.cpu < IDLE_CPU_THRESHOLD && proc.ram > IDLE_HIGH_RAM_MB * MB) {
        recommendations.push({
          pid: proc.pid,
          name: proc.name,
          ram: proc.ram,
          reason: 'idle-high-ram',
          riskLevel: isMultiProcessApp(proc.name) ? 'high' : 'low',
          description: `Idle (${proc.cpu.toFixed(1)}% CPU) using ${(proc.ram / MB).toFixed(0)} MB`,
        });
      }
    }

    // 2c. Multi-process app summaries (informational only)
    const groups = new Map<string, ProcessInfo[]>();
    for (const proc of processes) {
      if (!isMultiProcessApp(proc.name)) continue;
      const group = groups.get(proc.name);
      if (group) {
        group.push(proc);
      } else {
        groups.set(proc.name, [proc]);
      }
    }
    for (const [name, procs] of groups) {
      if (procs.length <= 1) continue;
      multiProcessApps.push({
        name,
        processCount: procs.length,
        totalRam: procs.reduce((sum, p) => sum + p.ram, 0),
        totalCpu: Math.round(procs.reduce((sum, p) => sum + p.cpu, 0) * 10) / 10,
        pids: procs.map((p) => p.pid),
      });
    }
    multiProcessApps.sort((a, b) => b.totalRam - a.totalRam);

    // Tier 3: manual kill list (never pre-selected)
    const killableProcesses = processes.filter(
      (proc) => !SYSTEM_PROTECTED.has(proc.name),
    );

    return {
      tier1: { trimTargets, estimatedSavings: estimatedTrimSavings },
      tier2: { recommendations, multiProcessApps },
      tier3: { killableProcesses },
      currentRamUsed: stats?.usedMem ?? 0,
      currentRamPercent: stats
        ? (stats.usedMem / stats.totalMem) * 100
        : 0,
    };
  }

  // --- Tier 1: safe trim ---

  async trim(pids?: number[]): Promise<TrimResult> {
    const stats = this.systemMonitor.getStats();
    const ramBefore = stats?.usedMem ?? 0;
    const processes = this.processMonitor.getProcesses();

    const targetPids = pids ?? processes
      .filter((p) => !SYSTEM_PROTECTED.has(p.name))
      .map((p) => p.pid);

    const procMap = new Map(processes.map((p) => [p.pid, p]));
    const result = await trimWorkingSets(targetPids);

    const trimmed = result.trimmed.map((pid) => ({
      pid,
      name: procMap.get(pid)?.name ?? 'unknown',
    }));

    const failed = result.failed.map((f) => ({
      pid: f.pid,
      name: procMap.get(f.pid)?.name ?? 'unknown',
      error: f.error,
    }));

    // Wait for OS to reclaim memory, then measure
    await new Promise((resolve) => setTimeout(resolve, TRIM_RAM_MEASURE_DELAY_MS));
    const statsAfter = this.systemMonitor.getStats();
    const ramAfter = statsAfter?.usedMem ?? ramBefore;

    return { trimmed, failed, ramBefore, ramAfter };
  }

  // --- Tier 3: manual kill (same as before) ---

  async execute(pids: number[]): Promise<OptimizeResult> {
    const stats = this.systemMonitor.getStats();
    const ramBefore = stats?.usedMem ?? 0;
    const processes = this.processMonitor.getProcesses();
    const procMap = new Map(processes.map((p) => [p.pid, p]));

    const killed: { pid: number; name: string; ram: number }[] = [];
    const failed: { pid: number; name: string; error: string }[] = [];

    for (const pid of pids) {
      const proc = procMap.get(pid);
      const name = proc?.name ?? 'unknown';

      if (SYSTEM_PROTECTED.has(name)) {
        failed.push({ pid, name, error: 'Protected system process' });
        continue;
      }

      const result = await killByPid(pid, name);
      if (result.success) {
        killed.push({ pid, name, ram: proc?.ram ?? 0 });
      } else {
        failed.push({ pid, name, error: result.error ?? 'Unknown error' });
      }
    }

    const ramFreed = killed.reduce((sum, k) => sum + k.ram, 0);
    return { ramBefore, ramFreed, killed, failed };
  }

  // --- Auto-protect: trim-based, never kills ---

  private checkAutoProtect(): void {
    if (!this.autoProtect.enabled) return;

    const stats = this.systemMonitor.getStats();
    if (!stats) return;

    const ramPercent = (stats.usedMem / stats.totalMem) * 100;
    if (ramPercent < this.autoProtect.threshold) return;

    const now = Date.now();
    if (now - this.lastAutoProtectNotify < this.notifyCooldownMs) return;
    this.lastAutoProtectNotify = now;

    if (this.autoProtect.autoTrim) {
      this.trim().then((result) => {
        if (!Notification.isSupported()) return;
        const saved = ((result.ramBefore - result.ramAfter) / MB).toFixed(0);
        const n = new Notification({
          title: 'MemoryGuy Auto-Protect',
          body: `RAM ${ramPercent.toFixed(0)}% — trimmed ${result.trimmed.length} processes, reclaimed ~${saved} MB`,
        });
        n.show();
      }).catch(() => {
        // Silently ignore trim failures in auto-protect
      });
    } else {
      if (!Notification.isSupported()) return;
      const leaks = this.memoryTracker.getLeaks();
      const used = (stats.usedMem / 1024 / MB).toFixed(1);
      const total = (stats.totalMem / 1024 / MB).toFixed(1);
      const leakMsg = leaks.length > 0
        ? ` (${leaks.length} potential leak${leaks.length > 1 ? 's' : ''} detected)`
        : '';
      const n = new Notification({
        title: 'RAM Usage High',
        body: `${ramPercent.toFixed(0)}% (${used}/${total} GB)${leakMsg} — open MemoryGuy to optimize`,
      });
      n.show();
    }
  }
}
