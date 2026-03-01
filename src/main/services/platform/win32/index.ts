import type { PlatformAdapter } from '../types'
import { createWin32ProcessOps } from './process-ops'
import { createWin32PortOps } from './port-ops'
import { createWin32StartupOps } from './startup-ops'
import { createWin32EnvOps } from './env-ops'
import { createWin32DiskOps } from './disk-ops'
import { createWin32DiskVirtOps } from './disk-virt-ops'
import { createWin32SoftwareOps } from './software-ops'
import { createWin32PathUtils } from './path-utils'

export function createWin32Platform(): PlatformAdapter {
  return {
    platform: 'win32',
    capabilities: {
      canTrimWorkingSets: true,
      canManageTrash: true,
      trashLabel: 'Recycle Bin',
    },
    processOps: createWin32ProcessOps(),
    portOps: createWin32PortOps(),
    startupOps: createWin32StartupOps(),
    envOps: createWin32EnvOps(),
    diskOps: createWin32DiskOps(),
    diskVirtOps: createWin32DiskVirtOps(),
    softwareOps: createWin32SoftwareOps(),
    pathUtils: createWin32PathUtils(),
  }
}
