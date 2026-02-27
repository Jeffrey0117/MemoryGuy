import { useState, useMemo, useRef, useEffect } from 'react';
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

// --- Status badges ---

function AutoRestartBadge({ locale }: { locale: 'en' | 'zh' }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400" title={t('devservers.autoRestartOn', locale)}>
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 4v6h6M23 20v-6h-6" />
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
      </svg>
      {t('devservers.autoRestart', locale)}
    </span>
  );
}

function ProtectedBadge({ locale }: { locale: 'en' | 'zh' }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400" title={t('devservers.protected', locale)}>
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L3 7v5c0 5.25 3.83 10.17 9 11.37C17.17 22.17 21 17.25 21 12V7l-9-5z" />
      </svg>
      {t('devservers.protected', locale)}
    </span>
  );
}

function CompactAutoRestartIcon({ locale }: { locale: 'en' | 'zh' }) {
  return (
    <span className="flex-shrink-0" title={t('devservers.autoRestartOn', locale)}>
      <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 4v6h6M23 20v-6h-6" />
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
      </svg>
    </span>
  );
}

function CompactProtectedIcon({ locale }: { locale: 'en' | 'zh' }) {
  return (
    <span className="flex-shrink-0" title={t('devservers.protected', locale)}>
      <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L3 7v5c0 5.25 3.83 10.17 9 11.37C17.17 22.17 21 17.25 21 12V7l-9-5z" />
      </svg>
    </span>
  );
}

// --- ServerCard (flat mode) ---

