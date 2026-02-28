import { useState, useMemo, useEffect } from 'react';
import { useVirtualize } from '../hooks/useVirtualize';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { VirtScanItem, VirtConfig } from '@shared/types';

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

type MimeFilter = 'all' | 'video' | 'image' | 'archive' | 'document' | 'other';

function getMimeCategory(mime: string): MimeFilter {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z') || mime.includes('compress')) return 'archive';
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || mime.includes('spreadsheet') || mime.includes('presentation')) return 'document';
  return 'other';
}

const THRESHOLD_STEPS = [
  10 * 1024 * 1024,      // 10 MB
  25 * 1024 * 1024,      // 25 MB
  50 * 1024 * 1024,      // 50 MB
  100 * 1024 * 1024,     // 100 MB
  250 * 1024 * 1024,     // 250 MB
  500 * 1024 * 1024,     // 500 MB
  1024 * 1024 * 1024,    // 1 GB
];

type BackendType = 'http-upload' | 'duk' | 'self-hosted';

const BACKEND_LABELS: Record<BackendType, string> = {
  'self-hosted': 'Self-Hosted',
  'duk': 'duk (ReFile Workers)',
  'http-upload': 'HTTP Upload',
};

function ConfigPanel({
  config,
  onSave,
  locale,
}: {
  config: VirtConfig | null;
  onSave: (config: VirtConfig) => void;
  locale: 'en' | 'zh';
}) {
  const current = config?.backends[config.defaultBackend];
  const [backendType, setBackendType] = useState<BackendType>(
    (current?.type as BackendType) ?? 'self-hosted'
  );

  // self-hosted fields
  const [shEndpoint, setShEndpoint] = useState(
    current?.type === 'self-hosted' ? current.endpoint : 'https://refile.isnowfriend.com'
  );
  const [shApiKey, setShApiKey] = useState(
    current?.type === 'self-hosted' ? (current.apiKey ?? '') : ''
  );

  // http-upload fields
  const [endpoint, setEndpoint] = useState(
    current?.type === 'http-upload' ? current.endpoint : ''
  );
  const [fieldName, setFieldName] = useState(current?.fieldName ?? 'file');
  const [responseUrlPath, setResponseUrlPath] = useState(current?.responseUrlPath ?? 'data.url');

  // duk fields
  const [dukEndpoint, setDukEndpoint] = useState(
    current?.type === 'duk' ? current.endpoint : 'http://localhost:8787'
  );
  const [dukApiKey, setDukApiKey] = useState(
    current?.type === 'duk' ? (current.apiKey ?? '') : ''
  );
  const [dukVariant, setDukVariant] = useState<'duky' | 'dukic' | 'dukbox'>(
    current?.type === 'duk' ? (current.variant ?? 'dukbox') : 'dukbox'
  );

  const handleSave = () => {
    if (backendType === 'self-hosted') {
      if (!shEndpoint.trim() || !shApiKey.trim()) return;
      onSave({
        defaultBackend: 'self-hosted',
        backends: {
          'self-hosted': {
            type: 'self-hosted',
            endpoint: shEndpoint.trim(),
            apiKey: shApiKey.trim(),
          },
        },
      });
    } else if (backendType === 'duk') {
      if (!dukEndpoint.trim() || !dukApiKey.trim()) return;
      onSave({
        defaultBackend: 'default',
        backends: {
          default: {
            type: 'duk',
            variant: dukVariant,
            endpoint: dukEndpoint.trim(),
            apiKey: dukApiKey.trim(),
          },
        },
      });
    } else {
      if (!endpoint.trim()) return;
      onSave({
        defaultBackend: 'default',
        backends: {
          default: {
            type: 'http-upload',
            endpoint: endpoint.trim(),
            fieldName: fieldName.trim() || 'file',
            responseUrlPath: responseUrlPath.trim() || 'data.url',
          },
        },
      });
    }
  };

  const inputCls = 'mt-1 w-full px-3 py-1.5 text-sm rounded bg-mg-bg border border-mg-border/40 text-mg-text placeholder:text-mg-muted/50 focus:outline-none focus:border-mg-primary/50';
  const canSave = backendType === 'self-hosted'
    ? shEndpoint.trim() && shApiKey.trim()
    : backendType === 'duk'
      ? dukEndpoint.trim() && dukApiKey.trim()
      : endpoint.trim();

  return (
    <div className="rounded-lg border border-mg-border/40 p-4 space-y-3">
      <h3 className="text-sm font-medium text-mg-text">{t('virt.config.title', locale)}</h3>

      {/* Backend type selector */}
      <div className="flex gap-1">
        {(['self-hosted', 'duk', 'http-upload'] as const).map((bt) => (
          <button
            key={bt}
            onClick={() => setBackendType(bt)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              backendType === bt
                ? 'bg-mg-primary/20 text-mg-primary'
                : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
            }`}
          >
            {BACKEND_LABELS[bt]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {backendType === 'self-hosted' ? (
          <>
            <label className="block">
              <span className="text-xs text-mg-muted">{t('virt.config.endpoint', locale)}</span>
              <input type="text" value={shEndpoint} onChange={(e) => setShEndpoint(e.target.value)}
                placeholder="https://refile.isnowfriend.com" className={inputCls} />
            </label>

            <label className="block">
              <span className="text-xs text-mg-muted">{t('virt.config.apiKey', locale)}</span>
              <input type="password" value={shApiKey} onChange={(e) => setShApiKey(e.target.value)}
                placeholder="Bearer token" className={inputCls} />
            </label>

            <div className="text-xs text-mg-muted/60 bg-mg-border/10 rounded p-2">
              {t('virt.config.selfHostedHint', locale)}
            </div>
          </>
        ) : backendType === 'duk' ? (
          <>
            {/* Variant selector */}
            <div>
              <span className="text-xs text-mg-muted">{t('virt.config.variant', locale)}</span>
              <div className="flex gap-1 mt-1">
                {(['duky', 'dukic', 'dukbox'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setDukVariant(v)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      dukVariant === v
                        ? 'bg-mg-primary/20 text-mg-primary'
                        : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
                    }`}
                  >
                    {v === 'duky' ? `duky (${t('virt.config.video', locale)})` :
                     v === 'dukic' ? `dukic (${t('virt.config.audio', locale)})` :
                     `dukbox (${t('virt.config.general', locale)})`}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs text-mg-muted">{t('virt.config.endpoint', locale)}</span>
              <input type="text" value={dukEndpoint} onChange={(e) => setDukEndpoint(e.target.value)}
                placeholder="http://localhost:8787" className={inputCls} />
            </label>

            <label className="block">
              <span className="text-xs text-mg-muted">{t('virt.config.apiKey', locale)}</span>
              <input type="password" value={dukApiKey} onChange={(e) => setDukApiKey(e.target.value)}
                placeholder="Bearer token" className={inputCls} />
            </label>

            {/* Auto-routing hint */}
            <div className="text-xs text-mg-muted/60 bg-mg-border/10 rounded p-2">
              {t('virt.config.routingHint', locale)}
            </div>
          </>
        ) : (
          <>
            <label className="block">
              <span className="text-xs text-mg-muted">{t('virt.config.endpoint', locale)}</span>
              <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://example.com/upload" className={inputCls} />
            </label>

            <label className="block">
              <span className="text-xs text-mg-muted">{t('virt.config.fieldName', locale)}</span>
              <input type="text" value={fieldName} onChange={(e) => setFieldName(e.target.value)}
                placeholder="file" className={inputCls} />
            </label>

            <label className="block">
              <span className="text-xs text-mg-muted">{t('virt.config.responsePath', locale)}</span>
              <input type="text" value={responseUrlPath} onChange={(e) => setResponseUrlPath(e.target.value)}
                placeholder="data.url" className={inputCls} />
            </label>
          </>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {t('virt.config.save', locale)}
      </button>
    </div>
  );
}

export function DiskVirtualize() {
  const {
    items, isScanning, isPushing, isPulling, scanDurationMs, progress,
    pushResult, pullResult, status, config,
    scan, push, pull, cancel, loadStatus, saveConfig,
  } = useVirtualize();
  const locale = useAppStore((s) => s.locale);

  const [mode, setMode] = useState<'push' | 'pull'>('push');
  const [thresholdIdx, setThresholdIdx] = useState(2); // 50MB default
  const [mimeFilter, setMimeFilter] = useState<MimeFilter>('all');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  // Load status when switching to pull mode
  useEffect(() => {
    if (mode === 'pull') {
      loadStatus();
    }
  }, [mode, loadStatus]);

  const filteredItems = useMemo(() => {
    const byMode = items.filter((item) =>
      mode === 'push' ? !item.isVirtualized : item.isVirtualized
    );
    if (mimeFilter === 'all') return byMode;
    return byMode.filter((item) => getMimeCategory(item.mime) === mimeFilter);
  }, [items, mode, mimeFilter]);

  const selectedTotal = useMemo(() => {
    return filteredItems.filter((item) => selected.has(item.path)).reduce((sum, item) => sum + item.size, 0);
  }, [filteredItems, selected]);

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

  const handleSelectAll = () => {
    setSelected((prev) => {
      const allSelected = filteredItems.every((item) => prev.has(item.path));
      if (allSelected) return new Set();
      return new Set(filteredItems.map((item) => item.path));
    });
  };

  const handleScan = async () => {
    setSelected(new Set());
    await scan(THRESHOLD_STEPS[thresholdIdx]);
  };

  const handlePush = async () => {
    setShowConfirm(false);
    const paths = filteredItems.filter((item) => selected.has(item.path)).map((item) => item.path);
    await push(paths);
    setSelected(new Set());
  };

  const handlePull = async () => {
    setShowConfirm(false);
    const paths = filteredItems.filter((item) => selected.has(item.path)).map((item) => item.path);
    await pull(paths);
    setSelected(new Set());
  };

  const isBusy = isScanning || isPushing || isPulling;

  // Show config panel if no backend configured
  if (!config) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="text-mg-muted text-sm">{t('virt.noConfig', locale)}</div>
          <div className="text-mg-muted/60 text-xs mt-1">{t('virt.noConfigHint', locale)}</div>
        </div>
        <ConfigPanel config={config} onSave={saveConfig} locale={locale} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setMode('push'); setSelected(new Set()); }}
          className={`px-4 py-1.5 text-sm rounded transition-colors ${
            mode === 'push'
              ? 'bg-mg-primary text-white'
              : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
          }`}
        >
          {t('virt.mode.push', locale)}
        </button>
        <button
          onClick={() => { setMode('pull'); setSelected(new Set()); }}
          className={`px-4 py-1.5 text-sm rounded transition-colors ${
            mode === 'pull'
              ? 'bg-mg-primary text-white'
              : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
          }`}
        >
          {t('virt.mode.pull', locale)}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setMode(mode === 'push' ? 'pull' : 'push')}
          className="text-xs text-mg-muted hover:text-mg-text"
          title={t('virt.config.title', locale)}
        >
          {t('virt.config.title', locale)}
        </button>
      </div>

      {/* Push mode: scan toolbar */}
      {mode === 'push' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-mg-muted">{t('virt.threshold', locale)}:</span>
              <input
                type="range"
                min={0}
                max={THRESHOLD_STEPS.length - 1}
                value={thresholdIdx}
                onChange={(e) => setThresholdIdx(Number(e.target.value))}
                className="w-32 accent-mg-primary"
              />
              <span className="text-xs text-mg-text font-mono w-16">{formatBytes(THRESHOLD_STEPS[thresholdIdx])}</span>
            </div>

            {isScanning ? (
              <button
                onClick={cancel}
                className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                {t('virt.cancel', locale)}
              </button>
            ) : (
              <button
                onClick={handleScan}
                disabled={isBusy}
                className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {t('virt.scan', locale)}
              </button>
            )}

            {isScanning && progress && (
              <div className="flex items-center gap-2 text-sm text-mg-muted">
                <div className="w-4 h-4 border-2 border-mg-primary border-t-transparent rounded-full animate-spin" />
                <span>{progress.current} {t('virt.found', locale)} ({formatBytes(progress.bytesProcessed)})</span>
              </div>
            )}

            {!isScanning && items.length > 0 && (
              <span className="text-xs text-mg-muted">
                {filteredItems.length} items ({formatBytes(filteredItems.reduce((s, i) => s + i.size, 0))})
                {scanDurationMs > 0 && ` in ${formatDuration(scanDurationMs)}`}
              </span>
            )}
          </div>

          {/* Mime filter buttons */}
          {items.length > 0 && (
            <div className="flex gap-1">
              {(['all', 'video', 'image', 'archive', 'document', 'other'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setMimeFilter(f); setSelected(new Set()); }}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    mimeFilter === f
                      ? 'bg-mg-primary/20 text-mg-primary'
                      : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
                  }`}
                >
                  {t(`virt.filter.${f}` as Parameters<typeof t>[0], locale)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pull mode: status cards */}
      {mode === 'pull' && status && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-mg-border/40 p-4">
            <div className="text-2xl font-bold text-mg-text">{status.virtualizedFiles}</div>
            <div className="text-xs text-mg-muted">{t('virt.status.virtualized', locale)}</div>
          </div>
          <div className="rounded-lg border border-mg-border/40 p-4">
            <div className="text-2xl font-bold text-green-400">{formatBytes(status.savedBytes)}</div>
            <div className="text-xs text-mg-muted">{t('virt.status.saved', locale)}</div>
          </div>
        </div>
      )}

      {/* Pull mode: scan for .refile files */}
      {mode === 'pull' && (
        <div className="flex items-center gap-3">
          {isScanning ? (
            <button
              onClick={cancel}
              className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
            >
              {t('virt.cancel', locale)}
            </button>
          ) : (
            <button
              onClick={handleScan}
              disabled={isBusy}
              className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {t('virt.scanPointers', locale)}
            </button>
          )}

          {isScanning && progress && (
            <div className="flex items-center gap-2 text-sm text-mg-muted">
              <div className="w-4 h-4 border-2 border-mg-primary border-t-transparent rounded-full animate-spin" />
              <span>{t('virt.scanning', locale)}</span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isScanning && filteredItems.length === 0 && items.length === 0 && (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">
            {mode === 'push' ? t('virt.empty.push', locale) : t('virt.empty.pull', locale)}
          </div>
          <div className="text-mg-muted/60 text-xs mt-1">
            {mode === 'push' ? t('virt.empty.pushHint', locale) : t('virt.empty.pullHint', locale)}
          </div>
        </div>
      )}

      {/* File list */}
      {filteredItems.length > 0 && (
        <div className="rounded-lg border border-mg-border/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-mg-card/40">
            <button
              onClick={handleSelectAll}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                filteredItems.every((item) => selected.has(item.path))
                  ? 'bg-mg-primary/20 text-mg-primary'
                  : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
              }`}
            >
              {t('virt.selectAll', locale)}
            </button>
            <span className="text-xs text-mg-muted flex-1">{filteredItems.length} files</span>
          </div>

          {/* Items */}
          <div className="divide-y divide-mg-border/20 max-h-[400px] overflow-y-auto">
            {filteredItems.map((item) => (
              <FileRow
                key={item.path}
                item={item}
                isSelected={selected.has(item.path)}
                onToggle={() => handleToggle(item.path)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer: selection + action */}
      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between border-t border-mg-border/40 pt-4">
          <span className="text-sm text-mg-muted">
            {t('virt.selected', locale)}: {selected.size} ({formatBytes(selectedTotal)})
          </span>

          {mode === 'push' ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={selected.size === 0 || isBusy}
              className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {isPushing ? t('virt.pushing', locale) : t('virt.pushToCloud', locale)}
            </button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={selected.size === 0 || isBusy}
              className="px-4 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {isPulling ? t('virt.pulling', locale) : t('virt.restore', locale)}
            </button>
          )}
        </div>
      )}

      {/* Progress bar */}
      {(isPushing || isPulling) && progress && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-mg-muted">
            <div className="w-4 h-4 border-2 border-mg-primary border-t-transparent rounded-full animate-spin" />
            <span>
              {t(`virt.phase.${progress.phase}` as Parameters<typeof t>[0], locale)} ({progress.current}/{progress.total})
            </span>
          </div>
          <div className="text-xs text-mg-muted truncate">{progress.currentFile}</div>
          {progress.total > 0 && (
            <div className="w-full bg-mg-border/30 rounded-full h-1.5">
              <div
                className="bg-mg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-mg-surface border border-mg-border rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-mg-text mb-2">
              {mode === 'push' ? t('virt.confirm.push', locale) : t('virt.confirm.pull', locale)}
            </h3>
            <p className="text-sm text-mg-muted mb-4">
              {mode === 'push'
                ? t('virt.confirm.pushDesc', locale).replace('{count}', String(selected.size)).replace('{size}', formatBytes(selectedTotal))
                : t('virt.confirm.pullDesc', locale).replace('{count}', String(selected.size)).replace('{size}', formatBytes(selectedTotal))
              }
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-1.5 text-sm rounded bg-mg-border/50 text-mg-muted hover:text-mg-text transition-colors"
              >
                {t('virt.cancel', locale)}
              </button>
              <button
                onClick={mode === 'push' ? handlePush : handlePull}
                className={`px-4 py-1.5 text-sm rounded text-white transition-colors ${
                  mode === 'push' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {mode === 'push' ? t('virt.pushToCloud', locale) : t('virt.restore', locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push result */}
      {pushResult && (
        <div className="rounded-lg border border-mg-border/40 p-4 space-y-2">
          {pushResult.pushed > 0 && (
            <div className="text-sm text-green-400">
              {t('virt.result.pushed', locale)}: {pushResult.pushed} files ({formatBytes(pushResult.freedBytes)})
            </div>
          )}
          {pushResult.errors.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-red-400">{t('virt.result.failed', locale)}:</div>
              {pushResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-mg-muted pl-2 truncate">{e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pull result */}
      {pullResult && (
        <div className="rounded-lg border border-mg-border/40 p-4 space-y-2">
          {pullResult.pulled > 0 && (
            <div className="text-sm text-green-400">
              {t('virt.result.pulled', locale)}: {pullResult.pulled} files ({formatBytes(pullResult.restoredBytes)})
            </div>
          )}
          {pullResult.errors.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-red-400">{t('virt.result.failed', locale)}:</div>
              {pullResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-mg-muted pl-2 truncate">{e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsible config panel */}
      <details className="mt-4">
        <summary className="text-xs text-mg-muted cursor-pointer hover:text-mg-text">
          {t('virt.config.title', locale)}
        </summary>
        <div className="mt-2">
          <ConfigPanel config={config} onSave={saveConfig} locale={locale} />
        </div>
      </details>
    </div>
  );
}

function FileRow({ item, isSelected, onToggle }: { item: VirtScanItem; isSelected: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-3 px-4 py-2 hover:bg-mg-card/30 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="w-4 h-4 rounded border-mg-border text-mg-primary focus:ring-mg-primary/30 bg-mg-bg"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-mg-text truncate">{item.path.split('\\').pop()}</div>
        <div className="text-xs text-mg-muted truncate" title={item.path}>{item.path}</div>
      </div>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-mg-border/30 text-mg-muted flex-shrink-0">
        {item.mime.split('/')[1]?.slice(0, 8) ?? item.mime}
      </span>
      <span className="text-sm text-mg-text font-mono flex-shrink-0">{formatBytes(item.size)}</span>
    </label>
  );
}
