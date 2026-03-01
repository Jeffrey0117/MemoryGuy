export interface SelfHostedConfig {
  readonly type: 'self-hosted'
  readonly endpoint: string
  readonly apiKey: string
}

export type BackendConfig = SelfHostedConfig

export interface RefileConfig {
  readonly defaultBackend: string
  readonly backends: Readonly<Record<string, BackendConfig>>
}
