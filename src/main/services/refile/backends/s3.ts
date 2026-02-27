import type { StorageBackend, UploadResult, DownloadResult } from './types'
import type { S3Config } from '../config-types'

export class S3Backend implements StorageBackend {
  readonly name = 's3'
  private readonly config: S3Config
  private client: unknown = null

  constructor(config: S3Config) {
    this.config = config
  }

  private async getClient(): Promise<{
    send: (cmd: unknown) => Promise<unknown>
  }> {
    if (this.client) return this.client as { send: (cmd: unknown) => Promise<unknown> }

    // Dynamic import to avoid requiring @aws-sdk/client-s3 if not using S3
    // @ts-expect-error — optional dependency, only needed if S3 backend is used
    const { S3Client } = await import('@aws-sdk/client-s3')
    this.client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: !!this.config.endpoint,
    })
    return this.client as { send: (cmd: unknown) => Promise<unknown> }
  }

  async upload(buffer: Buffer, filename: string, mime: string): Promise<UploadResult> {
    // @ts-expect-error — optional dependency, only needed if S3 backend is used
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await this.getClient()

    const { hashBuffer } = await import('../hasher')
    const hash = hashBuffer(buffer).replace('sha256:', '')
    const prefix = this.config.prefix ?? 'refile/'
    const key = `${prefix}${hash}/${filename}`

    await client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
    }))

    const url = this.config.publicUrlBase
      ? `${this.config.publicUrlBase.replace(/\/$/, '')}/${key}`
      : `${this.config.endpoint ?? `https://s3.${this.config.region}.amazonaws.com`}/${this.config.bucket}/${key}`

    return { url, id: key }
  }

  async download(url: string): Promise<DownloadResult> {
    // Try direct HTTP download first (works for public URLs and CDN)
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
