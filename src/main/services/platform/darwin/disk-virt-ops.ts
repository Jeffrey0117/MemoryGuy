import path from 'path'
import fs from 'fs'
import type { DiskVirtOps } from '../types'
import { runCmd, shellEscape } from './shell'

const EXCLUDED_PATHS = new Set([
  '/system',
  '/library',
  '/private',
  '/usr',
  '/bin',
  '/sbin',
  '/dev',
  '/var',
  '/cores',
  '/opt',
])

export function createDarwinDiskVirtOps(): DiskVirtOps {
  return {
    async getVolumes(): Promise<string[]> {
      const volumes = ['/']
      try {
        if (fs.existsSync('/Volumes')) {
          const entries = await fs.promises.readdir('/Volumes')
          for (const entry of entries) {
            volumes.push(`/Volumes/${entry}`)
          }
        }
      } catch {
        // ignore
      }
      return volumes
    },

    async scanVolumeFiles(volume: string, signal: AbortSignal): Promise<{ fullName: string; length: number; lastWriteTime: string }[]> {
      if (signal.aborted) return []

      // Use find to list non-hidden, non-system files
      const excludeArgs = [...EXCLUDED_PATHS].map((d) => `-path '${shellEscape(d)}' -prune`).join(' -o ')
      const cmd = `find '${shellEscape(volume)}' \\( ${excludeArgs} \\) -o -type f -not -name '.*' -print 2>/dev/null | head -10000`

      try {
        const output = await runCmd(cmd)
        if (signal.aborted) return []
        if (!output) return []

        const results: { fullName: string; length: number; lastWriteTime: string }[] = []
        for (const line of output.split('\n')) {
          if (signal.aborted) break
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const stat = await fs.promises.stat(trimmed)
            if (stat.isFile()) {
              results.push({
                fullName: trimmed,
                length: stat.size,
                lastWriteTime: stat.mtime.toISOString(),
              })
            }
          } catch {
            // Skip inaccessible files
          }
        }
        return results
      } catch {
        return []
      }
    },

    async scanVolumeRefiles(volume: string, extFilter: string, signal: AbortSignal): Promise<{ fullName: string; length: number; lastWriteTime: string }[]> {
      if (signal.aborted) return []

      // Convert PowerShell-style ext filter "'*.refile','*.repic'" to find -name args
      const exts = extFilter.replace(/'/g, '').split(',').map((e) => e.trim()).filter((e) => /^[*.\w-]+$/.test(e))
      if (exts.length === 0) return []
      const nameArgs = exts.map((e) => `-name '${shellEscape(e)}'`).join(' -o ')
      const cmd = `find '${shellEscape(volume)}' -type f \\( ${nameArgs} \\) 2>/dev/null | head -10000`

      try {
        const output = await runCmd(cmd)
        if (signal.aborted) return []
        if (!output) return []

        const results: { fullName: string; length: number; lastWriteTime: string }[] = []
        for (const line of output.split('\n')) {
          if (signal.aborted) break
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const stat = await fs.promises.stat(trimmed)
            if (stat.isFile()) {
              results.push({
                fullName: trimmed,
                length: stat.size,
                lastWriteTime: stat.mtime.toISOString(),
              })
            }
          } catch {
            // Skip inaccessible files
          }
        }
        return results
      } catch {
        return []
      }
    },

    isSystemPath(filePath: string): boolean {
      const resolved = path.resolve(filePath).toLowerCase()
      for (const prefix of EXCLUDED_PATHS) {
        if (resolved === prefix || resolved.startsWith(prefix + '/')) {
          return true
        }
      }
      return false
    },

    isValidVolume(volume: string): boolean {
      return volume === '/' || volume.startsWith('/Volumes/')
    },
  }
}
