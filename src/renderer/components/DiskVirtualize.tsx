import { useState, useMemo, useCallback, useEffect } from 'react';
import { useVirtualize } from '../hooks/useVirtualize';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import { VirtOverview } from './VirtOverview';
import type { VirtScanItem, VirtConfig } from '@shared/types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

type MimeFilter = 'all' | 'video' | 'image' | 'archive' | 'document' | 'other';

function getMimeCategory(mime: string): MimeFilter {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z') || mime.includes('compress')) return 'archive';
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || mime.includes('spreadsheet') || mime.includes('presentation')) return 'document';
  return 'other';
}


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

  const [shEndpoint, setShEndpoint] = useState(
    current?.type === 'self-hosted' ? current.endpoint : 'https://refile.isnowfriend.com'
  );
  const [shApiKey, setShApiKey] = useState(
    current?.type === 'self-hosted' ? (current.apiKey ?? '') : 'refile-prod-key-2026'
  );

  const [endpoint, setEndpoint] = useState(
    current?.type === 'http-upload' ? current.endpoint : ''
  );
  const [fieldName, setFieldName] = useState(current?.fieldName ?? 'file');
  const [responseUrlPath, setResponseUrlPath] = useState(current?.responseUrlPath ?? 'data.url');

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

const FOLDER_NAME_KEYS: Record<string, Parameters<typeof t>[0]> = {
  desktop: 'virt.folder.desktop',
  documents: 'virt.folder.documents',
  downloads: 'virt.folder.downloads',
  pictures: 'virt.folder.pictures',
  videos: 'virt.folder.videos',
  music: 'virt.folder.music',
};

function getParentPath(folderPath: string): string | null {
  const sep = folderPath.includes('/') ? '/' : '\\';
  const parts = folderPath.replace(/[\\/]+$/, '').split(sep);
  if (parts.length <= 2) return null; // e.g. "C:\" has no parent
  return parts.slice(0, -1).join(sep);
}

