export interface SystemStats {
  totalMem: number      // bytes
  usedMem: number       // bytes
  freeMem: number       // bytes
  cpuLoad: number       // 0-100
  timestamp: number     // Date.now()
}

export interface ProcessInfo {
  pid: number
  name: string
  ram: number           // bytes
  cpu: number           // 0-100
  trend: 'up' | 'down' | 'stable'
  isLeakSuspect: boolean
}

export interface MemorySnapshot {
  timestamp: number
  value: number         // bytes
}

export interface LeakInfo {
  pid: number
  name: string
  growthRate: number    // bytes per minute
  currentMem: number
  startMem: number
  duration: number      // minutes tracked
  severity: 'suspect' | 'critical'
}

export interface ProcessGroup {
  name: string
  pids: number[]
  totalRam: number
  totalCpu: number
  count: number
  processes: ProcessInfo[]
}

export interface OptimizeTarget {
  pid: number
  name: string
  ram: number
  reason: 'duplicate' | 'heavy' | 'leak-suspect'
}

export interface OptimizeAnalysis {
  targets: OptimizeTarget[]
  estimatedSavings: number
  currentRamUsed: number
  currentRamPercent: number
}

export interface OptimizeResult {
  ramBefore: number
  ramFreed: number
  killed: { pid: number; name: string; ram: number }[]
  failed: { pid: number; name: string; error: string }[]
}

export interface AutoProtectSettings {
  enabled: boolean
  threshold: number         // 0-100 RAM% trigger
  autoKill: boolean         // auto-kill duplicates when triggered
}

export interface MemoryGuyAPI {
  getSystemStats: () => Promise<SystemStats>
  getProcessList: () => Promise<ProcessInfo[]>
  getMemoryHistory: (pid?: number) => Promise<{ ram: MemorySnapshot[]; cpu: MemorySnapshot[] }>
  getLeakSuspects: () => Promise<LeakInfo[]>
  killProcess: (pid: number) => Promise<{ success: boolean; error?: string }>
  killProcessGroup: (name: string) => Promise<{ success: boolean; killed: number; error?: string }>
  analyzeOptimize: () => Promise<OptimizeAnalysis>
  executeOptimize: (pids: number[]) => Promise<OptimizeResult>
  getAutoProtect: () => Promise<AutoProtectSettings>
  setAutoProtect: (settings: AutoProtectSettings) => Promise<void>
  onSystemUpdate: (callback: (stats: SystemStats) => void) => () => void
  onLeakDetected: (callback: (leak: LeakInfo) => void) => () => void
  onProcessUpdate: (callback: (processes: ProcessInfo[]) => void) => () => void
}
