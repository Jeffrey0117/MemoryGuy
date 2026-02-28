import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { MemoryGuyAPI, EnvVar } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

function CopyButton({ value, locale }: { value: string; locale: 'en' | 'zh' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    await api.copyToClipboard(value);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2 py-0.5 rounded transition-colors flex-shrink-0 ${
        copied
          ? 'bg-green-500/20 text-green-400'
          : 'bg-mg-border/50 text-mg-muted hover:text-mg-text hover:bg-mg-border'
      }`}
    >
      {copied ? t('envvars.copied', locale) : t('envvars.copy', locale)}
    </button>
  );
}

function EnvVarRow({ envVar, locale }: { envVar: EnvVar; locale: 'en' | 'zh' }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = envVar.value.length > 80;

  return (
    <tr className="border-t border-mg-border/50 hover:bg-mg-bg/50 transition-colors">
      <td className="py-2 px-3 text-sm font-mono whitespace-nowrap">{envVar.name}</td>
      <td className="py-2 px-3 text-xs text-mg-muted max-w-[400px]">
        {isLong && !expanded ? (
          <span
            className="block truncate cursor-pointer hover:text-mg-text transition-colors"
            onClick={() => setExpanded(true)}
            title="Click to expand"
          >
            {envVar.value}
          </span>
        ) : (
          <span
            className={`block whitespace-pre-wrap break-all ${isLong ? 'cursor-pointer hover:text-mg-text' : ''}`}
            onClick={isLong ? () => setExpanded(false) : undefined}
          >
            {envVar.value}
          </span>
        )}
      </td>
      <td className="py-2 px-3">
        <CopyButton value={envVar.value} locale={locale} />
      </td>
    </tr>
  );
}

function EnvSection({
  title,
  vars,
  locale,
}: {
  title: string;
  vars: EnvVar[];
  locale: 'en' | 'zh';
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="card">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-mg-bg/50 transition-colors rounded-t"
      >
        <span>{title} ({vars.length})</span>
        <svg
          className={`w-4 h-4 text-mg-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {vars.map((v) => (
                <EnvVarRow key={`${v.scope}-${v.name}`} envVar={v} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function EnvVarsPanel() {
  const locale = useAppStore((s) => s.locale);
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadVars = useCallback(async () => {
    try {
      setError(null);
      const result = await api.getEnvVars();
      setVars(result ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadVars().then(() => setIsLoading(false));
  }, [loadVars]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadVars();
    setIsRefreshing(false);
  }, [loadVars]);

  const filtered = useMemo(() => {
    if (!search) return vars;
    const q = search.toLowerCase();
    return vars.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.value.toLowerCase().includes(q),
    );
  }, [vars, search]);

  const systemVars = useMemo(() => filtered.filter((v) => v.scope === 'system'), [filtered]);
  const userVars = useMemo(() => filtered.filter((v) => v.scope === 'user'), [filtered]);

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
          placeholder={t('envvars.search', locale)}
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
          {isRefreshing ? t('envvars.refreshing', locale) : t('envvars.refresh', locale)}
        </button>
        <span className="text-xs text-mg-muted">
          {vars.length} var{vars.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Sections */}
      {!error && filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">{t('envvars.empty', locale)}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {systemVars.length > 0 && (
            <EnvSection title={t('envvars.system', locale)} vars={systemVars} locale={locale} />
          )}
          {userVars.length > 0 && (
            <EnvSection title={t('envvars.user', locale)} vars={userVars} locale={locale} />
          )}
        </div>
      )}
    </div>
  );
}
