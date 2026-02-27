export interface UploadResult {
  readonly url: string
  readonly id: string
}

export interface DownloadResult {
  readonly buffer: Buffer
  readonly contentType: string
}

export interface StorageBackend {
  readonly name: string
  upload(buffer: Buffer, filename: string, mime: string): Promise<UploadResult>
  download(url: string): Promise<DownloadResult>
  verify?(url: string): Promise<boolean>
}
