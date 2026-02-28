import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { MemoryGuyAPI, StartupItem } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

const LOCATION_LABELS = {
  hkcu: 'startup.hkcu',
  hklm: 'startup.hklm',
  folder: 'startup.folder',
} as const;

const LOCATION_COLORS = {
  hkcu: 'bg-blue-500/20 text-blue-400',
  hklm: 'bg-amber-500/20 text-amber-400',
  folder: 'bg-emerald-500/20 text-emerald-400',
} as const;

function StartupRow({
  item,
  locale,
  onToggle,
  onRemove,
}: {
  item: StartupItem;
  locale: 'en' | 'zh';
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [toggling, setToggling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleRemove = () => {
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onRemove(item.id);
  };

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(item.id);
    setToggling(false);
  };

  return (
    <tr className="border-t border-mg-border/50 hover:bg-mg-bg/50 transition-colors">
      {/* Name */}
      <td className="py-2 px-3 text-sm">
        <div className="flex items-center gap-2">
          {item.isAdmin && (
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          )}
          <span className={item.enabled ? '' : 'text-mg-muted line-through'}>{item.name}</span>
        </div>
      </td>

      {/* Command */}
      <td className="py-2 px-3 text-xs text-mg-muted max-w-[200px]">
        <span className="block truncate" title={item.command}>{item.command}</span>
      </td>

      {/* Location badge */}
      <td className="py-2 px-3">
        <span className={`text-xs px-2 py-0.5 rounded ${LOCATION_COLORS[item.location]}`}>
          {t(LOCATION_LABELS[item.location], locale)}
        </span>
      </td>

      {/* Toggle */}
      <td className="py-2 px-3 text-center">
        <button
          onClick={handleToggle}
          disabled={item.isAdmin || toggling}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            item.enabled ? 'bg-mg-primary' : 'bg-mg-border'
          } ${item.isAdmin ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          title={item.isAdmin ? t('startup.adminOnly', locale) : undefined}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              item.enabled ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
      </td>

      {/* Delete */}
      <td className="py-2 px-3 text-right">
        <button
          onClick={handleRemove}
          disabled={item.isAdmin}
          className={`text-xs px-2.5 py-1 rounded transition-colors ${
            confirming
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-mg-border/50 text-mg-muted hover:text-mg-text hover:bg-mg-border'
          } ${item.isAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
          title={item.isAdmin ? t('startup.adminOnly', locale) : undefined}
        >
          {confirming ? t('startup.removeConfirm', locale) : t('startup.remove', locale)}
        </button>
      </td>
    </tr>
  );
}

export function StartupPanel() {
  const locale = useAppStore((s) => s.locale);
  const [items, setItems] = useState<StartupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setError(null);
      const result = await api.getStartupItems();
      setItems(result ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadItems().then(() => setIsLoading(false));
  }, [loadItems]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadItems();
    setIsRefreshing(false);
  }, [loadItems]);

  const handleToggle = useCallback(async (id: string) => {
    await api.toggleStartupItem(id);
    await loadItems();
  }, [loadItems]);

  const handleRemove = useCallback(async (id: string) => {
    await api.removeStartupItem(id);
    await loadItems();
  }, [loadItems]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.command.toLowerCase().includes(q),
    );
  }, [items, search]);

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
          placeholder={t('startup.search', locale)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-mg-bg border border-mg-border rounded px-3 py-1.5 text-sm text-mg-text
            placeholder:text-mg-muted focus:outline-none focus:border-mg-primary"
        />
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90
            disabled:opacity-50 transition-opacity"
        >
          {isRefreshing ? t('startup.refreshing', locale) : t('startup.refresh', locale)}
        </button>
        <span className="text-xs text-mg-muted">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      {!error && filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">{t('startup.empty', locale)}</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-mg-muted">
                <th className="text-left py-2 px-3 font-medium">{t('startup.name', locale)}</th>
                <th className="text-left py-2 px-3 font-medium">{t('startup.command', locale)}</th>
                <th className="text-left py-2 px-3 font-medium">{t('startup.location', locale)}</th>
                <th className="text-center py-2 px-3 font-medium">{t('startup.enabled', locale)}</th>
                <th className="text-right py-2 px-3 font-medium">{t('startup.action', locale)}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <StartupRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  onToggle={handleToggle}
                  onRemove={handleRemove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
