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
});