export function DiskVirtualize() {
  const {
    items, isScanning, isPushing, isPulling, progress,
    pushResult, pullResult, config, status, loadStatus,
    scanFolder, selectFolder, push, pull, cancel, saveConfig,
    userFolders, loadUserFolders,
    registryEntries, registryStats, isRegistryLoading,
    loadRegistry, scanRegistryFolders, rebuildRegistry,
  } = useVirtualize();
  const locale = useAppStore((s) => s.locale);
  const activeTab = useAppStore((s) => s.activeTab);

  // Load stats + user folders on mount
  useEffect(() => {
    if (activeTab === 'virtualize') {
      loadStatus();
      loadUserFolders();
    }
  }, [activeTab, loadStatus, loadUserFolders]);

  const [subView, setSubView] = useState<'browser' | 'overview'>('browser');
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [activeQuickFolder, setActiveQuickFolder] = useState<string | null>(null);
  const [mimeFilter, setMimeFilter] = useState<MimeFilter>('all');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState<'virtualize' | 'restore' | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const doScan = useCallback((folder: string) => {
    setSelected(new Set());
    scanFolder(folder);
  }, [scanFolder]);

  // Auto-load Desktop on first render when user folders are ready
  useEffect(() => {
    if (autoLoaded || userFolders.length === 0) return;
    const desktop = userFolders.find((f) => f.name === 'desktop');
    if (desktop) {
      setFolderPath(desktop.path);
      setActiveQuickFolder('desktop');
      doScan(desktop.path);
      setAutoLoaded(true);
    }
  }, [userFolders, autoLoaded, doScan]);

  const handleQuickFolder = (name: string, path: string) => {
    setFolderPath(path);
    setActiveQuickFolder(name);
    setMimeFilter('all');
    doScan(path);
  };

  const handleSelectFolder = async () => {
    const path = await selectFolder();
    if (path) {
      setFolderPath(path);
      setActiveQuickFolder(null);
      setMimeFilter('all');
      doScan(path);
    }
  };

  const handleNavigateToDir = (dirPath: string) => {
    setFolderPath(dirPath);
    setActiveQuickFolder(null);
    setMimeFilter('all');
    doScan(dirPath);
  };

  const handleGoUp = () => {
    if (!folderPath) return;
    const parent = getParentPath(folderPath);
    if (parent) {
      handleNavigateToDir(parent);
    }
  };

  // Separate directories (always visible) and files (filterable)
  const directories = useMemo(() => items.filter((i) => i.isDirectory), [items]);
  const fileItems = useMemo(() => items.filter((i) => !i.isDirectory), [items]);

  const filteredFiles = useMemo(() => {
    if (mimeFilter === 'all') return fileItems;
    return fileItems.filter((item) => getMimeCategory(item.mime) === mimeFilter);
  }, [fileItems, mimeFilter]);

  const allDisplayItems = useMemo(() => [...directories, ...filteredFiles], [directories, filteredFiles]);

  const selectedItems = useMemo(() => {
    return filteredFiles.filter((item) => selected.has(item.path));
  }, [filteredFiles, selected]);

  const selectedOriginals = useMemo(() => selectedItems.filter((i) => !i.isVirtualized), [selectedItems]);
  const selectedVirtualized = useMemo(() => selectedItems.filter((i) => i.isVirtualized), [selectedItems]);

  const selectedTotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.size, 0);
  }, [selectedItems]);

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
      const allSelected = filteredFiles.every((item) => prev.has(item.path));
      if (allSelected) return new Set();
      return new Set(filteredFiles.map((item) => item.path));
    });
  };

  const handleVirtualize = async (paths: string[]) => {
    setShowConfirm(null);
    await push(paths);
    setSelected(new Set());
    if (folderPath) doScan(folderPath);
    loadStatus();
  };

  const handleRestore = async (paths: string[]) => {
    setShowConfirm(null);
    await pull(paths);
    setSelected(new Set());
    if (folderPath) doScan(folderPath);
    loadStatus();
  };

  const handleSwitchToOverview = useCallback(() => {
    setSubView('overview');
    loadRegistry();
  }, [loadRegistry]);

  const isBusy = isScanning || isPushing || isPulling;

  // No config yet — show setup
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
      {/* View toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setSubView('browser')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            subView === 'browser'
              ? 'bg-mg-primary/20 text-mg-primary border border-mg-primary/30'
              : 'bg-mg-border/30 text-mg-muted hover:text-mg-text border border-transparent'
          }`}
        >
          {t('virt.view.browser', locale)}
        </button>
        <button
          onClick={handleSwitchToOverview}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            subView === 'overview'
              ? 'bg-mg-primary/20 text-mg-primary border border-mg-primary/30'
              : 'bg-mg-border/30 text-mg-muted hover:text-mg-text border border-transparent'
          }`}
        >
          {t('virt.view.overview', locale)}
        </button>
      </div>

      {/* Overview (keep-alive) */}
      <div className={subView === 'overview' ? '' : 'hidden'}>
        <VirtOverview
          entries={registryEntries}
          stats={registryStats}
          isLoading={isRegistryLoading}
          locale={locale}
          onScanFolders={scanRegistryFolders}
          onRebuild={rebuildRegistry}
          onPull={(paths) => { pull(paths).then(() => loadRegistry()) }}
          onSelectFolder={selectFolder}
          isPulling={isPulling}
        />
      </div>

      {/* Browser (keep-alive) */}
      <div className={subView === 'browser' ? '' : 'hidden'}>

      {/* Virtualization stats banner */}
      {status && status.virtualizedFiles > 0 && (
        <div className="flex items-center gap-6 px-4 py-3 rounded-lg bg-mg-primary/10 border border-mg-primary/20">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-mg-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span className="text-sm font-medium text-mg-text">{t('dashboard.virtTitle', locale)}</span>
          </div>
          <div className="text-sm text-mg-muted">
            {t('dashboard.virtFiles', locale)}: <span className="text-mg-text font-medium">{status.virtualizedFiles}</span>
          </div>
          <div className="text-sm text-mg-muted">
            {t('dashboard.virtSaved', locale)}: <span className="text-green-400 font-medium">{formatBytes(status.savedBytes)}</span>
          </div>
        </div>
      )}

      {/* Quick folder bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {userFolders.map((f) => (
          <button
            key={f.name}
            onClick={() => handleQuickFolder(f.name, f.path)}
            disabled={isBusy}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
              activeQuickFolder === f.name
                ? 'bg-mg-primary/20 text-mg-primary border border-mg-primary/30'
                : 'bg-mg-border/30 text-mg-muted hover:text-mg-text hover:bg-mg-border/50 border border-transparent'
            } disabled:opacity-50`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {FOLDER_NAME_KEYS[f.name] ? t(FOLDER_NAME_KEYS[f.name], locale) : f.name}
          </button>
        ))}
        <button
          onClick={handleSelectFolder}
          disabled={isBusy}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
            folderPath && !activeQuickFolder
              ? 'bg-mg-primary/20 text-mg-primary border border-mg-primary/30'
              : 'bg-mg-border/30 text-mg-muted hover:text-mg-text hover:bg-mg-border/50 border border-transparent'
          } disabled:opacity-50`}
        >
          {t('virt.folder.other', locale)}
        </button>

        <div className="flex-1" />

        {isScanning && (
          <button
            onClick={cancel}
            className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            {t('virt.cancel', locale)}
          </button>
        )}

        {/* Settings gear */}
        <button
          onClick={() => setShowConfig((v) => !v)}
          className={`p-1.5 rounded transition-colors ${
            showConfig ? 'bg-mg-primary/20 text-mg-primary' : 'text-mg-muted hover:text-mg-text'
          }`}
          title={t('virt.config.title', locale)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Path bar with up button */}
      {folderPath && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleGoUp}
            disabled={isBusy || !getParentPath(folderPath)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-mg-border/30 text-mg-muted hover:text-mg-text hover:bg-mg-border/50 disabled:opacity-30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            {t('virt.folderUp', locale)}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-mg-card/40 border border-mg-border/30 min-w-0 flex-1">
            <svg className="w-4 h-4 text-mg-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm text-mg-text truncate" title={folderPath}>
              {folderPath}
            </span>
          </div>
        </div>
      )}

      {/* Config panel (collapsible) */}
      {showConfig && (
        <ConfigPanel config={config} onSave={saveConfig} locale={locale} />
      )}

      {/* Scanning indicator */}
      {isScanning && progress && (
        <div className="flex items-center gap-2 text-sm text-mg-muted">
          <div className="w-4 h-4 border-2 border-mg-primary border-t-transparent rounded-full animate-spin" />
          <span>{t('virt.loading', locale)} {progress.current} {t('virt.found', locale)} ({formatBytes(progress.bytesProcessed)})</span>
        </div>
      )}

      {/* Empty state: folder selected but no files */}
      {folderPath && !isScanning && items.length === 0 && (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">{t('virt.noFiles', locale)}</div>
          <div className="text-mg-muted/60 text-xs mt-1">{t('virt.noFilesHint', locale)}</div>
        </div>
      )}

      {/* Filter bar + select all (always visible when folder has files) */}
      {fileItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSelectAll}
            disabled={filteredFiles.length === 0}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              filteredFiles.length > 0 && filteredFiles.every((item) => selected.has(item.path))
                ? 'bg-mg-primary/20 text-mg-primary'
                : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
            }`}
          >
            {t('virt.selectAll', locale)}
          </button>
          <span className="text-xs text-mg-muted">
            {filteredFiles.length} {t('virt.files', locale)}
          </span>

          <div className="flex-1" />

          <div className="flex gap-1">
            {(['all', 'video', 'image', 'archive', 'document', 'other'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setMimeFilter(f); setSelected(new Set()); }}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  mimeFilter === f
                    ? 'bg-mg-primary/20 text-mg-primary'
                    : 'bg-mg-border/30 text-mg-muted hover:text-mg-text'
                }`}
              >
                {t(`virt.filter.${f}` as Parameters<typeof t>[0], locale)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File list (directories + filtered files) */}
      {allDisplayItems.length > 0 && (
        <div className="rounded-lg border border-mg-border/40 divide-y divide-mg-border/20 max-h-[420px] overflow-y-auto">
          {allDisplayItems.map((item) =>
            item.isDirectory ? (
              <DirRow
                key={item.path}
                item={item}
                isBusy={isBusy}
                onNavigate={() => handleNavigateToDir(item.path)}
              />
            ) : (
              <FileRow
                key={item.path}
                item={item}
                locale={locale}
                isSelected={selected.has(item.path)}
                isBusy={isBusy}
                onToggle={() => handleToggle(item.path)}
                onAction={() => {
                  if (item.isVirtualized) {
                    handleRestore([item.path]);
                  } else {
                    handleVirtualize([item.path]);
                  }
                }}
              />
            )
          )}
        </div>
      )}

      {/* No results for current filter */}
      {fileItems.length > 0 && filteredFiles.length === 0 && directories.length === 0 && (
        <div className="text-center py-10 text-mg-muted text-sm">
          {t('virt.noFilterResults', locale)}
        </div>
      )}

      {/* Footer: selection + batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between border-t border-mg-border/40 pt-3">
          <span className="text-sm text-mg-muted">
            {t('virt.selected', locale)}: {selected.size} ({formatBytes(selectedTotal)})
          </span>

          <div className="flex gap-2">
            {selectedOriginals.length > 0 && (
              <button
                onClick={() => setShowConfirm('virtualize')}
                disabled={isBusy}
                className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {isPushing ? t('virt.virtualizing', locale) : t('virt.batchVirtualize', locale)} ({selectedOriginals.length})
              </button>
            )}
            {selectedVirtualized.length > 0 && (
              <button
                onClick={() => setShowConfirm('restore')}
                disabled={isBusy}
                className="px-4 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                {isPulling ? t('virt.restoring', locale) : t('virt.batchRestore', locale)} ({selectedVirtualized.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {(isPushing || isPulling) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-mg-text">
            <div className="w-4 h-4 border-2 border-mg-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">{t('virt.processing', locale)}</span>
            {progress && progress.total > 0 && (
              <span className="text-mg-muted">({progress.current}/{progress.total})</span>
            )}
          </div>
          {progress && progress.total > 0 && (
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(null)}>
          <div className="bg-mg-surface border border-mg-border rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-mg-text mb-2">
              {showConfirm === 'virtualize' ? t('virt.confirm.virtualize', locale) : t('virt.confirm.restore', locale)}
            </h3>
            <p className="text-sm text-mg-muted mb-4">
              {showConfirm === 'virtualize'
                ? t('virt.confirm.virtualizeDesc', locale)
                    .replace('{count}', String(selectedOriginals.length))
                    .replace('{size}', formatBytes(selectedOriginals.reduce((s, i) => s + i.size, 0)))
                : t('virt.confirm.restoreDesc', locale)
                    .replace('{count}', String(selectedVirtualized.length))
                    .replace('{size}', formatBytes(selectedVirtualized.reduce((s, i) => s + i.size, 0)))
              }
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-1.5 text-sm rounded bg-mg-border/50 text-mg-muted hover:text-mg-text transition-colors"
              >
                {t('virt.cancel', locale)}
              </button>
              <button
                onClick={() => {
                  if (showConfirm === 'virtualize') {
                    handleVirtualize(selectedOriginals.map((i) => i.path));
                  } else {
                    handleRestore(selectedVirtualized.map((i) => i.path));
                  }
                }}
                className={`px-4 py-1.5 text-sm rounded text-white transition-colors ${
                  showConfirm === 'virtualize' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {showConfirm === 'virtualize' ? t('virt.virtualize', locale) : t('virt.restore', locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {pushResult && (
        <div className="rounded-lg border border-mg-border/40 p-4 space-y-2">
          {pushResult.pushed > 0 && (
            <div className="text-sm text-green-400">
              {t('virt.result.virtualized', locale)}: {pushResult.pushed} {t('virt.files', locale)} ({formatBytes(pushResult.freedBytes)})
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

      {pullResult && (
        <div className="rounded-lg border border-mg-border/40 p-4 space-y-2">
          {pullResult.pulled > 0 && (
            <div className="text-sm text-green-400">
              {t('virt.result.restored', locale)}: {pullResult.pulled} {t('virt.files', locale)} ({formatBytes(pullResult.restoredBytes)})
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

      </div>{/* end browser div */}
    </div>
  );
}

