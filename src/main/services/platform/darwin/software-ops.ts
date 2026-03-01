import fs from 'fs'
import path from 'path'
import os from 'os'
import type { SoftwareOps, RawInstalledSoftware } from '../types'

const APPLICATIONS_DIR = '/Applications'

// macOS built-in apps that should not be shown
const BUILTIN_APPS = new Set([
  'App Store', 'Automator', 'Books', 'Calculator', 'Calendar',
  'Chess', 'Contacts', 'Dashboard', 'Dictionary', 'DVD Player',
  'FaceTime', 'Finder', 'Font Book', 'GarageBand', 'Grapher',
  'Home', 'iBooks', 'Image Capture', 'iMovie', 'Keynote',
  'Launchpad', 'Mail', 'Maps', 'Messages', 'Migration Assistant',
  'Mission Control', 'Music', 'News', 'Notes', 'Numbers',
  'Pages', 'Photo Booth', 'Photos', 'Podcasts', 'Preview',
  'QuickTime Player', 'Reminders', 'Safari', 'Shortcuts', 'Siri',
  'Stickies', 'Stocks', 'System Preferences', 'System Settings',
  'Terminal', 'TextEdit', 'Time Machine', 'TV', 'Utilities',
  'VoiceOver Utility', 'Weather', 'Freeform', 'Clock',
])

function parsePlistValue(content: string, key: string): string {
  const regex = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`)
  const match = content.match(regex)
  return match?.[1] ?? ''
}

export function createDarwinSoftwareOps(): SoftwareOps {
  return {
    async getInstalledSoftware(): Promise<RawInstalledSoftware[]> {
      const items: RawInstalledSoftware[] = []

      try {
        const entries = await fs.promises.readdir(APPLICATIONS_DIR, { withFileTypes: true })

        for (const entry of entries) {
          if (!entry.name.endsWith('.app')) continue

          const appName = entry.name.replace(/\.app$/, '')
          if (BUILTIN_APPS.has(appName)) continue

          const bundlePath = path.join(APPLICATIONS_DIR, entry.name)
          const plistPath = path.join(bundlePath, 'Contents', 'Info.plist')

          let name = appName
          let version = ''

          try {
            const content = await fs.promises.readFile(plistPath, 'utf-8')
            const bundleName = parsePlistValue(content, 'CFBundleName')
            if (bundleName) name = bundleName
            version = parsePlistValue(content, 'CFBundleShortVersionString') || parsePlistValue(content, 'CFBundleVersion')
          } catch {
            // Binary plist or unreadable — use folder name
          }

          let size = 0
          try {
            const stat = await fs.promises.lstat(bundlePath)
            size = stat.size
          } catch {
            // Skip size
          }

          items.push({
            registryKey: bundlePath,
            name,
            publisher: '',
            version,
            installDate: '',
            estimatedSize: size,
            quietUninstallString: '',
            uninstallString: '',
            isSystemComponent: false,
          })
        }
      } catch {
        // Directory read failure
      }

      return items
    },

    async uninstallSoftware(item): Promise<{ success: boolean; error?: string }> {
      const bundlePath = path.resolve(item.registryKey)
      if (!bundlePath.startsWith('/Applications/') || !bundlePath.endsWith('.app')) {
        return { success: false, error: 'Invalid application path' }
      }

      const trashDir = path.join(os.homedir(), '.Trash')
      const appName = path.basename(bundlePath)
      const trashDest = path.join(trashDir, appName)

      try {
        await fs.promises.rename(bundlePath, trashDest)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
