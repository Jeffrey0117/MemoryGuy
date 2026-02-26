import { EventEmitter } from 'events';
import type { ProcessMonitor } from './process-monitor';
import type { ProcessInfo, LeakInfo } from '@shared/types';
import {
  LEAK_CHECK_MS,
  LEAK_THRESHOLD_MB_MIN,
  LEAK_CRITICAL_MB_MIN,
  LEAK_MIN_DURATION_MIN,
  LEAK_CRITICAL_MIN_DURATION_MIN,
} from '@shared/constants';

interface Sample {
  timestamp: number;
  ram: number;
}

const MB = 1024 * 1024;

function linearRegression(
  points: { x: number; y: number }[],
): { slope: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, r2: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, r2 };
}

export class MemoryTracker extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private processHistory: Map<number, Sample[]> = new Map();
  private processNames: Map<number, string> = new Map();
  private currentLeaks: Map<number, LeakInfo> = new Map();
  private readonly maxSamples = 900; // 30 min at 2s intervals

  constructor(private processMonitor: ProcessMonitor) {
    super();
  }

  start(): void {
    if (this.interval) return;

    this.processMonitor.on('process-update', this.handleProcessUpdate);
    this.interval = setInterval(() => this.checkForLeaks(), LEAK_CHECK_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.processMonitor.off('process-update', this.handleProcessUpdate);
  }

  getLeaks(): LeakInfo[] {
    return [...this.currentLeaks.values()];
  }

  private handleProcessUpdate = (processes: ProcessInfo[]): void => {
    const now = Date.now();
    const alivePids = new Set<number>();

    for (const proc of processes) {
      alivePids.add(proc.pid);
      this.processNames.set(proc.pid, proc.name);

      const samples = this.processHistory.get(proc.pid) ?? [];
      const updated = [...samples, { timestamp: now, ram: proc.ram }];
      this.processHistory.set(
        proc.pid,
        updated.length > this.maxSamples
          ? updated.slice(-this.maxSamples)
          : updated,
      );
    }

    // Prune dead processes
    for (const pid of this.processHistory.keys()) {
      if (!alivePids.has(pid)) {
        this.processHistory.delete(pid);
        this.processNames.delete(pid);
        this.currentLeaks.delete(pid);
      }
    }
  };

  private checkForLeaks(): void {
    const newLeaks = new Map<number, LeakInfo>();

    for (const [pid, samples] of this.processHistory) {
      if (samples.length < 10) continue;

      const name = this.processNames.get(pid) ?? 'unknown';
      const firstTs = samples[0].timestamp;
      const lastTs = samples[samples.length - 1].timestamp;
      const durationMin = (lastTs - firstTs) / 60_000;

      if (durationMin < LEAK_CRITICAL_MIN_DURATION_MIN) continue;

      // Normalize timestamps to minutes for regression
      const points = samples.map((s) => ({
        x: (s.timestamp - firstTs) / 60_000,
        y: s.ram,
      }));

      const { slope, r2 } = linearRegression(points);

      // slope is bytes per minute
      const growthMBMin = slope / MB;

      // Check critical first
      if (
        growthMBMin >= LEAK_CRITICAL_MB_MIN &&
        durationMin >= LEAK_CRITICAL_MIN_DURATION_MIN &&
        r2 > 0.6
      ) {
        const leak: LeakInfo = {
          pid,
          name,
          growthRate: slope,
          currentMem: samples[samples.length - 1].ram,
          startMem: samples[0].ram,
          duration: durationMin,
          severity: 'critical',
        };
        newLeaks.set(pid, leak);
        this.emit('leak-detected', leak);
      } else if (
        growthMBMin >= LEAK_THRESHOLD_MB_MIN &&
        durationMin >= LEAK_MIN_DURATION_MIN &&
        r2 > 0.7
      ) {
        const leak: LeakInfo = {
          pid,
          name,
          growthRate: slope,
          currentMem: samples[samples.length - 1].ram,
          startMem: samples[0].ram,
          duration: durationMin,
          severity: 'suspect',
        };
        newLeaks.set(pid, leak);
        this.emit('leak-detected', leak);
      }
    }

    this.currentLeaks = newLeaks;
  }
}
