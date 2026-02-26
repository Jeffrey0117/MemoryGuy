import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import type { SystemMonitor } from './services/system-monitor';
import type { ProcessMonitor } from './services/process-monitor';
import type { MemoryTracker } from './services/memory-tracker';
import type { Optimizer } from './services/optimizer';
import { killByPid } from './services/process-killer';
import type { SystemStats, ProcessInfo, LeakInfo } from '@shared/types';

interface Deps {
  systemMonitor: SystemMonitor;
  processMonitor: ProcessMonitor;
  memoryTracker: MemoryTracker;
  optimizer: Optimizer;
  getMainWindow: () => BrowserWindow | null;
}

function isValidPidArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((p) => Number.isInteger(p) && p > 0);
}

export function setupIpcHandlers({ systemMonitor, processMonitor, memoryTracker, optimizer, getMainWindow }: Deps): void {
  // --- System stats ---
  ipcMain.handle(IPC.GET_SYSTEM_STATS, () => {
    return systemMonitor.getStats();
  });

  ipcMain.handle(IPC.GET_MEMORY_HISTORY, () => {
    return {
      ram: systemMonitor.getRamHistory(),
      cpu: systemMonitor.getCpuHistory(),
    };
  });

  // --- Processes ---
  ipcMain.handle(IPC.GET_PROCESS_LIST, () => {
    return processMonitor.getProcesses();
  });

  ipcMain.handle(IPC.KILL_PROCESS, async (_event, pid: unknown) => {
    if (!Number.isInteger(pid) || (pid as number) <= 0) {
      return { success: false, error: 'Invalid PID' };
    }
    const validPid = pid as number;
    const proc = processMonitor.getProcesses().find((p) => p.pid === validPid);
    return killByPid(validPid, proc?.name);
  });

  ipcMain.handle(IPC.KILL_PROCESS_GROUP, async (_event, name: unknown) => {
    if (typeof name !== 'string' || name.length === 0) {
      return { success: false, killed: 0, error: 'Invalid process name' };
    }
    const targets = processMonitor.getProcesses().filter((p) => p.name === name);
    let killed = 0;
    let lastError: string | undefined;

    for (const target of targets) {
      const result = await killByPid(target.pid, target.name);
      if (result.success) {
        killed++;
      } else {
        lastError = result.error;
      }
    }

    return {
      success: killed > 0,
      killed,
      error: killed === 0 ? lastError : undefined,
    };
  });

  // --- Leak detection ---
  ipcMain.handle(IPC.GET_LEAK_SUSPECTS, () => {
    return memoryTracker.getLeaks();
  });

  // --- Optimizer ---
  ipcMain.handle(IPC.ANALYZE_OPTIMIZE, () => {
    return optimizer.analyze();
  });

  ipcMain.handle(IPC.EXECUTE_OPTIMIZE, async (_event, pids: unknown) => {
    if (!isValidPidArray(pids)) {
      return { ramBefore: 0, ramFreed: 0, killed: [], failed: [{ pid: 0, name: 'invalid', error: 'Invalid PIDs array' }] };
    }
    return optimizer.execute(pids);
  });

  ipcMain.handle(IPC.TRIM_WORKING_SETS, async (_event, pids: unknown) => {
    if (!isValidPidArray(pids)) {
      return { trimmed: [], failed: [{ pid: 0, name: 'invalid', error: 'Invalid PIDs array' }], ramBefore: 0, ramAfter: 0 };
    }
    return optimizer.trim(pids);
  });

  ipcMain.handle(IPC.TRIM_ALL_WORKING_SETS, async () => {
    return optimizer.trim();
  });

  ipcMain.handle(IPC.GET_AUTO_PROTECT, () => {
    return optimizer.getAutoProtect();
  });

  ipcMain.handle(IPC.SET_AUTO_PROTECT, (_event, settings: unknown) => {
    if (typeof settings !== 'object' || settings === null) return;
    const s = settings as Record<string, unknown>;
    optimizer.setAutoProtect({
      enabled: Boolean(s.enabled),
      threshold: typeof s.threshold === 'number' ? s.threshold : 85,
      autoTrim: Boolean(s.autoTrim),
    });
  });

  // --- Push events ---
  systemMonitor.on('update', (stats: SystemStats) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_SYSTEM_UPDATE, stats);
    }
  });

  processMonitor.on('process-update', (processes: ProcessInfo[]) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_PROCESS_UPDATE, processes);
    }
  });

  memoryTracker.on('leak-detected', (leak: LeakInfo) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_LEAK_DETECTED, leak);
    }
  });
}
