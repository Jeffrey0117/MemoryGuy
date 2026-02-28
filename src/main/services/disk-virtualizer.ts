import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { lookup } from 'mime-types'
import { z } from 'zod'
import type { RefileConfig } from './refile/config-types'
import { createBackend } from './refile/backends/registry'
import { createRefilePointer, readRefilePointer, writeRefilePointer, getRefilePath, isRefilePath, getOriginalPath, EXTENSIONS } from './refile/refile-format'
import { hashFile, verifyHash } from './refile/hasher'
import { getFileMeta, restoreFileMeta } from './refile/file-meta'
import { runPs, psEscape } from './powershell'
import type { VirtScanItem, VirtScanResult, VirtProgress, VirtPushResult, VirtPullResult, VirtStatusResult } from '@shared/types'

const CONFIG_FILE = 'refile-config.json'
const MIN_SIZE_BYTES = 1_048_576 // 1 MB hard minimum

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

function isSystemPath(filePath: string): boolean {
  const resolved = path.resolve(filePath).toLowerCase()
  const parts = resolved.split(path.sep)
  // parts[0] = drive like "c:", parts[1] = first directory
  const firstDir = parts[1] ?? ''
  if (EXCLUDED_DIR_NAMES.has(firstDir)) return true
  // Block known system prefixes on any drive
  for (const prefix of ['windows', 'program files', 'program files (x86)', 'programdata']) {
    if (resolved.includes(`${path.sep}${prefix}${path.sep}`) || resolved.endsWith(`${path.sep}${prefix}`)) {
      return true
    }
  }
  return false
}

// Validate drive letter is a single letter A-Z (defense-in-depth)
function isValidDriveLetter(letter: string): boolean {
  return /^[A-Za-z]$/.test(letter.trim())
}

const httpUploadSchema = z.object({
  type: z.literal('http-upload'),
  endpoint: z.string().url().max(2048),
  fieldName: z.string().min(1).max(128),
  responseUrlPath: z.string().min(1).max(256),
  headers: z.record(z.string(), z.string()).optional(),
})

const s3Schema = z.object({
  type: z.literal('s3'),
  bucket: z.string().min(1).max(256),
  region: z.string().min(1).max(64),
  endpoint: z.string().url().max(2048).optional(),
  accessKeyId: z.string().min(1).max(256),
  secretAccessKey: z.string().min(1).max(256),
  prefix: z.string().max(256).optional(),
  publicUrlBase: z.string().url().max(2048).optional(),
})

const dukSchema = z.object({
  type: z.literal('duk'),
  variant: z.enum(['duky', 'dukic', 'dukbox']),
  endpoint: z.string().url().max(2048),
  apiKey: z.string().min(1).max(256),
})

const selfHostedSchema = z.object({
  type: z.literal('self-hosted'),
  endpoint: z.string().url().max(2048),
  apiKey: z.string().max(256),
})

const backendSchema = z.discriminatedUnion('type', [httpUploadSchema, s3Schema, dukSchema, selfHostedSchema])

const configSchema = z.object({
  defaultBackend: z.string().min(1).max(128),
  backends: z.record(z.string(), backendSchema),
})

export function validateConfig(config: unknown): RefileConfig | null {
  const result = configSchema.safeParse(config)
  return result.success ? result.data as RefileConfig : null
}

export class DiskVirtualizer extends EventEmitter {
  private abortController: AbortController | null = null

  private getConfigPath(): string {
    return path.join(app.getPath('userData'), CONFIG_FILE)
  }

  loadConfig(): RefileConfig | null {
    try {
      const raw = fs.readFileSync(this.getConfigPath(), 'utf-8')
      return validateConfig(JSON.parse(raw))
    } catch {
      return null
    }
  }

  saveConfig(config: RefileConfig): void {
    const validated = validateConfig(config)
    if (!validated) throw new Error('Invalid config')
    fs.writeFileSync(this.getConfigPath(), JSON.stringify(validated, null, 2), 'utf-8')
  }

