import type { StartupItem, EnvVar, CleanupCategory, DiskCleanupItem, PlatformCapabilities } from '@shared/types'

// --- Platform adapter ---

export interface PlatformAdapter {
  readonly platform: 'win32' | 'darwin'
  readonly capabilities: PlatformCapabilities
  readonly processOps: ProcessOps
  readonly portOps: PortOps
  readonly startupOps: StartupOps
  readonly envOps: EnvOps
  readonly diskOps: DiskOps
  readonly diskVirtOps: DiskVirtOps
  readonly softwareOps: SoftwareOps
  readonly pathUtils: PathUtils
}

// --- Process operations ---

export interface ProcessOps {
  killByPid(pid: number): Promise<{ success: boolean; error?: string }>
  trimWorkingSets(pids: readonly number[]): Promise<TrimOpsResult>
}

export interface TrimOpsResult {
  readonly trimmed: number[]
  readonly failed: { pid: number; error: string }[]
}

// --- Port operations ---

export interface NetstatEntry {
  readonly port: number
  readonly pid: number
}

export interface ProcessDetail {
  readonly ppid: number
  readonly commandLine: string
}

export interface PortOps {
  getListeningPorts(): Promise<NetstatEntry[]>
  getProcessDetails(pids: number[]): Promise<Map<number, ProcessDetail>>
}

// --- Startup operations ---

export interface RawStartupItem {
  readonly name: string
  readonly command: string
  readonly location: StartupItem['location']
  readonly enabled: boolean
  readonly fileName: string
}

export interface StartupOps {
  getStartupItems(): Promise<RawStartupItem[]>
  toggleStartupItem(item: RawStartupItem & { readonly isAdmin: boolean }): Promise<{ success: boolean; error?: string }>
  removeStartupItem(item: RawStartupItem & { readonly isAdmin: boolean }): Promise<{ success: boolean; error?: string }>
}

// --- Environment variable operations ---

export interface EnvOps {
  getEnvVars(): Promise<EnvVar[]>
}

// --- Disk cleanup operations ---

export interface FixedPathTarget {
  readonly category: CleanupCategory
  readonly label: string
  readonly path: string
}

export interface DiskOps {
  getFixedDrives(): Promise<string[]>
  scanDriveForDevDirs(drive: string, depth: number, targetDirs: readonly string[]): Promise<{ fullPath: string; lastWriteTime: string }[]>
  getDirectorySize(dirPath: string): Promise<number>
  directoryExists(dirPath: string): Promise<boolean>
  fileExists(filePath: string): Promise<boolean>
  removeDirectory(dirPath: string): Promise<void>
  scanRecycleBin(): Promise<number>
  cleanRecycleBin(): Promise<void>
  getFixedPathTargets(): readonly FixedPathTarget[]
}

// --- Disk virtualization operations ---

export interface DiskVirtOps {
  getVolumes(): Promise<string[]>
  scanVolumeFiles(volume: string, signal: AbortSignal): Promise<{ fullName: string; length: number; lastWriteTime: string }[]>
  scanVolumeRefiles(volume: string, extFilter: string, signal: AbortSignal): Promise<{ fullName: string; length: number; lastWriteTime: string }[]>
  isSystemPath(filePath: string): boolean
  isValidVolume(volume: string): boolean
}

// --- Software operations ---

export interface RawInstalledSoftware {
  readonly registryKey: string
  readonly name: string
  readonly publisher: string
  readonly version: string
  readonly installDate: string
  readonly estimatedSize: number
  readonly quietUninstallString: string
  readonly uninstallString: string
  readonly isSystemComponent: boolean
}

export interface SoftwareOps {
  getInstalledSoftware(): Promise<RawInstalledSoftware[]>
  uninstallSoftware(item: RawInstalledSoftware): Promise<{ success: boolean; error?: string }>
}

// --- Path utilities ---

export interface PathUtils {
  inferCwd(commandLine: string): string
  isPathSafe(filePath: string, category: CleanupCategory): boolean
}
