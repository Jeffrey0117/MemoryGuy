import type { StorageBackend } from './types'
import type { BackendConfig } from '../config-types'
import { SelfHostedBackend } from './self-hosted'

export function createBackend(config: BackendConfig): StorageBackend {
  if (config.type === 'self-hosted') {
    return new SelfHostedBackend(config)
  }
  throw new Error(`Unknown backend type: ${(config as { type: string }).type}`)
}
