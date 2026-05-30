import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import type { DiskWatchdogSettings, DriveSpace, DiskLevel, DiskAlertTestResult } from '@shared/types'
import {
  WATCHDOG_DEFAULT_INTERVAL_SEC,
  WATCHDOG_DEFAULT_WARN_GB,
  WATCHDOG_DEFAULT_URGENT_GB,
  WATCHDOG_DEFAULT_RENOTIFY_MIN,
} from '@shared/constants'
import { getPlatform } from './platform'
import { sendTelegramMessage, type SendResult } from './telegram-notifier'

const CONFIG_FILE = 'disk-watchdog-config.json'
const GB = 1024 * 1024 * 1024
const MIN_INTERVAL_SEC = 15

const DEFAULTS: DiskWatchdogSettings = {
  enabled: false,
  telegramToken: '',
  telegramChatId: '',
  warnFreeGb: WATCHDOG_DEFAULT_WARN_GB,
  urgentFreeGb: WATCHDOG_DEFAULT_URGENT_GB,
  drives: [],
  intervalSec: WATCHDOG_DEFAULT_INTERVAL_SEC,
  reNotifyMin: WATCHDOG_DEFAULT_RENOTIFY_MIN,
}

/** Pure: classify a drive's free space into a severity level. */
export function computeLevel(freeBytes: number, warnGb: number, urgentGb: number): DiskLevel {
  const freeGb = freeBytes / GB
  if (freeGb <= urgentGb) return 'urgent'
  if (freeGb <= warnGb) return 'warn'
  return 'ok'
}

function rank(level: DiskLevel): number {
  return level === 'urgent' ? 2 : level === 'warn' ? 1 : 0
}

function fmtGb(bytes: number): string {
  return `${(bytes / GB).toFixed(1)} GB`
}

