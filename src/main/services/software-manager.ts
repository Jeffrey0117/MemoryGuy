import { createHash } from 'crypto'
import { getPlatform } from './platform'
import type { InstalledSoftware } from '@shared/types'
import type { RawInstalledSoftware } from './platform/types'

function makeId(registryKey: string): string {
  return createHash('sha256').update(registryKey).digest('hex').slice(0, 12)
}

export class SoftwareManager {
  private lastItems: ReadonlyArray<RawInstalledSoftware> = []

  async getInstalledSoftware(): Promise<InstalledSoftware[]> {
    try {
      const raw = await getPlatform().softwareOps.getInstalledSoftware()
      this.lastItems = raw.map((item) => ({ ...item }))
      return this.lastItems.map((item) => ({
        id: makeId(item.registryKey),
        name: item.name,
        publisher: item.publisher,
        version: item.version,
        installDate: item.installDate,
        estimatedSize: item.estimatedSize,
        isSystemComponent: item.isSystemComponent,
      }))
    } catch (error) {
      throw new Error(`Failed to read installed software: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async uninstallSoftware(id: string): Promise<{ success: boolean; error?: string }> {
    const item = this.lastItems.find((i) => makeId(i.registryKey) === id)
    if (!item) {
      return { success: false, error: 'Software not found — try refreshing' }
    }
    return getPlatform().softwareOps.uninstallSoftware(item)
  }
}
