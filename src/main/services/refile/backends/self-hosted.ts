import type { StorageBackend, UploadResult, DownloadResult } from './types'
import type { SelfHostedConfig } from '../config-types'

export class SelfHostedBackend implements StorageBackend {
  readonly name = 'self-hosted'
  private readonly config: SelfHostedConfig

  constructor(config: SelfHostedConfig) {
    this.config = config
  }

  async upload(buffer: Buffer, filename: string, mime: string): Promise<UploadResult> {
    const endpoint = this.config.endpoint.replace(/\/$/, '')
    const formData = new FormData()
    formData.append('file', new Blob([buffer], { type: mime }), filename)

    const headers: Record<string, string> = {}
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(`${endpoint}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Upload failed: HTTP ${response.status} — ${text.slice(0, 200)}`)
    }

    const json = await response.json() as { url: string; id: string }

    if (!json.url || !json.id) {
      throw new Error('Server returned incomplete response (missing url or id)')
    }

    return { url: json.url, id: json.id }
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