function DirRow({
  item,
  isBusy,
  onNavigate,
}: {
  item: VirtScanItem;
  isBusy: boolean;
  onNavigate: () => void;
}) {
  const dirName = item.path.split('\\').pop() || item.path.split('/').pop() || item.path;
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 hover:bg-mg-card/30 transition-colors cursor-pointer"
      onClick={() => !isBusy && onNavigate()}
    >
      <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
      </svg>
      <span className="text-sm text-mg-text font-medium truncate flex-1">{dirName}</span>
      <svg className="w-4 h-4 text-mg-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function FileRow({
  item,
  locale,
  isSelected,
  isBusy,
  onToggle,
  onAction,
}: {
  item: VirtScanItem;
  locale: 'en' | 'zh';
  isSelected: boolean;
  isBusy: boolean;
  onToggle: () => void;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-mg-card/30 transition-colors">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="w-4 h-4 rounded border-mg-border text-mg-primary focus:ring-mg-primary/30 bg-mg-bg flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-mg-text truncate">{item.path.split('\\').pop()}</div>
        <div className="text-xs text-mg-muted truncate" title={item.path}>{item.path}</div>
      </div>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-mg-border/30 text-mg-muted flex-shrink-0">
        {item.mime.split('/')[1]?.slice(0, 8) ?? item.mime}
      </span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
        item.isVirtualized
          ? 'bg-green-500/15 text-green-400'
          : 'bg-mg-border/30 text-mg-muted'
      }`}>
        {item.isVirtualized ? t('virt.status.virtualized', locale) : t('virt.status.original', locale)}
      </span>
      <span className="text-sm text-mg-text font-mono flex-shrink-0 w-20 text-right">{formatBytes(item.size)}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onAction(); }}
        disabled={isBusy}
        className={`text-xs px-2.5 py-1 rounded text-white transition-colors disabled:opacity-50 flex-shrink-0 ${
          item.isVirtualized
            ? 'bg-green-600 hover:bg-green-500'
            : 'bg-blue-600 hover:bg-blue-500'
        }`}
      >
        {item.isVirtualized ? t('virt.restore', locale) : t('virt.virtualize', locale)}
      </button>
    </div>
  );
}
