import { Notification } from 'electron';
import type { SystemMonitor } from './system-monitor';
import type { ProcessMonitor } from './process-monitor';
import type { MemoryTracker } from './memory-tracker';
import { killByPid } from './process-killer';
import type {
  OptimizeTarget,
  OptimizeAnalysis,
  OptimizeResult,
  AutoProtectSettings,
} from '@shared/types';

const HEAVY_THRESHOLD = 500 * 1024 * 1024; // 500 MB

// Processes we never auto-kill
const KEEP_ALIVE = new Set([
  'explorer.exe',
  'csrss.exe',
  'winlogon.exe',
  'lsass.exe',
  'services.exe',
  'svchost.exe',
  'smss.exe',
  'wininit.exe',
  'dwm.exe',
  'fontdrvhost.exe',
  'sihost.exe',
  'taskhostw.exe',
  'System',
  'System Idle Process',
  'Registry',
  'Memory Compression',
  'electron.exe', // don't kill ourselves
]);

export class Optimizer {
  private autoProtect: AutoProtectSettings = {
    enabled: false,
    threshold: 85,
    autoKill: false,
  };
  private lastAutoProtectNotify = 0;
  private readonly notifyCooldownMs = 60_000; // 1 min between notifications

  constructor(
    private systemMonitor: SystemMonitor,
    private processMonitor: ProcessMonitor,
    private memoryTracker: MemoryTracker,
  ) {}

  start(): void {
    this.systemMonitor.on('update', () => this.checkAutoProtect());
  }

  stop(): void {
    this.systemMonitor.off('update', () => this.checkAutoProtect());
  }

  getAutoProtect(): AutoProtectSettings {
    return { ...this.autoProtect };
  }

  setAutoProtect(settings: AutoProtectSettings): void {
    this.autoProtect = { ...settings };
  }

  analyze(): OptimizeAnalysis {
    const processes = this.processMonitor.getProcesses();
    const stats = this.systemMonitor.getStats();
    const leaks = this.memoryTracker.getLeaks();
    const leakPids = new Set(leaks.map((l) => l.pid));

    const targets: OptimizeTarget[] = [];

    // Find duplicates: group by name, mark all but the largest as killable
    const groups = new Map<string, typeof processes>();
    for (const proc of processes) {
      if (KEEP_ALIVE.has(proc.name)) continue;
      const group = groups.get(proc.name) ?? [];
      groups.set(proc.name, [...group, proc]);
    }

    for (const [, procs] of groups) {
      if (procs.length <= 1) continue;
      // Sort by RAM desc, keep the largest, mark rest as duplicate
      const sorted = [...procs].sort((a, b) => b.ram - a.ram);
      for (const proc of sorted.slice(1)) {
        targets.push({
          pid: proc.pid,
          name: proc.name,
          ram: proc.ram,
          reason: 'duplicate',
        });
      }
    }

    // Find heavy processes (>500MB, not already in targets)
    const targetPids = new Set(targets.map((t) => t.pid));
    for (const proc of processes) {
      if (KEEP_ALIVE.has(proc.name)) continue;
      if (targetPids.has(proc.pid)) continue;
      if (proc.ram > HEAVY_THRESHOLD) {
        targets.push({
          pid: proc.pid,
          name: proc.name,
          ram: proc.ram,
          reason: 'heavy',
        });
      }
    }

    // Flag leak suspects
    for (const target of targets) {
      if (leakPids.has(target.pid)) {
        target.reason = 'leak-suspect';
      }
    }

    // Also add leak suspects not already in targets
    for (const leak of leaks) {
      if (!targets.some((t) => t.pid === leak.pid) && !KEEP_ALIVE.has(leak.name)) {
        targets.push({
          pid: leak.pid,
          name: leak.name,
          ram: leak.currentMem,
          reason: 'leak-suspect',
        });
      }
    }

    // Sort by RAM desc
    targets.sort((a, b) => b.ram - a.ram);

    const estimatedSavings = targets
      .filter((t) => t.reason === 'duplicate')
      .reduce((sum, t) => sum + t.ram, 0);

    return {
      targets,
      estimatedSavings,
      currentRamUsed: stats?.usedMem ?? 0,
      currentRamPercent: stats
        ? (stats.usedMem / stats.totalMem) * 100
        : 0,
    };
  }

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

      if (KEEP_ALIVE.has(name)) {
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

  private checkAutoProtect(): void {
    if (!this.autoProtect.enabled) return;

    const stats = this.systemMonitor.getStats();
    if (!stats) return;

    const ramPercent = (stats.usedMem / stats.totalMem) * 100;
    if (ramPercent < this.autoProtect.threshold) return;

    const now = Date.now();
    if (now - this.lastAutoProtectNotify < this.notifyCooldownMs) return;
    this.lastAutoProtectNotify = now;

    if (this.autoProtect.autoKill) {
      // Auto-kill duplicates only (safest)
      const analysis = this.analyze();
      const duplicatePids = analysis.targets
        .filter((t) => t.reason === 'duplicate')
        .map((t) => t.pid);

      if (duplicatePids.length > 0) {
        this.execute(duplicatePids).then((result) => {
          if (Notification.isSupported() && result.killed.length > 0) {
            const freed = (result.ramFreed / 1024 / 1024).toFixed(0);
            const n = new Notification({
              title: 'MemoryGuy Auto-Protect',
              body: `RAM ${ramPercent.toFixed(0)}% — killed ${result.killed.length} duplicates, freed ${freed} MB`,
            });
            n.show();
          }
        });
      }
    } else {
      // Notify only
      if (Notification.isSupported()) {
        const used = (stats.usedMem / 1024 / 1024 / 1024).toFixed(1);
        const total = (stats.totalMem / 1024 / 1024 / 1024).toFixed(1);
        const n = new Notification({
          title: 'RAM Usage High',
          body: `${ramPercent.toFixed(0)}% (${used}/${total} GB) — open MemoryGuy to optimize`,
        });
        n.show();
      }
    }
  }
}
