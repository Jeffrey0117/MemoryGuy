import type { PlatformAdapter } from './types'
import { createWin32Platform } from './win32'
import { createDarwinPlatform } from './darwin'

let cached: PlatformAdapter | null = null

export function getPlatform(): PlatformAdapter {
  if (cached) return cached

  cached = process.platform === 'darwin'
    ? createDarwinPlatform()
    : createWin32Platform()

  return cached
}

// Re-export types for convenience
export type { PlatformAdapter, ProcessOps, PortOps, StartupOps, EnvOps, DiskOps, DiskVirtOps, PathUtils } from './types'
// Re-export platform-aware constants
export { SYSTEM_PROTECTED, MULTI_PROCESS_APPS, DEV_PROCESS_NAMES, TRIM_POWERSHELL_TIMEOUT_MS } from './constants'
