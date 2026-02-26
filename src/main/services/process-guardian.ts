import { EventEmitter } from 'events';
import { Notification } from 'electron';
import crypto from 'crypto';
import type { ProcessMonitor } from './process-monitor';
import type { ProtectionStore } from './protection-store';
import type { ProcessInfo, GuardianEvent } from '@shared/types';
import { GUARDIAN_EVENT_LOG_MAX } from '@shared/constants';

interface WatchedProcess {
  readonly pid: number;
  readonly name: string;
  readonly detectedAt: number;
}

export class ProcessGuardian extends EventEmitter {
  private watchedPids: Map<number, WatchedProcess> = new Map();
  private eventLog: GuardianEvent[] = [];
  private readonly onProcessUpdate: (processes: ProcessInfo[]) => void;

  constructor(
    private processMonitor: ProcessMonitor,
    private protectionStore: ProtectionStore,
  ) {
    super();
    this.onProcessUpdate = (processes) => this.handleUpdate(processes);
  }

  start(): void {
    this.stop();
    this.processMonitor.on('process-update', this.onProcessUpdate);
  }

  stop(): void {
    this.processMonitor.off('process-update', this.onProcessUpdate);
  }

  getWatchedProcesses(): WatchedProcess[] {
    return [...this.watchedPids.values()];
  }

  getEventLog(): GuardianEvent[] {
    return [...this.eventLog];
  }

  clearEventLog(): void {
    this.eventLog = [];
  }

  private handleUpdate(processes: ProcessInfo[]): void {
    const currentPids = new Map(processes.map((p) => [p.pid, p]));
    const now = Date.now();

    // 1. Add newly matched processes to watch list (immutable rebuild)
    let updatedWatched = new Map(this.watchedPids);
    for (const proc of processes) {
      if (updatedWatched.has(proc.pid)) continue;
      if (this.protectionStore.isWatched(proc.name)) {
        updatedWatched = new Map(updatedWatched);
        updatedWatched.set(proc.pid, {
          pid: proc.pid,
          name: proc.name,
          detectedAt: now,
        });
      }
    }

    // 2. Detect terminated processes
    const terminatedEvents: GuardianEvent[] = [];
    for (const [pid, watched] of updatedWatched) {
      if (currentPids.has(pid)) continue;

      updatedWatched = new Map(updatedWatched);
      updatedWatched.delete(pid);

      const ruleLabel = this.findRuleLabel(watched.name);
      terminatedEvents.push({
        id: crypto.randomUUID(),
        pid: watched.pid,
        name: watched.name,
        terminatedAt: now,
        ruleLabel,
      });
    }

    this.watchedPids = updatedWatched;

    for (const event of terminatedEvents) {
      this.eventLog = [event, ...this.eventLog].slice(0, GUARDIAN_EVENT_LOG_MAX);
      this.emit('process-terminated', event);
      this.showNotification(event);
    }
  }

  private findRuleLabel(name: string): string {
    const rules = this.protectionStore.getRules();
    const rule = rules.find((r) => r.enabled && r.pattern === name);
    return rule?.label ?? name;
  }

  private showNotification(event: GuardianEvent): void {
    if (!Notification.isSupported()) return;
    const n = new Notification({
      title: 'Process Terminated',
      body: `${event.ruleLabel} (PID ${event.pid}) has been terminated`,
    });
    n.show();
  }
}
