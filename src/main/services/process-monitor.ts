import si from 'systeminformation';
import { EventEmitter } from 'events';
import type { ProcessInfo } from '@shared/types';
import { PROCESS_POLL_MS } from '@shared/constants';

export class ProcessMonitor extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentProcesses: ProcessInfo[] = [];
  private ramSamples: Map<number, number[]> = new Map();
  private readonly MAX_TREND_SAMPLES = 5;

  start(): void {
    if (this.interval) return;
    this.poll();
    this.interval = setInterval(() => this.poll(), PROCESS_POLL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getProcesses(): ProcessInfo[] {
    return [...this.currentProcesses];
  }

  private computeTrend(pid: number, currentRam: number): 'up' | 'down' | 'stable' {
    const samples = this.ramSamples.get(pid);
    if (!samples || samples.length < 3) return 'stable';

    const older = samples.slice(-3, -1);
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    const threshold = avgOlder * 0.05;

    if (currentRam > avgOlder + threshold) return 'up';
    if (currentRam < avgOlder - threshold) return 'down';
    return 'stable';
  }

  private async poll(): Promise<void> {
    try {
      const data = await si.processes();

      const processes: ProcessInfo[] = data.list
        .filter((p) => p.memRss > 0)
        .map((p) => {
          const ram = p.memRss;

          // Track RAM samples for trend
          const samples = this.ramSamples.get(p.pid) ?? [];
          const updated = [...samples, ram];
          this.ramSamples.set(
            p.pid,
            updated.length > this.MAX_TREND_SAMPLES
              ? updated.slice(-this.MAX_TREND_SAMPLES)
              : updated,
          );

          return {
            pid: p.pid,
            name: p.name,
            ram,
            cpu: Math.round(p.cpu * 10) / 10,
            trend: this.computeTrend(p.pid, ram),
            isLeakSuspect: false,
          };
        })
        .sort((a, b) => b.ram - a.ram);

      // Prune dead PIDs from samples map
      const alivePids = new Set(data.list.map((p) => p.pid));
      for (const pid of this.ramSamples.keys()) {
        if (!alivePids.has(pid)) {
          this.ramSamples.delete(pid);
        }
      }

      this.currentProcesses = processes;
      this.emit('process-update', processes);
    } catch (err) {
      console.error('ProcessMonitor poll error:', err);
    }
  }
}