function clampNum(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

/** Pure: validate + normalise raw settings into a safe shape. */
export function sanitizeSettings(raw: Partial<DiskWatchdogSettings>): DiskWatchdogSettings {
  const warnFreeGb = clampNum(raw.warnFreeGb, DEFAULTS.warnFreeGb, 1, 100_000)
  let urgentFreeGb = clampNum(raw.urgentFreeGb, DEFAULTS.urgentFreeGb, 1, 100_000)
  if (urgentFreeGb > warnFreeGb) urgentFreeGb = warnFreeGb

  const drives = Array.isArray(raw.drives)
    ? raw.drives
        .filter((d): d is string => typeof d === 'string' && d.length > 0 && d.length < 260)
        .slice(0, 32)
    : []

  return {
    enabled: Boolean(raw.enabled),
    // Strip ALL whitespace (incl. CR/LF/tabs) — tokens/chat ids never contain any,
    // and this closes a path/header-injection vector in the Telegram request.
    telegramToken: typeof raw.telegramToken === 'string' ? raw.telegramToken.replace(/\s/g, '').slice(0, 256) : '',
    telegramChatId: typeof raw.telegramChatId === 'string' ? raw.telegramChatId.replace(/\s/g, '').slice(0, 64) : '',
    warnFreeGb,
    urgentFreeGb,
    drives,
    intervalSec: clampNum(raw.intervalSec, DEFAULTS.intervalSec, MIN_INTERVAL_SEC, 3600),
    reNotifyMin: clampNum(raw.reNotifyMin, DEFAULTS.reNotifyMin, 1, 1440),
  }
}

interface DriveState {
  level: DiskLevel
  lastNotifyAt: number
}

/**
 * Watches free space on fixed drives and pushes Telegram alerts when a drive
 * crosses the warn / urgent thresholds. Emits 'update' (DriveSpace[]) for the UI
 * and 'notify-error' (string) when a Telegram send fails.
 */
export class DiskWatchdog extends EventEmitter {
  private settings: DiskWatchdogSettings = { ...DEFAULTS }
  private timer: NodeJS.Timeout | null = null
  private checking = false
  private readonly driveStates = new Map<string, DriveState>()
  private readonly filePath: string

  constructor() {
    super()
    this.filePath = path.join(app.getPath('userData'), CONFIG_FILE)
  }

  start(): void {
    this.load()
    this.restartTimer()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getSettings(): DiskWatchdogSettings {
    return { ...this.settings }
  }

  setSettings(input: Partial<DiskWatchdogSettings>): DiskWatchdogSettings {
    this.settings = sanitizeSettings({ ...this.settings, ...input })
    this.save()
    // Keep per-drive memory across edits so cooldown is respected — the new
    // thresholds are re-applied on the next check via computeLevel.
    this.restartTimer()
    return this.getSettings()
  }

  async getDriveSpaces(): Promise<DriveSpace[]> {
    const platform = getPlatform()
    const drives = this.settings.drives.length > 0
      ? [...this.settings.drives]
      : await platform.diskOps.getFixedDrives()

    const result: DriveSpace[] = []
    for (const drive of drives) {
      let totalBytes = 0
      let freeBytes = 0
      try {
        const space = await platform.diskOps.getDriveSpace(drive)
        totalBytes = space.totalBytes
        freeBytes = space.freeBytes
      } catch {
        totalBytes = 0
        freeBytes = 0
      }
      // A drive we couldn't measure (0 total) is 'unknown' — never alert on it,
      // otherwise a transient measurement failure would fire a false "urgent".
      const level: DiskLevel = totalBytes <= 0
        ? 'unknown'
        : computeLevel(freeBytes, this.settings.warnFreeGb, this.settings.urgentFreeGb)
      result.push({ drive, totalBytes, freeBytes, level })
    }
    return result
  }

  async testAlert(): Promise<DiskAlertTestResult> {
    let summary = '(no drives detected)'
    try {
      const spaces = await this.getDriveSpaces()
      if (spaces.length > 0) {
        summary = spaces.map((s) => `${s.drive}: ${fmtGb(s.freeBytes)} free / ${fmtGb(s.totalBytes)}`).join('\n')
      }
    } catch {
      // fall through with default summary
    }
    const text = `🔔 MemoryGuy 測試通知\n主機: ${os.hostname()}\n${summary}`
    return this.notify(text)
  }

  private restartTimer(): void {
    this.stop()
    if (!this.settings.enabled) return
    const intervalMs = Math.max(MIN_INTERVAL_SEC, this.settings.intervalSec) * 1000
    this.timer = setInterval(() => { void this.check() }, intervalMs)
    void this.check()
  }

  private async check(): Promise<void> {
    if (this.checking || !this.settings.enabled) return
    this.checking = true
    try {
      const spaces = await this.getDriveSpaces()
      this.emit('update', spaces)
      for (const space of spaces) {
        await this.evaluate(space)
      }
    } catch {
      // ignore transient measurement failures; next tick retries
    } finally {
      this.checking = false
    }
  }

  private async evaluate(space: DriveSpace): Promise<void> {
    // Unmeasurable drive — leave prior state untouched and never alert.
    if (space.level === 'unknown') return

    const prev = this.driveStates.get(space.drive) ?? { level: 'ok', lastNotifyAt: 0 }
    const now = Date.now()

    if (space.level === 'ok') {
      if (prev.level !== 'ok') {
        await this.notify(`✅ ${space.drive} 槽空間已恢復,目前剩 ${fmtGb(space.freeBytes)} / ${fmtGb(space.totalBytes)}。`)
      }
      this.driveStates.set(space.drive, { level: 'ok', lastNotifyAt: 0 })
      return
    }

    const worsened = rank(space.level) > rank(prev.level)
    const cooldownPassed = now - prev.lastNotifyAt >= this.settings.reNotifyMin * 60_000

    if (worsened || cooldownPassed) {
      const icon = space.level === 'urgent' ? '🚨' : '⚠️'
      const word = space.level === 'urgent' ? '緊急' : '偏低'
      await this.notify(
        `${icon} ${space.drive} 槽空間${word}!只剩 ${fmtGb(space.freeBytes)} / ${fmtGb(space.totalBytes)}(主機 ${os.hostname()})。`,
      )
      this.driveStates.set(space.drive, { level: space.level, lastNotifyAt: now })
    } else {
      this.driveStates.set(space.drive, { level: space.level, lastNotifyAt: prev.lastNotifyAt })
    }
  }

  private async notify(text: string): Promise<SendResult> {
    const { telegramToken, telegramChatId } = this.settings
    if (!telegramToken || !telegramChatId) {
      return { ok: false, error: 'Telegram token / chat id not configured' }
    }
    const result = await sendTelegramMessage(telegramToken, telegramChatId, text)
    if (!result.ok && result.error) this.emit('notify-error', result.error)
    return result
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        this.settings = sanitizeSettings(JSON.parse(raw))
      } else {
        this.settings = { ...DEFAULTS }
      }
    } catch {
      this.settings = { ...DEFAULTS }
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
    } catch {
      // settings remain in memory even if persistence fails
    }
  }
}
