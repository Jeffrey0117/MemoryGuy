import path from 'path'
import fs from 'fs'
import os from 'os'
import type { DiskOps, FixedPathTarget } from '../types'
import type { CleanupCategory } from '@shared/types'
import { runCmd, shellEscape } from './shell'

export function createDarwinDiskOps(): DiskOps {
  return {
    async getFixedDrives(): Promise<string[]> {
      // macOS has / as root + /Volumes/*
      const drives = ['/']
      try {
        if (fs.existsSync('/Volumes')) {
          const volumes = await fs.promises.readdir('/Volumes')
          for (const vol of volumes) {
            drives.push(`/Volumes/${vol}`)
          }
        }
      } catch {
        // ignore
      }
      return drives
    },

    async scanDriveForDevDirs(drive: string, depth: number, targetDirs: readonly string[]): Promise<{ fullPath: string; lastWriteTime: string }[]> {
      const safeDepth = Math.max(1, Math.min(Math.floor(depth), 20))
      const nameArgs = targetDirs.map((t) => `-name '${shellEscape(t)}'`).join(' -o ')

      // Exclude system directories on macOS
      const excludeDirs = ['/System', '/Library', '/private', '/usr', '/bin', '/sbin', '/dev', '/var']
      const pruneArgs = excludeDirs.map((d) => `-path '${d}' -prune`).join(' -o ')

      const cmd = `find '${shellEscape(drive)}' -maxdepth ${safeDepth + 1} \\( ${pruneArgs} \\) -o -type d \\( ${nameArgs} \\) -print 2>/dev/null`

      try {
        const output = await runCmd(cmd)
        if (!output) return []

        const results: { fullPath: string; lastWriteTime: string }[] = []
        for (const line of output.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          // Get mtime for each found directory
          try {
            const stat = await fs.promises.stat(trimmed)
            results.push({ fullPath: trimmed, lastWriteTime: stat.mtime.toISOString() })
          } catch {
            results.push({ fullPath: trimmed, lastWriteTime: '' })
          }
        }
        return results
      } catch {
        return []
      }
    },

    async getDirectorySize(dirPath: string): Promise<number> {
      try {
        const output = await runCmd(`du -sk '${shellEscape(dirPath)}' 2>/dev/null`)
        const size = parseInt(output.split('\t')[0], 10)
        return isNaN(size) ? 0 : size * 1024 // du -sk returns kilobytes
      } catch {
        return 0
      }
    },

    async directoryExists(dirPath: string): Promise<boolean> {
      try {
        const stat = await fs.promises.stat(dirPath)
        return stat.isDirectory()
      } catch {
        return false
      }
    },

    async fileExists(filePath: string): Promise<boolean> {
      try {
        const stat = await fs.promises.stat(filePath)
        return stat.isFile()
      } catch {
        return false
      }
    },

    async removeDirectory(dirPath: string): Promise<void> {
      await fs.promises.rm(dirPath, { recursive: true, force: true })
    },

    async scanRecycleBin(): Promise<number> {
      const trashPath = path.join(os.homedir(), '.Trash')
      try {
        const output = await runCmd(`du -sk '${shellEscape(trashPath)}' 2>/dev/null`)
        const size = parseInt(output.split('\t')[0], 10)
        return isNaN(size) || size <= 0 ? 0 : size * 1024
      } catch {
        return 0
      }
    },

    async cleanRecycleBin(): Promise<void> {
      const home = os.homedir()
      if (!home || home === '/') {
        throw new Error('Cannot determine home directory for Trash cleanup')
      }
      const trashPath = path.join(home, '.Trash')
      // Read directory entries and remove individually to avoid shell glob expansion risks
      const entries = await fs.promises.readdir(trashPath)
      for (const entry of entries) {
        await fs.promises.rm(path.join(trashPath, entry), { recursive: true, force: true })
      }
    },

    getFixedPathTargets(): readonly FixedPathTarget[] {
      const home = os.homedir()
      const tmpDir = process.env.TMPDIR ?? '/tmp'

      return [
        { category: 'pkg-cache' as CleanupCategory, label: 'npm cache', path: path.join(home, '.npm') },
        { category: 'pkg-cache' as CleanupCategory, label: 'yarn cache', path: path.join(home, 'Library', 'Caches', 'Yarn') },
        { category: 'pkg-cache' as CleanupCategory, label: 'pnpm store', path: path.join(home, 'Library', 'pnpm', 'store') },
        { category: 'temp' as CleanupCategory, label: 'User Temp', path: tmpDir },
        { category: 'temp' as CleanupCategory, label: 'System Temp', path: '/tmp' },
        { category: 'browser-cache' as CleanupCategory, label: 'Chrome Cache', path: path.join(home, 'Library', 'Caches', 'Google', 'Chrome', 'Default', 'Cache') },
        { category: 'browser-cache' as CleanupCategory, label: 'Chrome Code Cache', path: path.join(home, 'Library', 'Caches', 'Google', 'Chrome', 'Default', 'Code Cache') },
        { category: 'browser-cache' as CleanupCategory, label: 'Safari Cache', path: path.join(home, 'Library', 'Caches', 'com.apple.Safari') },
        { category: 'browser-cache' as CleanupCategory, label: 'Xcode DerivedData', path: path.join(home, 'Library', 'Developer', 'Xcode', 'DerivedData') },
      ]
    },
  }
}
