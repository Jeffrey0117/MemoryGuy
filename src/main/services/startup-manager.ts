import { createHash } from 'crypto';
import { getPlatform } from './platform';
import type { StartupItem } from '@shared/types';
import type { RawStartupItem } from './platform/types';

function makeId(location: string, name: string): string {
  return createHash('sha256').update(`${location}:${name}`).digest('hex').slice(0, 12);
}

export class StartupManager {
  private lastItems: ReadonlyArray<StartupItem & { readonly fileName: string }> = [];

  async getStartupItems(): Promise<StartupItem[]> {
    try {
      const rawItems: RawStartupItem[] = await getPlatform().startupOps.getStartupItems();

      const items = rawItems.map((p) => ({
        id: makeId(p.location, p.name),
        name: p.name,
        command: p.command,
        location: p.location,
        enabled: p.enabled,
        isAdmin: p.location === 'hklm',
        fileName: p.fileName,
      }));

      this.lastItems = items;
      return items.map(({ fileName: _fn, ...rest }) => rest);
    } catch (error) {
      throw new Error(`Failed to read startup items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async toggleStartupItem(id: string): Promise<{ success: boolean; error?: string }> {
    const item = this.lastItems.find((i) => i.id === id);
    if (!item) {
      return { success: false, error: 'Item not found — try refreshing' };
    }

    return getPlatform().startupOps.toggleStartupItem({
      name: item.name,
      command: item.command,
      location: item.location,
      enabled: item.enabled,
      fileName: item.fileName,
      isAdmin: item.isAdmin,
    });
  }

  async removeStartupItem(id: string): Promise<{ success: boolean; error?: string }> {
    const item = this.lastItems.find((i) => i.id === id);
    if (!item) {
      return { success: false, error: 'Item not found — try refreshing' };
    }

    return getPlatform().startupOps.removeStartupItem({
      name: item.name,
      command: item.command,
      location: item.location,
      enabled: item.enabled,
      fileName: item.fileName,
      isAdmin: item.isAdmin,
    });
  }
}
