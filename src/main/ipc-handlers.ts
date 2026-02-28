import { ipcMain, BrowserWindow, shell, clipboard, dialog } from 'electron';
import { IPC, DEV_PORT_RANGE_MIN, DEV_PORT_RANGE_MAX } from '@shared/constants';
import type { SystemMonitor } from './services/system-monitor';
import type { ProcessMonitor } from './services/process-monitor';
import type { MemoryTracker } from './services/memory-tracker';
import type { Optimizer } from './services/optimizer';
import type { ProtectionStore } from './services/protection-store';
import type { ProcessGuardian } from './services/process-guardian';
import type { PortScanner } from './services/port-scanner';
import type { DevServerManager } from './services/dev-server-manager';
import type { HookGenerator } from './services/hook-generator';
import type { StartupManager } from './services/startup-manager';
import type { EnvReader } from './services/env-reader';
import type { DiskCleaner } from './services/disk-cleaner';
import { type DiskVirtualizer, validateConfig } from './services/disk-virtualizer';
import type { RefileWatcher } from './services/refile-watcher';
import { killByPid } from './services/process-killer';
import { isRefilePath } from './services/refile/refile-format';
import type { SystemStats, ProcessInfo, LeakInfo, GuardianEvent, DevServer, DiskScanProgress, VirtProgress, WatchEvent } from '@shared/types';

interface Deps {
  systemMonitor: SystemMonitor;
  processMonitor: ProcessMonitor;
  memoryTracker: MemoryTracker;
  optimizer: Optimizer;
  protectionStore: ProtectionStore;
  processGuardian: ProcessGuardian;
  portScanner: PortScanner;
  devServerManager: DevServerManager;
  hookGenerator: HookGenerator;
  startupManager: StartupManager;
  envReader: EnvReader;
  diskCleaner: DiskCleaner;
  diskVirtualizer: DiskVirtualizer;
  refileWatcher: RefileWatcher;
  getMainWindow: () => BrowserWindow | null;
}

function isValidPidArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((p) => Number.isInteger(p) && p > 0);
}

