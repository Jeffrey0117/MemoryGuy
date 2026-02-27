import type { StorageBackend, UploadResult, DownloadResult } from './types'
import type { HttpUploadConfig } from '../config-types'

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

export class HttpUploadBackend implements StorageBackend {
  readonly name = 'http-upload'
  private readonly config: HttpUploadConfig

  constructor(config: HttpUploadConfig) {
    this.config = config
  }

  async upload(buffer: Buffer, filename: string, mime: string): Promise<UploadResult> {
    const formData = new FormData()
    const blob = new Blob([buffer as unknown as ArrayBuffer], { type: mime })
    formData.append(this.config.fieldName, blob, filename)

    const headers: Record<string, string> = { ...this.config.headers }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      body: formData,
      headers,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: HTTP ${response.status} ${response.statusText}`)
    }

    const json = await response.json() as Record<string, unknown>
    const url = getNestedValue(json, this.config.responseUrlPath)

    if (typeof url !== 'string') {
      throw new Error(`Upload response missing URL at path "${this.config.responseUrlPath}"`)
    }

    // Try to extract an ID from the response
    const id = (getNestedValue(json, 'data.id') as string) ?? url

    return { url, id: typeof id === 'string' ? id : url }
  }

  async download(url: string): Promise<DownloadResult> {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
  }

  async verify(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }
}
