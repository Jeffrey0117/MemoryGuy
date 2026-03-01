import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/constants';

contextBridge.exposeInMainWorld('memoryGuy', {
  getSystemStats: () => ipcRenderer.invoke(IPC.GET_SYSTEM_STATS),

  getMemoryHistory: (pid?: number) => ipcRenderer.invoke(IPC.GET_MEMORY_HISTORY, pid),

  getProcessList: () => ipcRenderer.invoke(IPC.GET_PROCESS_LIST),

  getLeakSuspects: () => ipcRenderer.invoke(IPC.GET_LEAK_SUSPECTS),

  killProcess: (pid: number) => ipcRenderer.invoke(IPC.KILL_PROCESS, pid),

  killProcessGroup: (name: string) => ipcRenderer.invoke(IPC.KILL_PROCESS_GROUP, name),

  analyzeOptimize: () => ipcRenderer.invoke(IPC.ANALYZE_OPTIMIZE),

  executeOptimize: (pids: number[]) => ipcRenderer.invoke(IPC.EXECUTE_OPTIMIZE, pids),

  trimWorkingSets: (pids: number[]) => ipcRenderer.invoke(IPC.TRIM_WORKING_SETS, pids),

  trimAllWorkingSets: () => ipcRenderer.invoke(IPC.TRIM_ALL_WORKING_SETS),

  getAutoProtect: () => ipcRenderer.invoke(IPC.GET_AUTO_PROTECT),

  setAutoProtect: (settings: unknown) => ipcRenderer.invoke(IPC.SET_AUTO_PROTECT, settings),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke(IPC.WIN_MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(IPC.WIN_MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC.WIN_CLOSE),
  windowIsMaximized: () => ipcRenderer.invoke(IPC.WIN_IS_MAXIMIZED),

  onSystemUpdate: (callback: (stats: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_SYSTEM_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_SYSTEM_UPDATE, handler); };
  },

  onProcessUpdate: (callback: (processes: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_PROCESS_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_PROCESS_UPDATE, handler); };
  },

  onLeakDetected: (callback: (leak: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_LEAK_DETECTED, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_LEAK_DETECTED, handler); };
  },

  // Protection rules
  getProtectionRules: () => ipcRenderer.invoke(IPC.GET_PROTECTION_RULES),
  addProtectionRule: (rule: unknown) => ipcRenderer.invoke(IPC.ADD_PROTECTION_RULE, rule),
  removeProtectionRule: (id: string) => ipcRenderer.invoke(IPC.REMOVE_PROTECTION_RULE, id),
  updateProtectionRule: (id: string, updates: unknown) => ipcRenderer.invoke(IPC.UPDATE_PROTECTION_RULE, id, updates),

  // Guardian
  getWatchedProcesses: () => ipcRenderer.invoke(IPC.GET_WATCHED_PROCESSES),
  getGuardianLog: () => ipcRenderer.invoke(IPC.GET_GUARDIAN_LOG),
  clearGuardianLog: () => ipcRenderer.invoke(IPC.CLEAR_GUARDIAN_LOG),

  // Dev servers
  getDevServers: () => ipcRenderer.invoke(IPC.GET_DEV_SERVERS),
  scanDevServers: () => ipcRenderer.invoke(IPC.SCAN_DEV_SERVERS),
  openExternalUrl: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL_URL, url),
  setAutoRestart: (port: number, enabled: boolean) => ipcRenderer.invoke(IPC.SET_AUTO_RESTART, port, enabled),
  getAutoRestartPorts: () => ipcRenderer.invoke(IPC.GET_AUTO_RESTART_PORTS),
  enableGroupAutoRestart: (ports: number[]) => ipcRenderer.invoke(IPC.ENABLE_GROUP_AUTO_RESTART, ports),

  // Hook generator
  generateHook: () => ipcRenderer.invoke(IPC.GENERATE_HOOK),

  // Startup programs
  getStartupItems: () => ipcRenderer.invoke(IPC.GET_STARTUP_ITEMS),
  toggleStartupItem: (id: string) => ipcRenderer.invoke(IPC.TOGGLE_STARTUP_ITEM, id),
  removeStartupItem: (id: string) => ipcRenderer.invoke(IPC.REMOVE_STARTUP_ITEM, id),

  // Environment variables
  getEnvVars: () => ipcRenderer.invoke(IPC.GET_ENV_VARS),
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC.COPY_TO_CLIPBOARD, text),

  // Disk cleanup
  scanDiskCleanup: () => ipcRenderer.invoke(IPC.SCAN_DISK_CLEANUP),
  executeDiskCleanup: (paths: string[], sizes: Record<string, number>) => ipcRenderer.invoke(IPC.EXECUTE_DISK_CLEANUP, paths, sizes),
  cancelDiskScan: () => ipcRenderer.invoke(IPC.CANCEL_DISK_SCAN),
  onDiskScanProgress: (callback: (progress: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_DISK_SCAN_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_DISK_SCAN_PROGRESS, handler); };
  },

  // Disk virtualization
  virtGetUserFolders: () => ipcRenderer.invoke(IPC.VIRT_GET_USER_FOLDERS),
  virtScan: () => ipcRenderer.invoke(IPC.VIRT_SCAN),
  virtScanFolder: (folderPath: string) => ipcRenderer.invoke(IPC.VIRT_SCAN_FOLDER, folderPath),
  virtSelectFolder: () => ipcRenderer.invoke(IPC.VIRT_SELECT_FOLDER),
  virtPush: (filePaths: string[]) => ipcRenderer.invoke(IPC.VIRT_PUSH, filePaths),
  virtPull: (refilePaths: string[]) => ipcRenderer.invoke(IPC.VIRT_PULL, refilePaths),
  virtStatus: () => ipcRenderer.invoke(IPC.VIRT_STATUS),
  virtCancel: () => ipcRenderer.invoke(IPC.VIRT_CANCEL),
  virtConfigLoad: () => ipcRenderer.invoke(IPC.VIRT_CONFIG_LOAD),
  virtConfigSave: (config: unknown) => ipcRenderer.invoke(IPC.VIRT_CONFIG_SAVE, config),
  onVirtProgress: (callback: (progress: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_VIRT_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_VIRT_PROGRESS, handler); };
  },

  // Watch folders
  virtGetWatchFolders: () => ipcRenderer.invoke(IPC.VIRT_GET_WATCH_FOLDERS),
  virtAddWatchFolder: (path: string, thresholdBytes: number) => ipcRenderer.invoke(IPC.VIRT_ADD_WATCH_FOLDER, path, thresholdBytes),
  virtRemoveWatchFolder: (id: string) => ipcRenderer.invoke(IPC.VIRT_REMOVE_WATCH_FOLDER, id),
  virtToggleWatchFolder: (id: string) => ipcRenderer.invoke(IPC.VIRT_TOGGLE_WATCH_FOLDER, id),
  virtGetWatchEvents: () => ipcRenderer.invoke(IPC.VIRT_GET_WATCH_EVENTS),
  virtClearWatchEvents: () => ipcRenderer.invoke(IPC.VIRT_CLEAR_WATCH_EVENTS),
  virtSelectWatchFolder: () => ipcRenderer.invoke(IPC.VIRT_SELECT_WATCH_FOLDER),
  // Registry
  virtRegistryList: () => ipcRenderer.invoke(IPC.VIRT_REGISTRY_LIST),
  virtRegistryStats: () => ipcRenderer.invoke(IPC.VIRT_REGISTRY_STATS),
  virtRegistryScanFolders: (folderPaths: string[]) => ipcRenderer.invoke(IPC.VIRT_REGISTRY_SCAN_FOLDERS, folderPaths),
  virtRegistryRebuild: () => ipcRenderer.invoke(IPC.VIRT_REGISTRY_REBUILD),

  // Installed software
  getInstalledSoftware: () => ipcRenderer.invoke(IPC.GET_INSTALLED_SOFTWARE),
  uninstallSoftware: (id: string) => ipcRenderer.invoke(IPC.UNINSTALL_SOFTWARE, id),

  // Hardware health
  getHardwareHealth: () => ipcRenderer.invoke(IPC.GET_HARDWARE_HEALTH),

  // Platform
  getPlatformCapabilities: () => ipcRenderer.invoke(IPC.GET_PLATFORM_CAPABILITIES),

  onVirtWatchEvent: (callback: (event: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_VIRT_WATCH_EVENT, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_VIRT_WATCH_EVENT, handler); };
  },

  onProcessTerminated: (callback: (event: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_PROCESS_TERMINATED, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_PROCESS_TERMINATED, handler); };
  },

  onDevServersUpdate: (callback: (servers: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_DEV_SERVERS_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_DEV_SERVERS_UPDATE, handler); };
  },

  onServerRestarted: (callback: (event: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_SERVER_RESTARTED, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_SERVER_RESTARTED, handler); };
  },
});