export function setupIpcHandlers({ systemMonitor, processMonitor, memoryTracker, optimizer, protectionStore, processGuardian, portScanner, devServerManager, hookGenerator, startupManager, envReader, diskCleaner, diskVirtualizer, refileWatcher, getMainWindow }: Deps): void {
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
    return portScanner.getDevServers().map((s) => ({
      ...s,
      autoRestartEnabled: devServerManager.getAutoRestart(s.port),
      isProtected: protectionStore.isProtected(s.processName),
    }));
  });

  ipcMain.handle(IPC.SCAN_DEV_SERVERS, async () => {
    const servers = await portScanner.scan();
    return servers.map((s) => ({
      ...s,
      autoRestartEnabled: devServerManager.getAutoRestart(s.port),
      isProtected: protectionStore.isProtected(s.processName),
    }));
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

  ipcMain.handle(IPC.SET_AUTO_RESTART, (_event, port: unknown, enabled: unknown) => {
    if (!Number.isInteger(port)) return;
    const p = port as number;
    if (p < DEV_PORT_RANGE_MIN || p > DEV_PORT_RANGE_MAX) return;
    if (typeof enabled !== 'boolean') return;
    devServerManager.setAutoRestart(p, enabled);
  });

  ipcMain.handle(IPC.GET_AUTO_RESTART_PORTS, () => {
    return devServerManager.getAutoRestartPorts();
  });

  ipcMain.handle(IPC.ENABLE_GROUP_AUTO_RESTART, (_event, ports: unknown) => {
    if (!Array.isArray(ports) || ports.length > 50) return;
    if (!ports.every((p) => Number.isInteger(p) && p >= DEV_PORT_RANGE_MIN && p <= DEV_PORT_RANGE_MAX)) return;
    devServerManager.enableBatch(ports);
  });

  // --- Hook generator ---
  ipcMain.handle(IPC.GENERATE_HOOK, () => {
    return hookGenerator.generate();
  });

  // --- Startup programs ---
  ipcMain.handle(IPC.GET_STARTUP_ITEMS, () => {
    return startupManager.getStartupItems();
  });

  ipcMain.handle(IPC.TOGGLE_STARTUP_ITEM, (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) {
      return { success: false, error: 'Invalid item ID' };
    }
    return startupManager.toggleStartupItem(id);
  });

  ipcMain.handle(IPC.REMOVE_STARTUP_ITEM, (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) {
      return { success: false, error: 'Invalid item ID' };
    }
    return startupManager.removeStartupItem(id);
  });

  // --- Environment variables ---
  ipcMain.handle(IPC.GET_ENV_VARS, () => {
    return envReader.getEnvVars();
  });

  ipcMain.handle(IPC.COPY_TO_CLIPBOARD, (_event, text: unknown) => {
    if (typeof text !== 'string') return;
    if (text.length > 65_536) return;
    clipboard.writeText(text);
  });

  // --- Disk cleanup ---
  ipcMain.handle(IPC.SCAN_DISK_CLEANUP, async () => {
    try {
      return await diskCleaner.scan();
    } catch {
      return { items: [], totalBytes: 0, scanDurationMs: 0 };
    }
  });

  ipcMain.handle(IPC.EXECUTE_DISK_CLEANUP, (_event, paths: unknown, sizes: unknown) => {
    if (!Array.isArray(paths)) return { cleaned: [], failed: [], totalFreed: 0 };
    if (paths.length > 200) return { cleaned: [], failed: [], totalFreed: 0 };
    const validPaths = paths.filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length < 1024);
    // Build size map from renderer-provided data
    const sizeMap = new Map<string, number>();
    if (typeof sizes === 'object' && sizes !== null) {
      for (const [k, v] of Object.entries(sizes as Record<string, unknown>)) {
        if (typeof v === 'number') sizeMap.set(k, v);
      }
    }
    return diskCleaner.clean(validPaths, sizeMap);
  });

  ipcMain.handle(IPC.CANCEL_DISK_SCAN, () => {
    diskCleaner.cancelScan();
  });

  diskCleaner.on('scan-progress', (progress: DiskScanProgress) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_DISK_SCAN_PROGRESS, progress);
    }
  });

  // --- Disk virtualization ---
  ipcMain.handle(IPC.VIRT_SCAN, async () => {
    return diskVirtualizer.scan({});
  });

  ipcMain.handle(IPC.VIRT_SCAN_FOLDER, async (_event, folderPath: unknown) => {
    if (typeof folderPath !== 'string' || folderPath.length === 0 || folderPath.length > 2048) {
      return { items: [], totalSize: 0, scanDurationMs: 0 };
    }
    return diskVirtualizer.scanFolder(folderPath);
  });

  ipcMain.handle(IPC.VIRT_SELECT_FOLDER, async () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC.VIRT_PUSH, async (_event, filePaths: unknown) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0 || filePaths.length > 500) {
      return { pushed: 0, failed: 0, freedBytes: 0, errors: ['Invalid file paths'] };
    }
    const valid = filePaths.filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length < 2048);
    if (valid.length === 0) return { pushed: 0, failed: 0, freedBytes: 0, errors: ['No valid paths'] };
    return diskVirtualizer.push(valid);
  });

  ipcMain.handle(IPC.VIRT_PULL, async (_event, refilePaths: unknown) => {
    if (!Array.isArray(refilePaths) || refilePaths.length === 0 || refilePaths.length > 500) {
      return { pulled: 0, failed: 0, restoredBytes: 0, errors: ['Invalid file paths'] };
    }
    const valid = refilePaths.filter((p): p is string => typeof p === 'string' && isRefilePath(p) && p.length < 2048);
    if (valid.length === 0) return { pulled: 0, failed: 0, restoredBytes: 0, errors: ['No valid paths'] };
    return diskVirtualizer.pull(valid);
  });

  ipcMain.handle(IPC.VIRT_STATUS, () => {
    return diskVirtualizer.getStatus();
  });

  ipcMain.handle(IPC.VIRT_CANCEL, () => {
    diskVirtualizer.cancel();
  });

  ipcMain.handle(IPC.VIRT_CONFIG_LOAD, () => {
    return diskVirtualizer.loadConfig();
  });

  ipcMain.handle(IPC.VIRT_CONFIG_SAVE, (_event, config: unknown) => {
    const validated = validateConfig(config);
    if (!validated) return;
    diskVirtualizer.saveConfig(validated);
  });

  diskVirtualizer.on('virt-progress', (progress: VirtProgress) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_VIRT_PROGRESS, progress);
    }
  });

  // --- Watch folders ---
  ipcMain.handle(IPC.VIRT_GET_WATCH_FOLDERS, () => {
    return refileWatcher.getFolders();
  });

  ipcMain.handle(IPC.VIRT_ADD_WATCH_FOLDER, (_event, folderPath: unknown, thresholdBytes: unknown) => {
    if (typeof folderPath !== 'string' || folderPath.length === 0 || folderPath.length > 2048) return null;
    if (typeof thresholdBytes !== 'number' || thresholdBytes < 1_048_576) return null;
    return refileWatcher.addFolder(folderPath, thresholdBytes);
  });

  ipcMain.handle(IPC.VIRT_REMOVE_WATCH_FOLDER, (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) return;
    refileWatcher.removeFolder(id);
  });

  ipcMain.handle(IPC.VIRT_TOGGLE_WATCH_FOLDER, (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) return;
    refileWatcher.toggleFolder(id);
  });

  ipcMain.handle(IPC.VIRT_GET_WATCH_EVENTS, () => {
    return refileWatcher.getEvents();
  });

  ipcMain.handle(IPC.VIRT_CLEAR_WATCH_EVENTS, () => {
    refileWatcher.clearEvents();
  });

  ipcMain.handle(IPC.VIRT_SELECT_WATCH_FOLDER, async () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  refileWatcher.on('watch-event', (event: WatchEvent) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_VIRT_WATCH_EVENT, event);
    }
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
      const enriched = servers.map((s) => ({
        ...s,
        autoRestartEnabled: devServerManager.getAutoRestart(s.port),
        isProtected: protectionStore.isProtected(s.processName),
      }));
      win.webContents.send(IPC.ON_DEV_SERVERS_UPDATE, enriched);
    }
  });

  devServerManager.on('server-restarted', (event: { port: number; processName: string; success: boolean; timestamp: number }) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_SERVER_RESTARTED, event);
    }
  });

  devServerManager.on('restart-failed', (event: { port: number; processName: string; success: boolean; timestamp: number }) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_SERVER_RESTARTED, event);
    }
  });
}
