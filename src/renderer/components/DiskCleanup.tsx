import { useState, useMemo } from 'react';
import { useDiskCleanup } from '../hooks/useDiskCleanup';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { CleanupCategory, DiskCleanupItem } from '@shared/types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function daysAgo(timestamp: number): number {
  if (!timestamp) return 0;
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

const CATEGORY_ORDER: readonly CleanupCategory[] = [
  'dev-deps',
  'dev-build',
  'pkg-cache',
  'temp',
  'browser-cache',
  'recycle-bin',
];

function CategoryGroup({
  category,
  items,
  selected,
  onToggle,
  onToggleAll,
  locale,
}: {
  category: CleanupCategory;
  items: readonly DiskCleanupItem[];
  selected: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onToggleAll: (category: CleanupCategory, paths: readonly string[]) => void;
  locale: 'en' | 'zh';
}) {
  const [collapsed, setCollapsed] = useState(false);

  const categoryTotal = items.reduce((sum, item) => sum + item.sizeBytes, 0);
  const allPaths = items.map((item) => item.path);
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.path));
  const someSelected = items.some((item) => selected.has(item.path));

  const categoryKey = `diskcleanup.${category === 'dev-deps' ? 'devDeps' : category === 'dev-build' ? 'devBuild' : category === 'pkg-cache' ? 'pkgCache' : category === 'browser-cache' ? 'browserCache' : category === 'recycle-bin' ? 'recycleBin' : 'temp'}` as const;

  return (
    <div className="rounded-lg border border-mg-border/40 overflow-hidden">
      {/* Category header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 bg-mg-card/40 hover:bg-mg-card/60 cursor-pointer transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <svg
          className={`w-3.5 h-3.5 text-mg-muted transition-transform flex-shrink-0 ${collapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>
        <span className="text-sm font-medium text-mg-text flex-1">
          {t(categoryKey, locale)} ({formatBytes(categoryTotal)})
        </span>
        <span className="text-xs text-mg-muted">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleAll(category, allPaths);
          }}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${
            allSelected
              ? 'bg-mg-primary/20 text-mg-primary'
              : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
          }`}
        >
          {t('diskcleanup.selectAll', locale)}
        </button>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="divide-y divide-mg-border/20">
          {items.map((item) => {
            const days = daysAgo(item.lastModified);
            const isStale = days > 30;

            return (
              <label
                key={item.id}
                className="flex items-center gap-3 px-4 py-2 hover:bg-mg-card/30 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.path)}
                  onChange={() => onToggle(item.path)}
                  className="w-4 h-4 rounded border-mg-border text-mg-primary focus:ring-mg-primary/30 bg-mg-bg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-mg-text truncate">{item.label}</span>
                    {isStale && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                        {t('diskcleanup.stale', locale)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-mg-muted truncate" title={item.path}>{item.path}</div>
                </div>
                <span className="text-sm text-mg-text font-mono flex-shrink-0">{formatBytes(item.sizeBytes)}</span>
                {item.lastModified > 0 && (
                  <span className={`text-xs flex-shrink-0 ${isStale ? 'text-amber-400' : 'text-mg-muted'}`}>
                    {days}d ago
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DiskCleanup() {
  const { items, isScanning, isCleaning, scanDurationMs, progress, cleanResult, scan, cancel, clean } = useDiskCleanup();
  const locale = useAppStore((s) => s.locale);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<CleanupCategory, DiskCleanupItem[]>();
    for (const item of items) {
      const existing = groups.get(item.category) ?? [];
      groups.set(item.category, [...existing, item]);
    }
    return groups;
  }, [items]);

  const selectedTotal = useMemo(() => {
    return items.filter((item) => selected.has(item.path)).reduce((sum, item) => sum + item.sizeBytes, 0);
  }, [items, selected]);

  const selectedCount = selected.size;

  const handleToggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleToggleAll = (_category: CleanupCategory, paths: readonly string[]) => {
    setSelected((prev) => {
      const allSelected = paths.every((p) => prev.has(p));
      const next = new Set(prev);
      if (allSelected) {
        for (const p of paths) next.delete(p);
      } else {
        for (const p of paths) next.add(p);
      }
      return next;
    });
  };

  const handleClean = async () => {
    setShowConfirm(false);
    const paths = [...selected];
    // Build a sizes map so the main process can report totalFreed
    const sizes: Record<string, number> = {};
    for (const item of items) {
      if (selected.has(item.path)) {
        sizes[item.path] = item.sizeBytes;
      }
    }
    await clean(paths, sizes);
    setSelected(new Set());
  };

  const handleScan = async () => {
    setSelected(new Set());
    await scan();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {isScanning ? (
          <button
            onClick={cancel}
            className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            {t('diskcleanup.cancel', locale)}
          </button>
        ) : (
          <button
            onClick={handleScan}
            disabled={isCleaning}
            className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {t('diskcleanup.scan', locale)}
          </button>
        )}

        {isScanning && (
          <div className="flex items-center gap-2 text-sm text-mg-muted">
            <div className="w-4 h-4 border-2 border-mg-primary border-t-transparent rounded-full animate-spin" />
            <span>{t('diskcleanup.scanning', locale)}</span>
            <span className="font-mono">
              {progress.found} {t('diskcleanup.found', locale)} ({formatBytes(progress.totalBytes)})
            </span>
          </div>
        )}

        {!isScanning && items.length > 0 && (
          <span className="text-xs text-mg-muted">
            {items.length} items ({formatBytes(items.reduce((s, i) => s + i.sizeBytes, 0))})
            {scanDurationMs > 0 && ` in ${formatDuration(scanDurationMs)}`}
          </span>
        )}
      </div>

      {/* Empty state */}
      {!isScanning && items.length === 0 && (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">{t('diskcleanup.empty', locale)}</div>
          <div className="text-mg-muted/60 text-xs mt-1">{t('diskcleanup.emptyHint', locale)}</div>
        </div>
      )}

      {/* Category groups */}
      {items.length > 0 && (
        <div className="space-y-3">
          {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
            <CategoryGroup
              key={cat}
              category={cat}
              items={grouped.get(cat)!}
              selected={selected}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* Footer: selection summary + clean button */}
      {items.length > 0 && (
        <div className="flex items-center justify-between border-t border-mg-border/40 pt-4">
          <span className="text-sm text-mg-muted">
            {t('diskcleanup.selected', locale)}: {selectedCount} item{selectedCount !== 1 ? 's' : ''} ({formatBytes(selectedTotal)})
          </span>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={selectedCount === 0 || isCleaning}
            className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {isCleaning ? t('diskcleanup.cleaning', locale) : t('diskcleanup.clean', locale)}
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-mg-surface border border-mg-border rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-mg-text mb-2">{t('diskcleanup.confirmClean', locale)}</h3>
            <p className="text-sm text-mg-muted mb-4">
              {t('diskcleanup.confirmCleanDesc', locale).replace('{count}', String(selectedCount)).replace('{size}', formatBytes(selectedTotal))}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-1.5 text-sm rounded bg-mg-border/50 text-mg-muted hover:text-mg-text transition-colors"
              >
                {t('diskcleanup.cancel', locale)}
              </button>
              <button
                onClick={handleClean}
                className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                {t('diskcleanup.clean', locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean result */}
      {cleanResult && (
        <div className="rounded-lg border border-mg-border/40 p-4 space-y-2">
          {cleanResult.cleaned.length > 0 && (
            <div className="text-sm text-green-400">
              {t('diskcleanup.freed', locale)}: {cleanResult.cleaned.length} item{cleanResult.cleaned.length !== 1 ? 's' : ''} ({formatBytes(cleanResult.totalFreed)})
            </div>
          )}
          {cleanResult.failed.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-red-400">{t('diskcleanup.failed', locale)}:</div>
              {cleanResult.failed.map((f) => (
                <div key={f.path} className="text-xs text-mg-muted pl-2">
                  {f.path} — {f.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
