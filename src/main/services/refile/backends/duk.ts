import type { StorageBackend, UploadResult, DownloadResult } from './types'
import type { DukConfig } from '../config-types'

export class DukBackend implements StorageBackend {
  readonly name: string
  private readonly config: DukConfig

  constructor(config: DukConfig) {
    this.config = config
    this.name = config.variant
  }

  private validateUrl(url: string): void {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Refusing to access URL with protocol: ${parsed.protocol}`)
    }
  }

  async upload(buffer: Buffer, filename: string, mime: string): Promise<UploadResult> {
    const endpoint = this.config.endpoint.replace(/\/$/, '')
    const formData = new FormData()
    formData.append('file', new Blob([buffer], { type: mime }), filename)

    const response = await fetch(`${endpoint}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`duk upload failed: HTTP ${response.status} — ${text.slice(0, 200)}`)
    }

    const json = await response.json() as { url: string; id: string }

    if (!json.url || !json.id) {
      throw new Error('duk returned incomplete response (missing url or id)')
    }

    return { url: json.url, id: json.id }
  }

  async download(url: string): Promise<DownloadResult> {
    this.validateUrl(url)

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
      this.validateUrl(url)
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }
}