  async scanFolder(folderPath: string, thresholdBytes: number): Promise<VirtScanResult> {
    const threshold = Math.max(thresholdBytes, MIN_SIZE_BYTES)
    const resolved = path.resolve(folderPath)
    if (isSystemPath(resolved)) {
      return { items: [], totalSize: 0, scanDurationMs: 0 }
    }

    const startTime = Date.now()
    this.abortController = new AbortController()
    const { signal } = this.abortController

    const items: VirtScanItem[] = []
    let scannedBytes = 0

    try {
      // Scan for large files in folder
      const scanScript = `Get-ChildItem -Path '${psEscape(resolved)}' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -ge ${threshold} -and -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) -and -not $_.Attributes.HasFlag([System.IO.FileAttributes]::System) } | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json -Compress`

      const output = await runPs(scanScript)
      if (!signal.aborted && output.trim()) {
        const parsed = output.trim()
        const rawItems = JSON.parse(parsed.startsWith('[') ? parsed : `[${parsed}]`) as {
          FullName: string
          Length: number
          LastWriteTime: string
        }[]

        for (const raw of rawItems) {
          if (signal.aborted) break
          if (isSystemPath(raw.FullName)) continue

          const mimeType = lookup(raw.FullName) || 'application/octet-stream'
          items.push({
            path: raw.FullName,
            size: raw.Length,
            mime: mimeType,
            mtime: new Date(raw.LastWriteTime).getTime(),
            isVirtualized: false,
          })
          scannedBytes += raw.Length

          this.emit('virt-progress', {
            phase: 'scanning',
            current: items.length,
            total: 0,
            currentFile: raw.FullName,
            bytesProcessed: scannedBytes,
          } satisfies VirtProgress)
        }
      }

      // Also scan for existing pointer files in folder
      if (!signal.aborted) {
        const extFilter = EXTENSIONS.map((ext) => `'*${ext}'`).join(',')
        const refileScanScript = `Get-ChildItem -Path '${psEscape(resolved)}' -Recurse -File -Include ${extFilter} -ErrorAction SilentlyContinue | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json -Compress`

        try {
          const refileOutput = await runPs(refileScanScript)
          if (!signal.aborted && refileOutput.trim()) {
            const rawRefiles = JSON.parse(refileOutput.trim().startsWith('[') ? refileOutput.trim() : `[${refileOutput.trim()}]`) as {
              FullName: string
              Length: number
              LastWriteTime: string
            }[]

            for (const raw of rawRefiles) {
              if (signal.aborted) break
              if (isSystemPath(raw.FullName)) continue
              const pointer = readRefilePointer(raw.FullName)
              if (pointer) {
                items.push({
                  path: raw.FullName,
                  size: pointer.size,
                  mime: pointer.mime,
                  mtime: new Date(raw.LastWriteTime).getTime(),
                  isVirtualized: true,
                })
              }
            }
          }
        } catch {
          // Skip errors
        }
      }
    } catch {
      // Scan failed
    } finally {
      this.abortController = null
    }

    items.sort((a, b) => b.size - a.size)

    return {
      items,
      totalSize: items.reduce((sum, i) => sum + i.size, 0),
      scanDurationMs: Date.now() - startTime,
    }
  }

  async scan(options: { thresholdBytes: number }): Promise<VirtScanResult> {
    const threshold = Math.max(options.thresholdBytes, MIN_SIZE_BYTES)
    const startTime = Date.now()
    this.abortController = new AbortController()
    const { signal } = this.abortController

    const items: VirtScanItem[] = []
    let scannedBytes = 0

    try {
      // Get all NTFS volumes
      const volumeScript = `Get-Volume | Where-Object { $_.FileSystemType -eq 'NTFS' -and $_.DriveLetter } | Select-Object -ExpandProperty DriveLetter`
      const volumeOutput = await runPs(volumeScript)
      const driveLetters = volumeOutput.trim().split(/\r?\n/).filter(Boolean).map((d) => d.trim())

      for (const letter of driveLetters) {
        if (signal.aborted) break
        if (!isValidDriveLetter(letter)) continue

        const drive = `${letter}:\\`

        // Scan for large files
        const scanScript = `Get-ChildItem -Path '${psEscape(drive)}' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -ge ${threshold} -and -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) -and -not $_.Attributes.HasFlag([System.IO.FileAttributes]::System) } | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json -Compress`

        try {
          const output = await runPs(scanScript)
          if (signal.aborted) break

          const parsed = output.trim()
          if (!parsed) continue

          const rawItems = JSON.parse(parsed.startsWith('[') ? parsed : `[${parsed}]`) as {
            FullName: string
            Length: number
            LastWriteTime: string
          }[]

          for (const raw of rawItems) {
            if (signal.aborted) break
            if (isSystemPath(raw.FullName)) continue

            const mimeType = lookup(raw.FullName) || 'application/octet-stream'

            items.push({
              path: raw.FullName,
              size: raw.Length,
              mime: mimeType,
              mtime: new Date(raw.LastWriteTime).getTime(),
              isVirtualized: false,
            })

            scannedBytes += raw.Length

            this.emit('virt-progress', {
              phase: 'scanning',
              current: items.length,
              total: 0,
              currentFile: raw.FullName,
              bytesProcessed: scannedBytes,
            } satisfies VirtProgress)
          }
        } catch {
          // Drive access error or timeout, skip
        }

        // Also scan for virtualized pointer files on this drive
        const extFilter = EXTENSIONS.map((ext) => `'*${ext}'`).join(',')
        const refileScanScript = `Get-ChildItem -Path '${psEscape(drive)}' -Recurse -File -Include ${extFilter} -ErrorAction SilentlyContinue | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json -Compress`

        try {
          const refileOutput = await runPs(refileScanScript)
          if (signal.aborted) break

          const refileParsed = refileOutput.trim()
          if (!refileParsed) continue

          const rawRefiles = JSON.parse(refileParsed.startsWith('[') ? refileParsed : `[${refileParsed}]`) as {
            FullName: string
            Length: number
            LastWriteTime: string
          }[]

          for (const raw of rawRefiles) {
            if (signal.aborted) break
            if (isSystemPath(raw.FullName)) continue

            const pointer = readRefilePointer(raw.FullName)
            if (!pointer) continue

            items.push({
              path: raw.FullName,
              size: pointer.size,
              mime: pointer.mime,
              mtime: new Date(raw.LastWriteTime).getTime(),
              isVirtualized: true,
            })
          }
        } catch {
          // Skip errors
        }
      }
    } catch {
      // Scan failed
    } finally {
      this.abortController = null
    }

    // Sort by size descending
    items.sort((a, b) => b.size - a.size)

    return {
      items,
      totalSize: items.reduce((sum, i) => sum + i.size, 0),
      scanDurationMs: Date.now() - startTime,
    }
  }