function ServerCard({
  server,
  locale,
  onOpen,
  onRefresh,
}: {
  server: DevServer;
  locale: 'en' | 'zh';
  onOpen: (url: string) => void;
  onRefresh: () => void;
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

  const handleToggleAutoRestart = async () => {
    try {
      await api.setAutoRestart(server.port, !server.autoRestartEnabled);
    } catch {
      // IPC may not be registered yet
    }
    onRefresh();
  };

  const hasProtection = server.autoRestartEnabled || server.isProtected;
  const cardBorder = hasProtection
    ? server.isProtected && server.autoRestartEnabled
      ? 'border border-green-500/40 ring-1 ring-green-500/10'
      : server.autoRestartEnabled
        ? 'border border-blue-500/40 ring-1 ring-blue-500/10'
        : 'border border-green-500/30'
    : '';

  return (
    <div className={`card p-4 flex flex-col gap-3 transition-colors ${cardBorder}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-mg-primary font-mono">:{server.port}</span>
            {server.autoRestartEnabled && <AutoRestartBadge locale={locale} />}
            {server.isProtected && <ProtectedBadge locale={locale} />}
          </div>
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
          onClick={handleToggleAutoRestart}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            server.autoRestartEnabled
              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              : 'bg-mg-border/50 text-mg-muted hover:text-blue-400 hover:bg-mg-border'
          }`}
          title={server.autoRestartEnabled ? t('devservers.autoRestartOn', locale) : t('devservers.autoRestartOff', locale)}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// --- Group data model ---

interface ServerGroup {
  readonly parent: DevServer | null;
  readonly children: DevServer[];
  readonly allServers: DevServer[];
}

const GROUP_COLORS = [
  { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
  { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-500' },
  { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  { border: 'border-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-500' },
  { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-500' },
] as const;

function buildGroups(servers: DevServer[]): ServerGroup[] {
  const pidSet = new Set(servers.map((s) => s.pid));
  const grouped = new Set<number>();
  const groups: ServerGroup[] = [];

  const ppidToServers = new Map<number, DevServer[]>();
  for (const s of servers) {
    if (s.ppid != null) {
      const existing = ppidToServers.get(s.ppid) ?? [];
      ppidToServers.set(s.ppid, [...existing, s]);
    }
  }

  for (const [ppid, children] of ppidToServers) {
    if (pidSet.has(ppid)) {
      const parent = servers.find((s) => s.pid === ppid)!;
      const actualChildren = children.filter((c) => c.pid !== ppid);
      if (actualChildren.length > 0) {
        groups.push({ parent, children: actualChildren, allServers: [parent, ...actualChildren] });
        grouped.add(parent.pid);
        for (const c of actualChildren) grouped.add(c.pid);
      }
    } else if (children.length >= 2) {
      groups.push({ parent: null, children, allServers: children });
      for (const c of children) grouped.add(c.pid);
    }
  }

  const standalone = servers.filter((s) => !grouped.has(s.pid));
  if (standalone.length > 0) {
    groups.push({ parent: null, children: standalone, allServers: standalone });
  }

  return groups;
}

// --- Compact row for grouped mode ---

function ServerRow({
  server,
  locale,
  color,
  isParent,
  onOpen,
}: {
  server: DevServer;
  locale: 'en' | 'zh';
  color?: typeof GROUP_COLORS[number];
  isParent?: boolean;
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

  const statusOk = server.httpStatus != null && server.httpStatus >= 200 && server.httpStatus < 400;

  const rowProtected = server.autoRestartEnabled || server.isProtected;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-mg-card/80 ${
      isParent ? 'font-medium' : ''
    } ${rowProtected ? 'bg-green-500/[0.03]' : ''}`}>
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        server.httpStatus == null ? 'bg-mg-muted/40'
          : statusOk ? 'bg-green-500' : 'bg-yellow-500'
      }`} />

      {/* Port */}
      <span className={`font-mono font-bold w-16 flex-shrink-0 ${color?.text ?? 'text-mg-primary'}`}>
        :{server.port}
      </span>

      {/* Compact status icons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {server.autoRestartEnabled && <CompactAutoRestartIcon locale={locale} />}
        {server.isProtected && <CompactProtectedIcon locale={locale} />}
      </div>

      {/* Process name + title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-mg-text truncate">{server.processName}</span>
        {server.pageTitle && (
          <span className="text-xs text-mg-muted truncate hidden sm:inline" title={server.pageTitle}>
            {server.pageTitle}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-3 text-xs text-mg-muted flex-shrink-0">
        {server.ram !== undefined && <span>{formatBytes(server.ram)}</span>}
        {server.cpu !== undefined && <span>{server.cpu.toFixed(1)}%</span>}
      </div>

      {/* PID */}
      <span className="text-xs text-mg-muted/60 font-mono w-14 text-right flex-shrink-0">
        {server.pid}
      </span>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onOpen(server.url)}
          className="text-xs px-2 py-1 rounded bg-mg-primary/20 text-mg-primary hover:bg-mg-primary/30 transition-colors"
        >
          {t('devservers.open', locale)}
        </button>
        <button
          onClick={handleKill}
          disabled={killing}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            confirming
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-mg-border/30 text-mg-muted hover:text-mg-text hover:bg-mg-border/60'
          } disabled:opacity-50`}
        >
          {killing ? '...' : confirming ? t('devservers.killConfirm', locale) : t('devservers.kill', locale)}
        </button>
      </div>
    </div>
  );
}

// --- Group card for grouped mode ---

function GroupCard({
  group,
  colorIndex,
  locale,
  onOpen,
  onRefresh,
}: {
  group: ServerGroup;
  colorIndex: number;
  locale: 'en' | 'zh';
  onOpen: (url: string) => void;
  onRefresh: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isRealGroup = group.parent != null || group.children.length >= 2;
  const color = isRealGroup ? GROUP_COLORS[colorIndex % GROUP_COLORS.length] : undefined;

  const allProtected = group.allServers.every((s) => s.autoRestartEnabled && s.isProtected);
  const someProtected = group.allServers.some((s) => s.autoRestartEnabled || s.isProtected);

  const label = group.parent
    ? `${group.parent.processName} :${group.parent.port}`
    : isRealGroup
      ? `${group.children[0]?.processName ?? '?'} (${group.allServers.length})`
      : t('devservers.ungrouped', locale);

  const totalRam = group.allServers.reduce((sum, s) => sum + (s.ram ?? 0), 0);

  const handleProtectGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const ports = group.allServers.map((s) => s.port);
      await api.enableGroupAutoRestart(ports);
      // Also add protection rules for each unique process name
      const seen = new Set<string>();
      for (const s of group.allServers) {
        if (!seen.has(s.processName)) {
          seen.add(s.processName);
          await api.addProtectionRule({
            pattern: s.processName,
            label: `${s.processName} (group)`,
            mode: 'protect',
            enabled: true,
          });
        }
      }
    } catch {
      // IPC may not be registered yet
    }
    onRefresh();
  };

  const protectionBorder = allProtected
    ? 'border border-green-500/30 ring-1 ring-green-500/10'
    : someProtected
      ? 'border border-green-500/20'
      : '';

  return (
    <div className={`rounded-lg overflow-hidden transition-colors ${
      protectionBorder || (color ? `border-l-2 ${color.border}` : 'border-l-2 border-mg-border/40')
    }`}>
      {/* Group header */}
      <div className={`flex items-center gap-2 px-3 py-2 transition-colors ${
        allProtected
          ? 'bg-green-500/[0.06] hover:bg-green-500/[0.1]'
          : color ? `${color.bg} hover:brightness-110` : 'bg-mg-card/40 hover:bg-mg-card/60'
      }`}>
        {/* Collapse chevron */}
        <button onClick={() => setCollapsed((c) => !c)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <svg
            className={`w-3.5 h-3.5 text-mg-muted transition-transform flex-shrink-0 ${collapsed ? '' : 'rotate-90'}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
          </svg>

          {/* Color dot */}
          {color && <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color.dot}`} />}

          {/* Label */}
          <span className={`text-sm font-medium truncate ${color?.text ?? 'text-mg-muted'}`}>
            {label}
          </span>

          {/* Count badge */}
          <span className="text-xs text-mg-muted/60 flex-shrink-0">
            {group.allServers.length} server{group.allServers.length !== 1 ? 's' : ''}
          </span>
        </button>

        {/* Protect group button / status */}
        {isRealGroup && (
          allProtected ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-500/15 text-green-400 flex-shrink-0">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L3 7v5c0 5.25 3.83 10.17 9 11.37C17.17 22.17 21 17.25 21 12V7l-9-5z" />
              </svg>
              {t('devservers.protected', locale)}
            </span>
          ) : (
            <button
              onClick={handleProtectGroup}
              className="text-xs px-2 py-1 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors flex-shrink-0"
              title={t('devservers.protectGroup', locale)}
            >
              {t('devservers.protectGroup', locale)}
            </button>
          )
        )}

        {/* Total RAM */}
        {totalRam > 0 && (
          <span className="text-xs text-mg-muted/60 flex-shrink-0">
            {formatBytes(totalRam)}
          </span>
        )}
      </div>

      {/* Members */}
      {!collapsed && (
        <div className="divide-y divide-mg-border/20">
          {group.parent && (
            <ServerRow
              server={group.parent}
              locale={locale}
              color={color}
              isParent
              onOpen={onOpen}
            />
          )}
          {group.children.map((server) => (
            <ServerRow
              key={server.port}
              server={server}
              locale={locale}
              color={color}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export function DevServers() {
  const { servers, isLoading, isScanning, scanNow, openUrl } = useDevServers();
  const locale = useAppStore((s) => s.locale);
  const [search, setSearch] = useState('');
  const [grouped, setGrouped] = useState(false);

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

  const groups = useMemo(() => buildGroups(filtered), [filtered]);

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
          onClick={() => setGrouped((g) => !g)}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            grouped
              ? 'bg-mg-primary text-white'
              : 'bg-mg-border/50 text-mg-muted hover:text-mg-text hover:bg-mg-border'
          }`}
        >
          {t('devservers.group', locale)}
        </button>
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

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-mg-muted text-sm">{t('devservers.empty', locale)}</div>
          <div className="text-mg-muted/60 text-xs mt-1">{t('devservers.emptyHint', locale)}</div>
        </div>
      ) : grouped ? (
        <div className="space-y-5">
          {groups.map((group, idx) => (
            <GroupCard
              key={group.parent ? `g-${group.parent.pid}` : `s-${group.children[0]?.ppid ?? idx}`}
              group={group}
              colorIndex={idx}
              locale={locale}
              onOpen={openUrl}
              onRefresh={scanNow}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((server) => (
            <ServerCard
              key={server.port}
              server={server}
              locale={locale}
              onOpen={openUrl}
              onRefresh={scanNow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
