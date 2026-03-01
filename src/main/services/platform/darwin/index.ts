import type { PlatformAdapter } from '../types'
import { createDarwinProcessOps } from './process-ops'
import { createDarwinPortOps } from './port-ops'
import { createDarwinStartupOps } from './startup-ops'
import { createDarwinEnvOps } from './env-ops'
import { createDarwinDiskOps } from './disk-ops'
import { createDarwinDiskVirtOps } from './disk-virt-ops'
import { createDarwinSoftwareOps } from './software-ops'
import { createDarwinPathUtils } from './path-utils'

export function createDarwinPlatform(): PlatformAdapter {
  return {
    platform: 'darwin',
    capabilities: {
      canTrimWorkingSets: false,
      canManageTrash: true,
      trashLabel: 'Trash',
    },
    processOps: createDarwinProcessOps(),
    portOps: createDarwinPortOps(),
    startupOps: createDarwinStartupOps(),
    envOps: createDarwinEnvOps(),
    diskOps: createDarwinDiskOps(),
    diskVirtOps: createDarwinDiskVirtOps(),
    softwareOps: createDarwinSoftwareOps(),
    pathUtils: createDarwinPathUtils(),
  }
}
