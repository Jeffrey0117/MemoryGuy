import type { StorageBackend } from './types'
import type { BackendConfig } from '../config-types'
import { HttpUploadBackend } from './http-upload'
import { S3Backend } from './s3'
import { DukBackend } from './duk'

export function createBackend(config: BackendConfig): StorageBackend {
  switch (config.type) {
    case 'http-upload':
      return new HttpUploadBackend(config)
    case 's3':
      return new S3Backend(config)
    case 'duk':
      return new DukBackend(config)
    default:
      throw new Error(`Unknown backend type: ${(config as { type: string }).type}`)
  }
}
