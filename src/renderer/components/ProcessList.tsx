import { useState, useEffect, useCallback } from 'react';
import { useProcessList } from '../hooks/useProcessList';
import type { SortField } from '../hooks/useProcessList';
import { ProcessRow } from './ProcessRow';
import { ProcessGroupRow } from './ProcessGroupRow';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { ProtectionRule, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
  align,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: 'asc' | 'desc';
  onSort: (f: SortField) => void;
  align?: string;
}) {
  const active = currentSort === field;
  const arrow = active ? (currentDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  return (
    <th
      className={`py-2 px-2 text-xs font-medium cursor-pointer select-none transition-colors
        ${active ? 'text-mg-text' : 'text-mg-muted hover:text-mg-text'}
        ${align ?? 'text-left'}`}
      onClick={() => onSort(field)}
    >
      {label}
      {arrow}
    </th>
  );
}

function getProtectionStatus(name: string, rules: ProtectionRule[]): 'protect' | 'watch' | 'none' {
  for (const rule of rules) {
    if (!rule.enabled || rule.pattern !== name) continue;
    if (rule.mode === 'protect') return 'protect';
    if (rule.mode === 'watch') return 'watch';
  }
  return 'none';
}

export function ProcessList() {
  const {
    processes,
    groups,
    search,
    setSearch,
    sortBy,
    sortDir,
    toggleSort,
    grouped,
    setGrouped,
    isLoading,
    handleKill,
    handleKillGroup,
  } = useProcessList();
  const locale = useAppStore((s) => s.locale);
  const [protectionRules, setProtectionRules] = useState<ProtectionRule[]>([]);

  useEffect(() => {
    api.getProtectionRules().then((r) => setProtectionRules(r ?? []));
  }, []);

  const handleToggleProtection = useCallback(async (name: string) => {
    const status = getProtectionStatus(name, protectionRules);
    if (status === 'none') {
      const rule = await api.addProtectionRule({
        pattern: name,
        label: name.replace('.exe', ''),
        mode: 'watch',
        enabled: true,
      });
      if (rule) {
        setProtectionRules((prev) => [...prev, rule]);
      }
    } else if (status === 'watch') {
      const rule = protectionRules.find((r) => r.enabled && r.pattern === name);
      if (rule && !rule.builtIn) {
        const updated = await api.updateProtectionRule(rule.id, { mode: 'protect' });
        if (updated) {
          setProtectionRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
        }
      }
    } else {
      // protect -> remove (only custom rules)
      const rule = protectionRules.find((r) => r.enabled && r.pattern === name && !r.builtIn);
      if (rule) {
        await api.removeProtectionRule(rule.id);
        setProtectionRules((prev) => prev.filter((r) => r.id !== rule.id));
      }
    }
  }, [protectionRules]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        {t('process.loading', locale)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder={t('process.search', locale)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-mg-bg border border-mg-border rounded px-3 py-1.5 text-sm text-mg-text
            placeholder:text-mg-muted focus:outline-none focus:border-mg-primary"
        />
        <label className="flex items-center gap-2 text-sm text-mg-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
            className="accent-mg-primary"
          />
          {t('process.group', locale)}
        </label>
        <span className="text-xs text-mg-muted">
          {processes.length} {t('process.count', locale)}
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-mg-bg/50 border-b border-mg-border">
            <tr>
              <SortHeader
                label={t('process.name', locale)}
                field="name"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <th className="py-2 px-2 text-xs font-medium text-mg-muted text-left w-20">
                PID
              </th>
              <SortHeader
                label={t('process.ram', locale)}
                field="ram"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={toggleSort}
                align="text-right"
              />
              <SortHeader
                label={t('process.cpu', locale)}
                field="cpu"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={toggleSort}
                align="text-right"
              />
              <th className="py-2 px-2 text-xs font-medium text-mg-muted text-center w-12">
                {t('process.trend', locale)}
              </th>
              <th className="py-2 px-2 pr-4 text-xs font-medium text-mg-muted text-right w-24">
                {t('process.action', locale)}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((g) => (
                  <ProcessGroupRow
                    key={g.name}
                    group={g}
                    onKill={handleKill}
                    onKillGroup={handleKillGroup}
                  />
                ))
              : processes.map((p) => (
                  <ProcessRow
                    key={p.pid}
                    process={p}
                    onKill={handleKill}
                    protectionStatus={getProtectionStatus(p.name, protectionRules)}
                    onToggleProtection={handleToggleProtection}
                  />
                ))}
          </tbody>
        </table>

        {processes.length === 0 && (
          <div className="text-center text-mg-muted py-8 text-sm">
            {t('process.none', locale)}
          </div>
        )}
      </div>
    </div>
  );
}