  async push(filePaths: readonly string[]): Promise<VirtPushResult> {
    const config = this.loadConfig()
    if (!config) {
      return { pushed: 0, failed: filePaths.length, freedBytes: 0, errors: ['No backend configured'] }
    }

    const backendConfig = config.backends[config.defaultBackend]
    if (!backendConfig) {
      return { pushed: 0, failed: filePaths.length, freedBytes: 0, errors: [`Backend "${config.defaultBackend}" not found`] }
    }

    const backend = createBackend(backendConfig)
    this.abortController = new AbortController()
    const { signal } = this.abortController

    let pushed = 0
    let freedBytes = 0
    const errors: string[] = []

    for (let i = 0; i < filePaths.length; i++) {
      if (signal.aborted) {
        errors.push('Operation cancelled')
        break
      }

      const filePath = path.resolve(filePaths[i])

      try {
        // Validate file exists and is not in system dirs
        if (isSystemPath(filePath)) {
          errors.push(`${filePath}: system path, skipped`)
          continue
        }

        const stat = fs.statSync(filePath)
        if (stat.size < MIN_SIZE_BYTES) {
          errors.push(`${filePath}: too small (${stat.size} bytes)`)
          continue
        }

        this.emit('virt-progress', {
          phase: 'hashing',
          current: i + 1,
          total: filePaths.length,
          currentFile: filePath,
          bytesProcessed: freedBytes,
        } satisfies VirtProgress)

        // Hash the file
        const hash = await hashFile(filePath)

        // Get metadata before upload
        const meta = getFileMeta(filePath)
        const mimeType = lookup(filePath) || 'application/octet-stream'
        const fileName = path.basename(filePath)

        this.emit('virt-progress', {
          phase: 'uploading',
          current: i + 1,
          total: filePaths.length,
          currentFile: filePath,
          bytesProcessed: freedBytes,
        } satisfies VirtProgress)

        // Read and upload (async to avoid blocking event loop)
        const buffer = await fs.promises.readFile(filePath)
        const uploadResult = await backend.upload(buffer, fileName, mimeType)

        // Verify upload is retrievable before deleting original
        if (backend.verify) {
          const isAvailable = await backend.verify(uploadResult.url)
          if (!isAvailable) {
            errors.push(`${filePath}: upload verification failed, original preserved`)
            continue
          }
        }

        // Create pointer
        const pointer = createRefilePointer({
          mime: mimeType,
          url: uploadResult.url,
          hash,
          size: stat.size,
          name: fileName,
          backend: config.defaultBackend,
          meta: { mode: meta.mode, mtime: meta.mtime, atime: meta.atime },
        })

        // Write pointer file (extension based on MIME type)
        const refilePath = getRefilePath(filePath, mimeType)
        writeRefilePointer(refilePath, pointer)

        // Verify pointer was written correctly
        const verifyPointer = readRefilePointer(refilePath)
        if (!verifyPointer) {
          try { fs.unlinkSync(refilePath) } catch { /* ignore */ }
          errors.push(`${filePath}: failed to verify pointer`)
          continue
        }

        // Only now delete the original file
        fs.unlinkSync(filePath)

        pushed++
        freedBytes += stat.size
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    this.abortController = null

    return { pushed, failed: filePaths.length - pushed, freedBytes, errors }
  }

  async pull(refilePaths: readonly string[]): Promise<VirtPullResult> {
    const config = this.loadConfig()
    if (!config) {
      return { pulled: 0, failed: refilePaths.length, restoredBytes: 0, errors: ['No backend configured'] }
    }

    this.abortController = new AbortController()
    const { signal } = this.abortController

    let pulled = 0
    let restoredBytes = 0
    const errors: string[] = []

    for (let i = 0; i < refilePaths.length; i++) {
      if (signal.aborted) {
        errors.push('Operation cancelled')
        break
      }

      const refilePath = path.resolve(refilePaths[i])

      try {
        // Validate paths are not in system directories
        if (isSystemPath(refilePath)) {
          errors.push(`${refilePath}: system path, skipped`)
          continue
        }

        const originalPath = getOriginalPath(refilePath)
        if (isSystemPath(originalPath)) {
          errors.push(`${refilePath}: restoring to system path, skipped`)
          continue
        }

        const pointer = readRefilePointer(refilePath)
        if (!pointer) {
          errors.push(`${refilePath}: invalid pointer`)
          continue
        }

        const backendName = pointer.backend ?? config.defaultBackend
        const backendConfig = config.backends[backendName]
        if (!backendConfig) {
          errors.push(`${refilePath}: backend "${backendName}" not found`)
          continue
        }

        const backend = createBackend(backendConfig)

        this.emit('virt-progress', {
          phase: 'downloading',
          current: i + 1,
          total: refilePaths.length,
          currentFile: refilePath,
          bytesProcessed: restoredBytes,
        } satisfies VirtProgress)

        // Download the file
        const { buffer } = await backend.download(pointer.url)

        // Verify hash
        if (!verifyHash(buffer, pointer.hash)) {
          errors.push(`${refilePath}: hash mismatch — file not restored`)
          continue
        }

        // Write the original file
        await fs.promises.writeFile(originalPath, buffer)

        // Restore metadata if available
        if (pointer.meta) {
          restoreFileMeta(originalPath, {
            mode: pointer.meta.mode ?? 0o644,
            mtime: pointer.meta.mtime ?? Date.now(),
            atime: pointer.meta.atime ?? Date.now(),
          })
        }

        // Delete the pointer file
        fs.unlinkSync(refilePath)

        pulled++
        restoredBytes += pointer.size
      } catch (err) {
        errors.push(`${refilePath}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    this.abortController = null

    return { pulled, failed: refilePaths.length - pulled, restoredBytes, errors }
  }

  async getStatus(): Promise<VirtStatusResult> {
    const config = this.loadConfig()
    let virtualizedFiles = 0
    let savedBytes = 0

    try {
      const script = `Get-Volume | Where-Object { $_.FileSystemType -eq 'NTFS' -and $_.DriveLetter } | Select-Object -ExpandProperty DriveLetter`
      const volumeOutput = await runPs(script)
      const driveLetters = volumeOutput.trim().split(/\r?\n/).filter(Boolean).map((d) => d.trim())

      for (const letter of driveLetters) {
        if (!isValidDriveLetter(letter)) continue
        const drive = `${letter}:\\`

        try {
          const statusExtFilter = EXTENSIONS.map((ext) => `'*${ext}'`).join(',')
          const refileScript = `Get-ChildItem -Path '${psEscape(drive)}' -Recurse -File -Include ${statusExtFilter} -ErrorAction SilentlyContinue | Select-Object FullName | ConvertTo-Json -Compress`
          const output = await runPs(refileScript)
          const parsed = output.trim()
          if (!parsed) continue

          const files = JSON.parse(parsed.startsWith('[') ? parsed : `[${parsed}]`) as { FullName: string }[]

          for (const file of files) {
            if (isSystemPath(file.FullName)) continue
            const pointer = readRefilePointer(file.FullName)
            if (pointer) {
              virtualizedFiles++
              savedBytes += pointer.size
            }
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // Ignore errors
    }

    return {
      virtualizedFiles,
      savedBytes,
      hasConfig: config !== null,
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}
