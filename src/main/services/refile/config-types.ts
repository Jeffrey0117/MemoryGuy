export interface HttpUploadConfig {
  readonly type: 'http-upload'
  readonly endpoint: string
  readonly fieldName: string
  readonly responseUrlPath: string
  readonly headers?: Readonly<Record<string, string>>
}

export interface S3Config {
  readonly type: 's3'
  readonly bucket: string
  readonly region: string
  readonly endpoint?: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly prefix?: string
  readonly publicUrlBase?: string
}

export interface DukConfig {
  readonly type: 'duk'
  readonly variant: 'duky' | 'dukic' | 'dukbox'
  readonly endpoint: string
  readonly apiKey: string
}

export type BackendConfig = HttpUploadConfig | S3Config | DukConfig

export interface RefileConfig {
  readonly defaultBackend: string
  readonly backends: Readonly<Record<string, BackendConfig>>
}
