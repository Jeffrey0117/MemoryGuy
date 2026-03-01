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

// --- Protection rules ---

export interface ProtectionRule {
  readonly id: string
  readonly pattern: string         // e.g. "node.exe"
  readonly label: string           // e.g. "Node.js"
  readonly mode: 'watch' | 'protect'  // watch=monitor, protect=monitor+exclude from optimizer
  readonly builtIn: boolean        // true=system default, cannot delete
  readonly enabled: boolean
  readonly createdAt: number
}

// --- Guardian events ---

export interface GuardianEvent {
  readonly id: string
  readonly pid: number
  readonly name: string
  readonly terminatedAt: number
  readonly ruleLabel: string
}

// --- Startup programs ---

export interface StartupItem {
  readonly id: string
  readonly name: string
  readonly command: string
  readonly location: 'hkcu' | 'hklm' | 'folder' | 'launchagent'
  readonly enabled: boolean
  readonly isAdmin: boolean
}

export interface PlatformCapabilities {
  readonly canTrimWorkingSets: boolean
  readonly canManageTrash: boolean
  readonly trashLabel: string
}

// --- Environment variables ---

export interface EnvVar {
  readonly name: string
  readonly value: string
  readonly scope: 'system' | 'user'
}

// --- Dev servers ---

export interface DevServer {
  readonly port: number
  readonly pid: number
  readonly ppid?: number
  readonly processName: string
  readonly url: string
  readonly httpStatus?: number
  readonly pageTitle?: string
  readonly ram?: number
  readonly cpu?: number
  readonly commandLine?: string
  readonly autoRestartEnabled?: boolean
  readonly isProtected?: boolean
}

export interface AutoRestartEvent {
  readonly port: number
  readonly processName?: string
  readonly success: boolean
  readonly timestamp: number
}

// --- Disk cleanup ---

export type CleanupCategory = 'dev-deps' | 'dev-build' | 'pkg-cache' | 'temp' | 'browser-cache' | 'recycle-bin'

export interface DiskCleanupItem {
  readonly id: string
  readonly path: string
  readonly category: CleanupCategory
  readonly label: string
  readonly sizeBytes: number
  readonly lastModified: number
}

export interface DiskScanProgress {
  readonly scanned: number
  readonly found: number
  readonly totalBytes: number
}

export interface DiskScanResult {
  readonly items: readonly DiskCleanupItem[]
  readonly totalBytes: number
  readonly scanDurationMs: number
}

export interface DiskCleanResult {
  readonly cleaned: readonly { readonly path: string; readonly sizeBytes: number }[]
  readonly failed: readonly { readonly path: string; readonly error: string }[]
  readonly totalFreed: number
}

// --- Disk virtualization ---

export interface VirtScanItem {
  readonly path: string
  readonly size: number
  readonly mime: string
  readonly mtime: number
  readonly isVirtualized: boolean
  readonly isDirectory?: boolean
}

export interface VirtScanResult {
  readonly items: readonly VirtScanItem[]
  readonly totalSize: number
  readonly scanDurationMs: number
}

export interface VirtProgress {
  readonly phase: 'scanning' | 'hashing' | 'uploading' | 'downloading'
  readonly current: number
  readonly total: number
  readonly currentFile: string
  readonly bytesProcessed: number
}

export interface VirtPushResult {
  readonly pushed: number
  readonly failed: number
  readonly freedBytes: number
  readonly errors: readonly string[]
}

export interface VirtPullResult {
  readonly pulled: number
  readonly failed: number
  readonly restoredBytes: number
  readonly errors: readonly string[]
}

export interface VirtStatusResult {
  readonly virtualizedFiles: number
  readonly savedBytes: number
  readonly hasConfig: boolean
}

export interface VirtConfig {
  readonly defaultBackend: string
  readonly backends: Readonly<Record<string, {
    readonly type: 'self-hosted'
    readonly endpoint: string
    readonly apiKey?: string
  }>>
}

// --- Watch folders (auto-virtualize) ---

export interface WatchFolder {
  readonly id: string
  readonly path: string
  readonly thresholdBytes: number
  readonly enabled: boolean
  readonly lastScanAt: number
}

export interface WatchEvent {
  readonly timestamp: number
  readonly filePath: string
  readonly size: number
  readonly action: 'pushed' | 'failed'
  readonly error?: string
}

// --- Virtual file registry ---

export interface VirtRegistryEntry {
  readonly pointerPath: string
  readonly originalPath: string
  readonly name: string
  readonly hash: string
  readonly size: number
  readonly mime: string
  readonly backend: string
  readonly createdAt: number
}

export interface VirtRegistryStats {
  readonly totalFiles: number
  readonly totalSavedBytes: number
  readonly byType: readonly {
    readonly category: string
    readonly count: number
    readonly bytes: number
  }[]
}

export interface VirtRegistryScanResult {
  readonly added: number
  readonly migrated: number
}

// --- Installed software ---

export interface InstalledSoftware {
  readonly id: string
  readonly name: string
  readonly publisher: string
  readonly version: string
  readonly installDate: string
  readonly estimatedSize: number
  readonly isSystemComponent: boolean
}

// --- Hardware health check ---

