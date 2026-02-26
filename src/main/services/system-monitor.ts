import si from 'systeminformation';
import { EventEmitter } from 'events';
import type { SystemStats, MemorySnapshot } from '@shared/types';
import { SYSTEM_POLL_MS, HISTORY_MAX_SAMPLES } from '@shared/constants';

export class SystemMonitor extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentStats: SystemStats | null = null;
  private ramHistory: MemorySnapshot[] = [];
  private cpuHistory: MemorySnapshot[] = [];

  start(): void {
    if (this.interval) return;

    // Poll immediately, then on interval
    this.poll();
    this.interval = setInterval(() => this.poll(), SYSTEM_POLL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStats(): SystemStats | null {
    return this.currentStats;
  }

  getRamHistory(): MemorySnapshot[] {
    return [...this.ramHistory];
  }

  getCpuHistory(): MemorySnapshot[] {
    return [...this.cpuHistory];
  }

  private async poll(): Promise<void> {
    try {
      const [mem, load] = await Promise.all([
        si.mem(),
        si.currentLoad(),
      ]);

      const now = Date.now();

      this.currentStats = {
        totalMem: mem.total,
        usedMem: mem.active,
        freeMem: mem.available,
        cpuLoad: Math.round(load.currentLoad * 10) / 10,
        timestamp: now,
      };

      // Append to circular history
      this.ramHistory.push({ timestamp: now, value: mem.active });
      if (this.ramHistory.length > HISTORY_MAX_SAMPLES) {
        this.ramHistory.shift();
      }

      this.cpuHistory.push({ timestamp: now, value: load.currentLoad });
      if (this.cpuHistory.length > HISTORY_MAX_SAMPLES) {
        this.cpuHistory.shift();
      }

      this.emit('update', this.currentStats);
    } catch (err) {
      console.error('SystemMonitor poll error:', err);
    }
  }
}
