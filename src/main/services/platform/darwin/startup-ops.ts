import fs from 'fs'
import path from 'path'
import os from 'os'
import type { StartupOps, RawStartupItem } from '../types'
import { runCmd, shellEscape } from './shell'

const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')

function parsePlistLabel(content: string): string {
  const match = content.match(/<key>Label<\/key>\s*<string>([^<]+)<\/string>/)
  return match?.[1] ?? ''
}

function parsePlistProgram(content: string): string {
  // Try ProgramArguments first
  const argsMatch = content.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/)
  if (argsMatch) {
    const strings = argsMatch[1].match(/<string>([^<]+)<\/string>/g)
    if (strings) {
      return strings.map((s) => s.replace(/<\/?string>/g, '')).join(' ')
    }
  }
  // Fallback to Program
  const progMatch = content.match(/<key>Program<\/key>\s*<string>([^<]+)<\/string>/)
  return progMatch?.[1] ?? ''
}

function parsePlistDisabled(content: string): boolean {
  const match = content.match(/<key>Disabled<\/key>\s*<(true|false)\/>/)
  return match?.[1] === 'true'
}

export function createDarwinStartupOps(): StartupOps {
  return {
    async getStartupItems(): Promise<RawStartupItem[]> {
      const items: RawStartupItem[] = []

      try {
        if (!fs.existsSync(LAUNCH_AGENTS_DIR)) return items

        const files = await fs.promises.readdir(LAUNCH_AGENTS_DIR)
        for (const fileName of files) {
          if (!fileName.endsWith('.plist')) continue
          const fullPath = path.join(LAUNCH_AGENTS_DIR, fileName)
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8')
            const label = parsePlistLabel(content) || path.basename(fileName, '.plist')
            const command = parsePlistProgram(content)
            const disabled = parsePlistDisabled(content)

            items.push({
              name: label,
              command,
              location: 'launchagent',
              enabled: !disabled,
              fileName,
            })
          } catch {
            // Skip unreadable plist files
          }
        }
      } catch {
        // Directory read failure
      }

      return items
    },

    async toggleStartupItem(item): Promise<{ success: boolean; error?: string }> {
      if (item.isAdmin) {
        return { success: false, error: 'Cannot modify system launch agents' }
      }

      try {
        const plistPath = path.join(LAUNCH_AGENTS_DIR, item.fileName)
        if (item.enabled) {
          // Disable: launchctl bootout + set Disabled key
          await runCmd(`launchctl bootout gui/$(id -u) '${shellEscape(plistPath)}' 2>/dev/null; /usr/libexec/PlistBuddy -c "Set :Disabled true" '${shellEscape(plistPath)}' 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :Disabled bool true" '${shellEscape(plistPath)}'`)
        } else {
          // Enable: remove Disabled key + launchctl bootstrap
          await runCmd(`/usr/libexec/PlistBuddy -c "Delete :Disabled" '${shellEscape(plistPath)}' 2>/dev/null; launchctl bootstrap gui/$(id -u) '${shellEscape(plistPath)}' 2>/dev/null`)
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    },

    async removeStartupItem(item): Promise<{ success: boolean; error?: string }> {
      if (item.isAdmin) {
        return { success: false, error: 'Cannot remove system launch agents' }
      }

      try {
        const plistPath = path.join(LAUNCH_AGENTS_DIR, item.fileName)
        // Unload first, then delete
        await runCmd(`launchctl bootout gui/$(id -u) '${shellEscape(plistPath)}' 2>/dev/null; rm -f '${shellEscape(plistPath)}'`)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
