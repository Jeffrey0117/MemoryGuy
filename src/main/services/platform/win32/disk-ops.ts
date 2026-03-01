import path from 'path'
import type { DiskOps, FixedPathTarget } from '../types'
import type { CleanupCategory } from '@shared/types'
import { runPs, psEscape } from './shell'

export function createWin32DiskOps(): DiskOps {
  return {
    async getFixedDrives(): Promise<string[]> {
      try {
        const script = `Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.FileSystemType -eq 'NTFS' -and $_.DriveLetter } | Select-Object -ExpandProperty DriveLetter`
        const output = await runPs(script)
        if (!output) return ['C']
        return output.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[A-Z]$/i.test(l))
      } catch {
        return ['C']
      }
    },

    async scanDriveForDevDirs(drive: string, depth: number, targetDirs: readonly string[]): Promise<{ fullPath: string; lastWriteTime: string }[]> {
      const targetList = targetDirs.map((t) => `'${psEscape(t)}'`).join(',')
      const excludePattern = 'Windows|Program Files|Program Files \\(x86\\)|\\.git\\\\|\\$Recycle\\.Bin|ProgramData'
      const script = [
        `$targets = @(${targetList})`,
        `Get-ChildItem -Path '${drive}:\\' -Directory -Recurse -Depth ${depth} -ErrorAction SilentlyContinue |`,
        `  Where-Object { $targets -contains $_.Name -and $_.FullName -notmatch '${excludePattern}' } |`,
        `  Select-Object FullName, LastWriteTime |`,
        `  ConvertTo-Csv -NoTypeInformation`,
      ].join(' ')

      let output: string
      try {
        output = await runPs(script)
      } catch {
        return []
      }

      if (!output) return []

      const results: { fullPath: string; lastWriteTime: string }[] = []
      const lines = output.split(/\r?\n/).filter((l) => l.startsWith('"'))
      const dataLines = lines.length > 0 && lines[0].includes('FullName') ? lines.slice(1) : lines

      for (const line of dataLines) {
        const match = line.match(/^"([^"]+)","?([^"]*)"?$/)
        if (!match) continue
        results.push({ fullPath: match[1], lastWriteTime: match[2] })
      }

      return results
    },

    async getDirectorySize(dirPath: string): Promise<number> {
      try {
        const escaped = psEscape(dirPath)
        const script = `(Get-ChildItem -LiteralPath '${escaped}' -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum`
        const output = await runPs(script)
        const size = parseInt(output, 10)
        return isNaN(size) ? 0 : size
      } catch {
        return 0
      }
    },

    async directoryExists(dirPath: string): Promise<boolean> {
      try {
        const escaped = psEscape(dirPath)
        const output = await runPs(`Test-Path -LiteralPath '${escaped}' -PathType Container`)
        return output.trim().toLowerCase() === 'true'
      } catch {
        return false
      }
    },

    async fileExists(filePath: string): Promise<boolean> {
      try {
        const escaped = psEscape(filePath)
        const output = await runPs(`Test-Path -LiteralPath '${escaped}' -PathType Leaf`)
        return output.trim().toLowerCase() === 'true'
      } catch {
        return false
      }
    },

    async removeDirectory(dirPath: string): Promise<void> {
      const escaped = psEscape(dirPath)
      await runPs(`Remove-Item -LiteralPath '${escaped}' -Recurse -Force -ErrorAction Stop`)
    },

    async scanRecycleBin(): Promise<number> {
      const script = `(New-Object -ComObject Shell.Application).Namespace(0xA).Items() | Measure-Object -Property Size -Sum | Select-Object -ExpandProperty Sum`
      const output = await runPs(script)
      const size = parseInt(output, 10)
      return isNaN(size) || size <= 0 ? 0 : size
    },

    async cleanRecycleBin(): Promise<void> {
      await runPs(`Clear-RecycleBin -Force -ErrorAction SilentlyContinue`)
    },

    getFixedPathTargets(): readonly FixedPathTarget[] {
      const appData = process.env.APPDATA ?? ''
      const localAppData = process.env.LOCALAPPDATA ?? ''
      const temp = process.env.TEMP ?? ''
      const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'

      return [
        { category: 'pkg-cache' as CleanupCategory, label: 'npm cache', path: path.join(appData, 'npm-cache') },
        { category: 'pkg-cache' as CleanupCategory, label: 'yarn cache', path: path.join(localAppData, 'yarn', 'Cache') },
        { category: 'pkg-cache' as CleanupCategory, label: 'pnpm cache', path: path.join(localAppData, 'pnpm-cache') },
        { category: 'pkg-cache' as CleanupCategory, label: 'pnpm store', path: path.join(localAppData, 'pnpm', 'store') },
        { category: 'temp' as CleanupCategory, label: 'User Temp', path: temp },
        { category: 'temp' as CleanupCategory, label: 'Windows Temp', path: path.join(systemRoot, 'Temp') },
        { category: 'browser-cache' as CleanupCategory, label: 'Chrome Cache', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache') },
        { category: 'browser-cache' as CleanupCategory, label: 'Chrome Code Cache', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache') },
        { category: 'browser-cache' as CleanupCategory, label: 'Edge Cache', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache') },
        { category: 'browser-cache' as CleanupCategory, label: 'Edge Code Cache', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache') },
      ]
    },
  }
}
