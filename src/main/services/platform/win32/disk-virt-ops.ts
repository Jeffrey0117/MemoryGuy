import path from 'path'
import type { DiskVirtOps } from '../types'
import { runPs, psEscape } from './shell'

const EXCLUDED_DIR_NAMES = new Set([
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  '$recycle.bin',
  'system volume information',
  'recovery',
  '$windows.~bt',
  '$windows.~ws',
])

export function createWin32DiskVirtOps(): DiskVirtOps {
  return {
    async getVolumes(): Promise<string[]> {
      const script = `Get-Volume | Where-Object { $_.FileSystemType -eq 'NTFS' -and $_.DriveLetter } | Select-Object -ExpandProperty DriveLetter`
      const output = await runPs(script)
      return output.trim().split(/\r?\n/).filter(Boolean).map((d) => d.trim())
    },

    async scanVolumeFiles(volume: string, signal: AbortSignal): Promise<{ fullName: string; length: number; lastWriteTime: string }[]> {
      if (signal.aborted) return []
      const drive = `${volume}:\\`
      const scanScript = `Get-ChildItem -Path '${psEscape(drive)}' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) -and -not $_.Attributes.HasFlag([System.IO.FileAttributes]::System) } | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json -Compress`

      try {
        const output = await runPs(scanScript)
        if (signal.aborted) return []
        const parsed = output.trim()
        if (!parsed) return []
        const raw = JSON.parse(parsed.startsWith('[') ? parsed : `[${parsed}]`) as {
          FullName: string
          Length: number
          LastWriteTime: string
        }[]
        return raw.map((r) => ({ fullName: r.FullName, length: r.Length, lastWriteTime: r.LastWriteTime }))
      } catch {
        return []
      }
    },

    async scanVolumeRefiles(volume: string, extFilter: string, signal: AbortSignal): Promise<{ fullName: string; length: number; lastWriteTime: string }[]> {
      if (signal.aborted) return []
      const drive = `${volume}:\\`
      const script = `Get-ChildItem -Path '${psEscape(drive)}' -Recurse -File -Include ${extFilter} -ErrorAction SilentlyContinue | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json -Compress`

      try {
        const output = await runPs(script)
        if (signal.aborted) return []
        const parsed = output.trim()
        if (!parsed) return []
        const raw = JSON.parse(parsed.startsWith('[') ? parsed : `[${parsed}]`) as {
          FullName: string
          Length: number
          LastWriteTime: string
        }[]
        return raw.map((r) => ({ fullName: r.FullName, length: r.Length, lastWriteTime: r.LastWriteTime }))
      } catch {
        return []
      }
    },

    isSystemPath(filePath: string): boolean {
      const resolved = path.resolve(filePath).toLowerCase()
      const parts = resolved.split(path.sep)
      const firstDir = parts[1] ?? ''
      if (EXCLUDED_DIR_NAMES.has(firstDir)) return true
      for (const prefix of ['windows', 'program files', 'program files (x86)', 'programdata']) {
        if (resolved.includes(`${path.sep}${prefix}${path.sep}`) || resolved.endsWith(`${path.sep}${prefix}`)) {
          return true
        }
      }
      return false
    },

    isValidVolume(volume: string): boolean {
      return /^[A-Za-z]$/.test(volume.trim())
    },
  }
}
