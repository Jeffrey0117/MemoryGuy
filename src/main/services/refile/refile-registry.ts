import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { VirtRegistryEntry, VirtRegistryStats, VirtRegistryScanResult } from '@shared/types'
import { readRefilePointer, isRefilePath, getOriginalPathFromPointer } from './refile-format'

const REGISTRY_FILE = 'refile-registry.json'

function normalizeKey(p: string): string {
  return path.resolve(p).toLowerCase()
}

function getMimeCategory(mime: string): string {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (
    mime.includes('zip') || mime.includes('tar') || mime.includes('rar') ||
    mime.includes('7z') || mime.includes('compress')
  ) return 'archive'
  if (
    mime.includes('pdf') || mime.includes('document') || mime.includes('text') ||
    mime.includes('spreadsheet') || mime.includes('presentation')
  ) return 'document'
  return 'other'
}

export class RefileRegistry {
  private entries: Map<string, VirtRegistryEntry> = new Map()

  private getFilePath(): string {
    return path.join(app.getPath('userData'), REGISTRY_FILE)
  }

  start(): void {
    try {
      const raw = fs.readFileSync(this.getFilePath(), 'utf-8')
      const arr = JSON.parse(raw) as VirtRegistryEntry[]
      if (!Array.isArray(arr)) return
      const next = new Map<string, VirtRegistryEntry>()
      for (const entry of arr) {
        if (entry && typeof entry.pointerPath === 'string') {
          next.set(normalizeKey(entry.pointerPath), entry)
        }
      }
      this.entries = next
    } catch {
      // No file or invalid JSON — start empty
      this.entries = new Map()
    }
  }

  stop(): void {
    // No resources to release — entries persist via JSON
  }

  private save(): void {
    const arr = Array.from(this.entries.values())
    fs.writeFileSync(this.getFilePath(), JSON.stringify(arr, null, 2), 'utf-8')
  }

  addEntries(newEntries: readonly VirtRegistryEntry[]): void {
    if (newEntries.length === 0) return
    const next = new Map(this.entries)
    for (const entry of newEntries) {
      next.set(normalizeKey(entry.pointerPath), entry)
    }
    this.entries = next
    this.save()
  }

  removeEntries(pointerPaths: readonly string[]): void {
    if (pointerPaths.length === 0) return
    const next = new Map(this.entries)
    for (const p of pointerPaths) {
      next.delete(normalizeKey(p))
    }
    this.entries = next
    this.save()
  }

  list(): VirtRegistryEntry[] {
    return Array.from(this.entries.values())
  }

  stats(): VirtRegistryStats {
    const entries = Array.from(this.entries.values())
    const totalFiles = entries.length
    const totalSavedBytes = entries.reduce((sum, e) => sum + e.size, 0)

    const byTypeMap = new Map<string, { count: number; bytes: number }>()
    for (const entry of entries) {
      const cat = getMimeCategory(entry.mime)
      const existing = byTypeMap.get(cat)
      if (existing) {
        byTypeMap.set(cat, {
          count: existing.count + 1,
          bytes: existing.bytes + entry.size,
        })
      } else {
        byTypeMap.set(cat, { count: 1, bytes: entry.size })
      }
    }

    const byType = Array.from(byTypeMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      bytes: data.bytes,
    }))

    return { totalFiles, totalSavedBytes, byType }
  }

  scanFolders(folderPaths: readonly string[]): VirtRegistryScanResult {
    let added = 0
    let migrated = 0
    const batch: { key: string; entry: VirtRegistryEntry }[] = []

    for (const folderPath of folderPaths) {
      const resolved = path.resolve(folderPath)
      let dirEntries: string[]
      const prevNoAsar = process.noAsar
      process.noAsar = true
      try {
        dirEntries = fs.readdirSync(resolved)
      } catch {
        continue
      } finally {
        process.noAsar = prevNoAsar
      }

      for (const name of dirEntries) {
        const fullPath = path.join(resolved, name)
        if (!isRefilePath(fullPath)) continue

        const key = normalizeKey(fullPath)
        if (this.entries.has(key)) continue

        try {
          const stat = fs.statSync(fullPath)
          if (!stat.isFile()) continue

          // readRefilePointer now auto-migrates v1 .repic → v2
          const pointer = readRefilePointer(fullPath)
          if (!pointer) continue

          // Detect if migration happened (v2 with type virtual-image on a .repic)
          if (pointer.v === 2 && fullPath.endsWith('.repic')) {
            migrated++
          }

          batch.push({
            key,
            entry: {
              pointerPath: fullPath,
              originalPath: getOriginalPathFromPointer(fullPath, pointer.name),
              name: pointer.name,
              hash: pointer.hash,
              size: pointer.size,
              mime: pointer.mime,
              backend: pointer.backend ?? 'unknown',
              createdAt: pointer.createdAt,
            },
          })
          added++
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Batch commit — single Map copy for all new entries
    if (batch.length > 0) {
      const next = new Map(this.entries)
      for (const { key, entry } of batch) {
        next.set(key, entry)
      }
      this.entries = next
      this.save()
    }

    return { added, migrated }
  }

  rebuild(watchFolderPaths: readonly string[]): VirtRegistryScanResult {
    this.entries = new Map()
    return this.scanFolders(watchFolderPaths)
  }
}
