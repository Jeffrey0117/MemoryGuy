import { ipcMain, BrowserWindow, shell } from 'electron';
import { IPC } from '@shared/constants';
import type { SystemMonitor } from './services/system-monitor';
import type { ProcessMonitor } from './services/process-monitor';
import type { MemoryTracker } from './services/memory-tracker';
import type { Optimizer } from './services/optimizer';
import type { ProtectionStore } from './services/protection-store';
import type { ProcessGuardian } from './services/process-guardian';
import type { PortScanner } from './services/port-scanner';
import type { HookGenerator } from './services/hook-generator';
import { killByPid } from './services/process-killer';
import type { SystemStats, ProcessInfo, LeakInfo, GuardianEvent, DevServer } from '@shared/types';

interface Deps {
  systemMonitor: SystemMonitor;
  processMonitor: ProcessMonitor;
  memoryTracker: MemoryTracker;
  optimizer: Optimizer;
  protectionStore: ProtectionStore;
  processGuardian: ProcessGuardian;
  portScanner: PortScanner;
  hookGenerator: HookGenerator;
  getMainWindow: () => BrowserWindow | null;
}

function isValidPidArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((p) => Number.isInteger(p) && p > 0);
}

export function setupIpcHandlers({ systemMonitor, processMonitor, memoryTracker, optimizer, protectionStore, processGuardian, portScanner, hookGenerator, getMainWindow }: Deps): void {
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

  // --- Window controls ---
  ipcMain.handle(IPC.WIN_MINIMIZE, () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.handle(IPC.WIN_MAXIMIZE, () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle(IPC.WIN_CLOSE, () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });

  ipcMain.handle(IPC.WIN_IS_MAXIMIZED, () => {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win.isMaximized() : false;
  });

  // --- Protection rules ---
  ipcMain.handle(IPC.GET_PROTECTION_RULES, () => {
    return protectionStore.getRules();
  });

  ipcMain.handle(IPC.ADD_PROTECTION_RULE, (_event, rule: unknown) => {
    if (typeof rule !== 'object' || rule === null) return null;
    const r = rule as Record<string, unknown>;
    if (typeof r.pattern !== 'string' || r.pattern.length === 0 || r.pattern.length > 256) return null;
    if (typeof r.label !== 'string' || r.label.length === 0 || r.label.length > 256) return null;
    if (r.mode !== 'watch' && r.mode !== 'protect') return null;
    // Only allow safe characters in pattern (process names)
    if (!/^[\w.\-\s]+$/.test(r.pattern)) return null;
    return protectionStore.addRule({
      pattern: r.pattern,
      label: r.label,
      mode: r.mode,
      enabled: r.enabled !== false,
    });
  });

  ipcMain.handle(IPC.REMOVE_PROTECTION_RULE, (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) return;
    protectionStore.removeRule(id);
  });

  ipcMain.handle(IPC.UPDATE_PROTECTION_RULE, (_event, id: unknown, updates: unknown) => {
    if (typeof id !== 'string' || id.length === 0) return null;
    if (typeof updates !== 'object' || updates === null) return null;
    const u = updates as Record<string, unknown>;
    const valid: Record<string, unknown> = {};
    if (typeof u.enabled === 'boolean') valid.enabled = u.enabled;
    if (u.mode === 'watch' || u.mode === 'protect') valid.mode = u.mode;
    if (typeof u.label === 'string' && u.label.length > 0) valid.label = u.label;
    return protectionStore.updateRule(id, valid);
  });

  // --- Guardian ---
  ipcMain.handle(IPC.GET_WATCHED_PROCESSES, () => {
    return processGuardian.getWatchedProcesses();
  });

  ipcMain.handle(IPC.GET_GUARDIAN_LOG, () => {
    return processGuardian.getEventLog();
  });

  ipcMain.handle(IPC.CLEAR_GUARDIAN_LOG, () => {
    processGuardian.clearEventLog();
  });

  // --- Dev servers ---
  ipcMain.handle(IPC.GET_DEV_SERVERS, () => {
    return portScanner.getDevServers();
  });

  ipcMain.handle(IPC.SCAN_DEV_SERVERS, () => {
    return portScanner.scan();
  });

  ipcMain.handle(IPC.OPEN_EXTERNAL_URL, (_event, url: unknown) => {
    if (typeof url !== 'string') return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return;
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return;
      shell.openExternal(url);
    } catch {
      // Invalid URL
    }
  });

  // --- Hook generator ---
  ipcMain.handle(IPC.GENERATE_HOOK, () => {
    return hookGenerator.generate();
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

  processGuardian.on('process-terminated', (event: GuardianEvent) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_PROCESS_TERMINATED, event);
    }
  });

  portScanner.on('dev-servers-update', (servers: DevServer[]) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_DEV_SERVERS_UPDATE, servers);
    }
  });
}
