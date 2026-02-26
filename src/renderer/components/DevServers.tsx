import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDevServers } from '../hooks/useDevServers';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { MemoryGuyAPI, DevServer } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function ServerCard({
  server,
  locale,
  onOpen,
}: {
  server: DevServer;
  locale: 'en' | 'zh';
  onOpen: (url: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [killing, setKilling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleKill = async () => {
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setKilling(true);
    await api.killProcess(server.pid);
    setKilling(false);
    setConfirming(false);
  };

  const handleProtect = () => {
    api.addProtectionRule({
      pattern: server.processName,
      label: `${server.processName} (port ${server.port})`,
      mode: 'protect',
      enabled: true,
    });
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-mg-primary font-mono">:{server.port}</div>
          <div className="text-sm text-mg-muted">{server.processName}</div>
          <div className="text-xs text-mg-muted">PID {server.pid}</div>
        </div>
        {server.httpStatus && (
          <span className={`text-xs px-2 py-0.5 rounded font-mono ${
            server.httpStatus >= 200 && server.httpStatus < 400
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {server.httpStatus}
          </span>
        )}
      </div>

      {/* Page title */}
      {server.pageTitle && (
        <div className="text-xs text-mg-muted truncate" title={server.pageTitle}>
          {server.pageTitle}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 text-xs text-mg-muted">
        {server.ram !== undefined && <span>RAM: {formatBytes(server.ram)}</span>}
        {server.cpu !== undefined && <span>CPU: {server.cpu.toFixed(1)}%</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onOpen(server.url)}
          className="flex-1 text-xs px-3 py-1.5 rounded bg-mg-primary text-white hover:opacity-90 transition-opacity"
        >
          {t('devservers.open', locale)}
        </button>
        <button
          onClick={handleKill}
          disabled={killing}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            confirming
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-mg-border/50 text-mg-muted hover:text-mg-text hover:bg-mg-border'
          } disabled:opacity-50`}
        >
          {killing ? '...' : confirming ? t('devservers.killConfirm', locale) : t('devservers.kill', locale)}
        </button>
        <button
          onClick={handleProtect}
          className="text-xs px-3 py-1.5 rounded bg-mg-border/50 text-mg-muted hover:text-green-400 hover:bg-mg-border transition-colors"
          title={t('devservers.addProtect', locale)}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L3 7v5c0 5.25 3.83 10.17 9 11.37C17.17 22.17 21 17.25 21 12V7l-9-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function DevServers() {
  const { servers, isLoading, isScanning, scanNow, openUrl } = useDevServers();
  const locale = useAppStore((s) => s.locale);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return servers;
    const q = search.toLowerCase();
    return servers.filter(
      (s) =>
        s.processName.toLowerCase().includes(q) ||
        String(s.port).includes(q) ||
        (s.pageTitle && s.pageTitle.toLowerCase().includes(q)),
    );
  }, [servers, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        {t('actions.loading', locale)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder={t('devservers.search', locale)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-mg-bg border border-mg-border rounded px-3 py-1.5 text-sm text-mg-text
            placeholder:text-mg-muted focus:outline-none focus:border-mg-primary"
        />
        <button
          onClick={scanNow}
          disabled={isScanning}
          className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90
            disabled:opacity-50 transition-opacity"
        >
          {isScanning ? t('devservers.scanning', locale) : t('devservers.scan', locale)}
        </button>
        <span className="text-xs text-mg-muted">
          {servers.length} server{servers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Server cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">{t('devservers.empty', locale)}</div>
          <div className="text-mg-muted/60 text-xs mt-1">{t('devservers.emptyHint', locale)}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((server) => (
            <ServerCard
              key={server.port}
              server={server}
              locale={locale}
              onOpen={openUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
