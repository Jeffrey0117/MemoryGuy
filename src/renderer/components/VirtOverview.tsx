import { useState, useMemo, useCallback } from 'react'
import { t } from '../i18n'
import type { Locale } from '../i18n'
import type { VirtRegistryEntry, VirtRegistryStats, VirtRegistryScanResult } from '@shared/types'

type MimeFilter = 'all' | 'video' | 'image' | 'audio' | 'archive' | 'document' | 'other'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function getMimeCategory(mime: string): MimeFilter {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z') || mime.includes('compress')) return 'archive'
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || mime.includes('spreadsheet') || mime.includes('presentation')) return 'document'
  return 'other'
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface VirtOverviewProps {
  readonly entries: readonly VirtRegistryEntry[]
  readonly stats: VirtRegistryStats | null
  readonly isLoading: boolean
  readonly locale: Locale
  readonly onScanFolders: (paths: string[]) => Promise<VirtRegistryScanResult>
  readonly onRebuild: () => Promise<VirtRegistryScanResult>
  readonly onPull: (refilePaths: string[]) => void
  readonly onSelectFolder: () => Promise<string | null>
  readonly isPulling: boolean
}

export function VirtOverview({
  entries,
  stats,
  isLoading,
  locale,
  onScanFolders,
  onRebuild,
  onPull,
  onSelectFolder,
  isPulling,
}: VirtOverviewProps) {
  const [mimeFilter, setMimeFilter] = useState<MimeFilter>('all')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [isRebuilding, setIsRebuilding] = useState(false)

  const filteredEntries = useMemo(() => {
    if (mimeFilter === 'all') return entries
    return entries.filter((e) => getMimeCategory(e.mime) === mimeFilter)
  }, [entries, mimeFilter])

  const selectedEntries = useMemo(
    () => filteredEntries.filter((e) => selected.has(e.pointerPath)),
    [filteredEntries, selected]
  )

  const selectedTotalSize = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + e.size, 0),
    [selectedEntries]
  )

  const handleToggle = useCallback((pointerPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pointerPath)) {
        next.delete(pointerPath)
      } else {
        next.add(pointerPath)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const allSelected = filteredEntries.every((e) => prev.has(e.pointerPath))
      if (allSelected) return new Set()
      return new Set(filteredEntries.map((e) => e.pointerPath))
    })
  }, [filteredEntries])

  const handleScanFolders = useCallback(async () => {
    const folderPath = await onSelectFolder()
    if (!folderPath) return
    const result = await onScanFolders([folderPath])
    setScanMessage(
      t('virt.overview.scanResult', locale)
        .replace('{added}', String(result.added))
        .replace('{migrated}', String(result.migrated))
    )
    setTimeout(() => setScanMessage(null), 5000)
  }, [onSelectFolder, onScanFolders, locale])

  const handleRebuild = useCallback(async () => {
    setIsRebuilding(true)
    try {
      const result = await onRebuild()
      setScanMessage(
        t('virt.overview.scanResult', locale)
          .replace('{added}', String(result.added))
          .replace('{migrated}', String(result.migrated))
      )
      setTimeout(() => setScanMessage(null), 5000)
    } finally {
      setIsRebuilding(false)
    }
  }, [onRebuild, locale])

  const handleBatchRestore = useCallback(() => {
    const paths = selectedEntries.map((e) => e.pointerPath)
    if (paths.length === 0) return
    onPull(paths)
    setSelected(new Set())
  }, [selectedEntries, onPull])

  const isBusy = isLoading || isPulling || isRebuilding

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-mg-border/40 p-3">
            <div className="text-xs text-mg-muted">{t('virt.overview.totalFiles', locale)}</div>
            <div className="text-xl font-bold text-mg-text mt-1">{stats.totalFiles}</div>
          </div>
          <div className="rounded-lg border border-mg-border/40 p-3">
            <div className="text-xs text-mg-muted">{t('virt.overview.totalSaved', locale)}</div>
            <div className="text-xl font-bold text-green-400 mt-1">{formatBytes(stats.totalSavedBytes)}</div>
          </div>
          {stats.byType.map((bt) => (
            <div key={bt.category} className="rounded-lg border border-mg-border/30 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-mg-muted capitalize">{bt.category}</span>
                <span className="text-xs text-mg-text font-medium">{bt.count}</span>
              </div>
              <div className="text-sm text-mg-text mt-0.5">{formatBytes(bt.bytes)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleScanFolders}
          disabled={isBusy}
          className="px-3 py-1.5 text-xs rounded bg-mg-border/30 text-mg-muted hover:text-mg-text hover:bg-mg-border/50 disabled:opacity-50 transition-colors"
        >
          {t('virt.overview.scanFolders', locale)}
        </button>
        <button
          onClick={handleRebuild}
          disabled={isBusy}
          className="px-3 py-1.5 text-xs rounded bg-mg-border/30 text-mg-muted hover:text-mg-text hover:bg-mg-border/50 disabled:opacity-50 transition-colors"
        >
          {isRebuilding ? '...' : t('virt.overview.rebuild', locale)}
        </button>

        <div className="flex-1" />

        {scanMessage && (
          <span className="text-xs text-green-400">{scanMessage}</span>
        )}
      </div>

      {/* Loading spinner */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-mg-muted">
          <div className="w-4 h-4 border-2 border-mg-primary border-t-transparent rounded-full animate-spin" />
          <span>{t('virt.loading', locale)}</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries.length === 0 && (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">{t('virt.overview.empty', locale)}</div>
        </div>
      )}

      {/* Filter bar + select all */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSelectAll}
            disabled={filteredEntries.length === 0}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              filteredEntries.length > 0 && filteredEntries.every((e) => selected.has(e.pointerPath))
                ? 'bg-mg-primary/20 text-mg-primary'
                : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
            }`}
          >
            {t('virt.selectAll', locale)}
          </button>
          <span className="text-xs text-mg-muted">
            {filteredEntries.length} {t('virt.files', locale)}
          </span>

          <div className="flex-1" />

          <div className="flex gap-1">
            {(['all', 'video', 'image', 'audio', 'archive', 'document', 'other'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setMimeFilter(f); setSelected(new Set()) }}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  mimeFilter === f
                    ? 'bg-mg-primary/20 text-mg-primary'
                    : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
                }`}
              >
                {f === 'all'
                  ? t('virt.filter.all', locale)
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File list */}
      {filteredEntries.length > 0 && (
        <div className="rounded-lg border border-mg-border/40 divide-y divide-mg-border/20 max-h-[420px] overflow-y-auto">
          {filteredEntries.map((entry) => (
            <div
              key={entry.pointerPath}
              className="flex items-center gap-3 px-4 py-2 hover:bg-mg-card/30 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(entry.pointerPath)}
                onChange={() => handleToggle(entry.pointerPath)}
                className="w-4 h-4 rounded border-mg-border text-mg-primary focus:ring-mg-primary/30 bg-mg-bg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-mg-text truncate">{entry.name}</div>
                <div className="text-xs text-mg-muted truncate" title={entry.originalPath}>{entry.originalPath}</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-mg-border/30 text-mg-muted flex-shrink-0">
                {entry.mime.split('/')[1]?.slice(0, 8) ?? entry.mime}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-mg-border/30 text-mg-muted flex-shrink-0">
                {entry.backend}
              </span>
              <span className="text-xs text-mg-muted flex-shrink-0">{formatDate(entry.createdAt)}</span>
              <span className="text-sm text-mg-text font-mono flex-shrink-0 w-20 text-right">{formatBytes(entry.size)}</span>
              <button
                onClick={() => onPull([entry.pointerPath])}
                disabled={isBusy}
                className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {t('virt.restore', locale)}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Batch restore bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between border-t border-mg-border/40 pt-3">
          <span className="text-sm text-mg-muted">
            {t('virt.selected', locale)}: {selected.size} ({formatBytes(selectedTotalSize)})
          </span>
          <button
            onClick={handleBatchRestore}
            disabled={isBusy}
            className="px-4 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {isPulling ? t('virt.restoring', locale) : t('virt.batchRestore', locale)} ({selected.size})
          </button>
        </div>
      )}
    </div>
  )
}
