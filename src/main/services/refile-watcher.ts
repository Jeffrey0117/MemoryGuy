import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { WatchFolder, WatchEvent } from '@shared/types'
import type { DiskVirtualizer } from './disk-virtualizer'

const WATCH_FILE = 'refile-watches.json'
const WATCH_POLL_MS = 60_000 // 60s
const MAX_EVENTS = 200

interface WatchState {
  readonly folders: readonly WatchFolder[]
  readonly events: readonly WatchEvent[]
}

function makeId(folderPath: string): string {
  return createHash('sha256').update(folderPath.toLowerCase()).digest('hex').slice(0, 12)
}

export class RefileWatcher extends EventEmitter {
  private state: WatchState = { folders: [], events: [] }
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly virtualizer: DiskVirtualizer
  private isRunning = false

  constructor(virtualizer: DiskVirtualizer) {
    super()
    this.virtualizer = virtualizer
  }

  private getStatePath(): string {
    return path.join(app.getPath('userData'), WATCH_FILE)
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.getStatePath(), 'utf-8')
      const parsed = JSON.parse(raw) as WatchState
      this.state = {
        folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
      }
    } catch {
      this.state = { folders: [], events: [] }
    }
  }

  private save(): void {
    fs.writeFileSync(this.getStatePath(), JSON.stringify(this.state, null, 2), 'utf-8')
  }

  start(): void {
    this.load()
    this.timer = setInterval(() => this.poll(), WATCH_POLL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getFolders(): readonly WatchFolder[] {
    return this.state.folders
  }

  getEvents(): readonly WatchEvent[] {
    return this.state.events
  }

  addFolder(folderPath: string, thresholdBytes: number): WatchFolder {
    const resolved = path.resolve(folderPath)
    const existing = this.state.folders.find((f) => f.path.toLowerCase() === resolved.toLowerCase())
    if (existing) return existing

    const folder: WatchFolder = {
      id: makeId(resolved),
      path: resolved,
      thresholdBytes: Math.max(thresholdBytes, 1_048_576),
      enabled: true,
      lastScanAt: 0,
    }

    this.state = {
      ...this.state,
      folders: [...this.state.folders, folder],
    }
    this.save()
    return folder
  }

  removeFolder(id: string): void {
    this.state = {
      ...this.state,
      folders: this.state.folders.filter((f) => f.id !== id),
    }
    this.save()
  }

  toggleFolder(id: string): void {
    this.state = {
      ...this.state,
      folders: this.state.folders.map((f) =>
        f.id === id ? { ...f, enabled: !f.enabled } : f
      ),
    }
    this.save()
  }

  clearEvents(): void {
    this.state = { ...this.state, events: [] }
    this.save()
  }

  private addEvent(event: WatchEvent): void {
    const trimmed = this.state.events.length >= MAX_EVENTS
      ? this.state.events.slice(-(MAX_EVENTS - 1))
      : this.state.events
    this.state = {
      ...this.state,
      events: [...trimmed, event],
    }
    this.save()
    this.emit('watch-event', event)
  }

  private async poll(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const config = this.virtualizer.loadConfig()
      if (!config) return

      for (const folder of this.state.folders) {
        if (!folder.enabled) continue
        if (!fs.existsSync(folder.path)) continue

        try {
          const result = await this.virtualizer.scanFolder(folder.path)
          const pushable = result.items.filter((i) => !i.isVirtualized)

          if (pushable.length === 0) {
            // Update lastScanAt
            this.state = {
              ...this.state,
              folders: this.state.folders.map((f) =>
                f.id === folder.id ? { ...f, lastScanAt: Date.now() } : f
              ),
            }
            this.save()
            continue
          }

          // Auto-push each file
          const pushResult = await this.virtualizer.push(pushable.map((i) => i.path))

          // Record events
          for (const item of pushable) {
            const failed = pushResult.errors.find((e) => e.startsWith(`${item.path}:`))
            this.addEvent({
              timestamp: Date.now(),
              filePath: item.path,
              size: item.size,
              action: failed ? 'failed' : 'pushed',
              error: failed ? failed.split(': ').slice(1).join(': ') : undefined,
            })
          }

          // Update lastScanAt
          this.state = {
            ...this.state,
            folders: this.state.folders.map((f) =>
              f.id === folder.id ? { ...f, lastScanAt: Date.now() } : f
            ),
          }
          this.save()
        } catch {
          // Skip folder on error
        }
      }
    } finally {
      this.isRunning = false
    }
  }
}