export interface HardwareSpecs {
  readonly cpu: {
    readonly brand: string
    readonly cores: number
    readonly physicalCores: number
    readonly speed: number
    readonly speedMax: number
  }
  readonly ram: {
    readonly totalBytes: number
    readonly slots: number
    readonly usedSlots: number
    readonly type: string
    readonly speed: number
  }
  readonly disk: {
    readonly devices: readonly {
      readonly name: string
      readonly type: string
      readonly size: number
    }[]
    readonly hasSystemSsd: boolean
  }
  readonly gpu: {
    readonly model: string
    readonly vram: number
    readonly vendor: string
  }
}

export interface HardwareScore {
  readonly overall: number
  readonly cpu: number
  readonly ram: number
  readonly disk: number
  readonly gpu: number
}

export interface HardwareAdvice {
  readonly key: string
  readonly severity: 'info' | 'suggest' | 'bottleneck'
  readonly params: Readonly<Record<string, string>>
}

export interface HardwareHealth {
  readonly specs: HardwareSpecs
  readonly score: HardwareScore
  readonly advice: readonly HardwareAdvice[]
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
  // Window controls
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>

  // Protection rules
  getProtectionRules: () => Promise<ProtectionRule[]>
  addProtectionRule: (rule: Omit<ProtectionRule, 'id' | 'builtIn' | 'createdAt'>) => Promise<ProtectionRule>
  removeProtectionRule: (id: string) => Promise<void>
  updateProtectionRule: (id: string, updates: Partial<Pick<ProtectionRule, 'enabled' | 'mode' | 'label'>>) => Promise<ProtectionRule | null>

  // Guardian
  getWatchedProcesses: () => Promise<{ pid: number; name: string; detectedAt: number }[]>
  getGuardianLog: () => Promise<GuardianEvent[]>
  clearGuardianLog: () => Promise<void>

  // Dev servers
  getDevServers: () => Promise<DevServer[]>
  scanDevServers: () => Promise<DevServer[]>
  openExternalUrl: (url: string) => Promise<void>
  setAutoRestart: (port: number, enabled: boolean) => Promise<void>
  getAutoRestartPorts: () => Promise<number[]>
  enableGroupAutoRestart: (ports: number[]) => Promise<void>

  // Hook generator
  generateHook: () => Promise<{ success: boolean; path?: string; error?: string }>

  // Startup programs
  getStartupItems: () => Promise<StartupItem[]>
  toggleStartupItem: (id: string) => Promise<{ success: boolean; error?: string }>
  removeStartupItem: (id: string) => Promise<{ success: boolean; error?: string }>

  // Environment variables
  getEnvVars: () => Promise<EnvVar[]>
  copyToClipboard: (text: string) => Promise<void>

  // Disk cleanup
  scanDiskCleanup: () => Promise<DiskScanResult>
  executeDiskCleanup: (paths: string[], sizes: Record<string, number>) => Promise<DiskCleanResult>
  cancelDiskScan: () => Promise<void>
  onDiskScanProgress: (callback: (progress: DiskScanProgress) => void) => () => void

  // Disk virtualization
  virtGetUserFolders: () => Promise<{ name: string; path: string }[]>
  virtScan: () => Promise<VirtScanResult>
  virtScanFolder: (folderPath: string) => Promise<VirtScanResult>
  virtSelectFolder: () => Promise<string | null>
  virtPush: (filePaths: string[]) => Promise<VirtPushResult>
  virtPull: (refilePaths: string[]) => Promise<VirtPullResult>
  virtStatus: () => Promise<VirtStatusResult>
  virtCancel: () => Promise<void>
  virtConfigLoad: () => Promise<VirtConfig | null>
  virtConfigSave: (config: VirtConfig) => Promise<void>
  onVirtProgress: (callback: (progress: VirtProgress) => void) => () => void

  // Watch folders
  virtGetWatchFolders: () => Promise<WatchFolder[]>
  virtAddWatchFolder: (path: string, thresholdBytes: number) => Promise<WatchFolder>
  virtRemoveWatchFolder: (id: string) => Promise<void>
  virtToggleWatchFolder: (id: string) => Promise<void>
  virtGetWatchEvents: () => Promise<WatchEvent[]>
  virtClearWatchEvents: () => Promise<void>
  virtSelectWatchFolder: () => Promise<string | null>
  // Registry
  virtRegistryList: () => Promise<VirtRegistryEntry[]>
  virtRegistryStats: () => Promise<VirtRegistryStats>
  virtRegistryScanFolders: (folderPaths: string[]) => Promise<VirtRegistryScanResult>
  virtRegistryRebuild: () => Promise<VirtRegistryScanResult>

  onVirtWatchEvent: (callback: (event: WatchEvent) => void) => () => void

  // Installed software
  getInstalledSoftware: () => Promise<InstalledSoftware[]>
  uninstallSoftware: (id: string) => Promise<{ success: boolean; error?: string }>

  // Hardware health
  getHardwareHealth: () => Promise<HardwareHealth>

  // Platform
  getPlatformCapabilities: () => Promise<PlatformCapabilities>

  onSystemUpdate: (callback: (stats: SystemStats) => void) => () => void
  onLeakDetected: (callback: (leak: LeakInfo) => void) => () => void
  onProcessUpdate: (callback: (processes: ProcessInfo[]) => void) => () => void
  onProcessTerminated: (callback: (event: GuardianEvent) => void) => () => void
  onDevServersUpdate: (callback: (servers: DevServer[]) => void) => () => void
  onServerRestarted: (callback: (event: AutoRestartEvent) => void) => () => void
}
