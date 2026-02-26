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

// --- Tier 1: Working set trim ---

export interface TrimTarget {
  readonly pid: number
  readonly name: string
  readonly currentWorkingSet: number   // bytes
  readonly estimatedReclaimable: number // bytes (heuristic)
}

export interface TrimResult {
  readonly trimmed: readonly { pid: number; name: string }[]
  readonly failed: readonly { pid: number; name: string; error: string }[]
  readonly ramBefore: number
  readonly ramAfter: number
}

// --- Tier 2: Smart recommendations ---

export type RecommendationReason = 'leak-suspect' | 'leak-critical' | 'idle-high-ram'
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high'

export interface Recommendation {
  readonly pid: number
  readonly name: string
  readonly ram: number
  readonly reason: RecommendationReason
  readonly riskLevel: RiskLevel
  readonly description: string
}

export interface MultiProcessSummary {
  readonly name: string
  readonly processCount: number
  readonly totalRam: number
  readonly totalCpu: number
  readonly pids: readonly number[]
}

// --- Optimize analysis (3-tier) ---

export interface OptimizeAnalysis {
  readonly tier1: {
    readonly trimTargets: readonly TrimTarget[]
    readonly estimatedSavings: number
  }
  readonly tier2: {
    readonly recommendations: readonly Recommendation[]
    readonly multiProcessApps: readonly MultiProcessSummary[]
  }
  readonly tier3: {
    readonly killableProcesses: readonly ProcessInfo[]
  }
  readonly currentRamUsed: number
  readonly currentRamPercent: number
}

// --- Kill result (unchanged) ---

export interface OptimizeResult {
  readonly ramBefore: number
  readonly ramFreed: number
  readonly killed: readonly { pid: number; name: string; ram: number }[]
  readonly failed: readonly { pid: number; name: string; error: string }[]
}

// --- Auto-protect settings ---

export interface AutoProtectSettings {
  enabled: boolean
  threshold: number         // 0-100 RAM% trigger
  autoTrim: boolean         // safely trim working sets when triggered
}

// --- API exposed to renderer ---

export interface MemoryGuyAPI {
  getSystemStats: () => Promise<SystemStats>
  getProcessList: () => Promise<ProcessInfo[]>
  getMemoryHistory: (pid?: number) => Promise<{ ram: MemorySnapshot[]; cpu: MemorySnapshot[] }>
  getLeakSuspects: () => Promise<LeakInfo[]>
  killProcess: (pid: number) => Promise<{ success: boolean; error?: string }>
  killProcessGroup: (name: string) => Promise<{ success: boolean; killed: number; error?: string }>
  analyzeOptimize: () => Promise<OptimizeAnalysis>
  executeOptimize: (pids: number[]) => Promise<OptimizeResult>
  trimWorkingSets: (pids: number[]) => Promise<TrimResult>
  trimAllWorkingSets: () => Promise<TrimResult>
  getAutoProtect: () => Promise<AutoProtectSettings>
  setAutoProtect: (settings: AutoProtectSettings) => Promise<void>
  onSystemUpdate: (callback: (stats: SystemStats) => void) => () => void
  onLeakDetected: (callback: (leak: LeakInfo) => void) => () => void
  onProcessUpdate: (callback: (processes: ProcessInfo[]) => void) => () => void
}
