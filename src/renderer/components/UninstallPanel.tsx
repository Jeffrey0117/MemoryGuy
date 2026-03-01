import { useState, useEffect, useCallback, useRef } from 'react';
import type { InstalledSoftware, MemoryGuyAPI } from '@shared/types';
import { t } from '../i18n';
import type { Locale } from '../i18n';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function UninstallPanel({ locale }: { locale: Locale }) {
  const [software, setSoftware] = useState<InstalledSoftware[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [uninstalling, setUninstalling] = useState<ReadonlySet<string>>(new Set());
  const [results, setResults] = useState<ReadonlyMap<string, 'success' | 'failed'>>(new Map());

  const loadSoftware = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await api.getInstalledSoftware();
      setSoftware(items);
      setResults(new Map());
    } catch {
      // IPC failure — user can retry
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, []);

  const handleUninstall = useCallback(async (id: string) => {
    setUninstalling((prev) => new Set([...prev, id]));
    try {
      const result = await api.uninstallSoftware(id);
      setResults((prev) => new Map([...prev, [id, result.success ? 'success' : 'failed']]));
      if (result.success) {
        // Remove from list after successful uninstall
        setSoftware((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      setResults((prev) => new Map([...prev, [id, 'failed']]));
    } finally {
      setUninstalling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const filtered = software.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.publisher.toLowerCase().includes(q)
    );
  });

  return (
    <details
      className="card"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open && !hasLoaded) {
          loadSoftware();
        }
      }}
    >
      <summary className="p-4 cursor-pointer text-sm font-medium text-mg-muted hover:text-mg-text transition-colors select-none">
        {t('uninstall.title', locale)}{' '}
        {hasLoaded && !isLoading && (
          <span>
            ({software.length} {t('uninstall.count', locale)})
          </span>
        )}
      </summary>
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder={t('uninstall.search', locale)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm rounded bg-mg-bg border border-mg-border
              text-mg-text placeholder-mg-muted/50 focus:outline-none focus:border-mg-primary"
          />
          <button
            onClick={loadSoftware}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm rounded bg-mg-border/50 text-mg-muted
              hover:text-mg-text hover:bg-mg-border transition-colors disabled:opacity-50"
          >
            {isLoading ? '...' : t('uninstall.refresh', locale)}
          </button>
        </div>

        {isLoading && !hasLoaded ? (
          <div className="text-center text-mg-muted text-sm py-8">
            {t('actions.loading', locale)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-mg-muted text-sm py-8">
            {t('uninstall.empty', locale)}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-1">
            {filtered.map((sw) => (
              <SoftwareRow
                key={sw.id}
                item={sw}
                isUninstalling={uninstalling.has(sw.id)}
                result={results.get(sw.id)}
                onUninstall={handleUninstall}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function SoftwareRow({
  item,
  isUninstalling,
  result,
  onUninstall,
  locale,
}: {
  item: InstalledSoftware;
  isUninstalling: boolean;
  result?: 'success' | 'failed';
  onUninstall: (id: string) => void;
  locale: Locale;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded bg-mg-bg/50 hover:bg-mg-bg transition-colors">
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-mg-text truncate">{item.name}</span>
          {item.version && (
            <span className="text-xs text-mg-muted flex-shrink-0">{item.version}</span>
          )}
        </div>
        {item.publisher && (
          <span className="text-xs text-mg-muted/70 truncate block">{item.publisher}</span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {item.estimatedSize > 0 && (
          <span className="text-xs font-mono text-mg-muted">{formatBytes(item.estimatedSize)}</span>
        )}
        {result === 'success' ? (
          <span className="text-xs text-green-400 px-2 py-1">{t('uninstall.success', locale)}</span>
        ) : result === 'failed' ? (
          <span className="text-xs text-red-400 px-2 py-1">{t('uninstall.failed', locale)}</span>
        ) : isUninstalling ? (
          <span className="text-xs text-amber-400 px-2 py-1 animate-pulse">
            {t('uninstall.removing', locale)}
          </span>
        ) : (
          <UninstallButton
            onClick={() => onUninstall(item.id)}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}

function UninstallButton({
  onClick,
  locale,
}: {
  onClick: () => void;
  locale: Locale;
}) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`text-xs px-2 py-1 rounded transition-colors ${
        confirming
          ? 'bg-red-600 text-white hover:bg-red-500'
          : 'bg-mg-border/50 text-mg-muted hover:text-mg-text hover:bg-mg-border'
      }`}
    >
      {confirming ? t('uninstall.confirm', locale) : t('uninstall.uninstall', locale)}
    </button>
  );
}
