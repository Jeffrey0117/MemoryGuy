import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ProcessInfo,
  OptimizeAnalysis,
  TrimResult,
  AutoProtectSettings,
  Recommendation,
  MultiProcessSummary,
  MemoryGuyAPI,
} from '@shared/types';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { Locale } from '../i18n';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function QuickActions() {
  const [analysis, setAnalysis] = useState<OptimizeAnalysis | null>(null);
  const [trimResult, setTrimResult] = useState<TrimResult | null>(null);
  const [autoProtect, setAutoProtect] = useState<AutoProtectSettings>({
    enabled: false,
    threshold: 85,
    autoTrim: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    api.getAutoProtect()
      .then((protect) => {
        setAutoProtect(protect);
      })
      .catch(() => {
        // Use defaults on failure
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleTrimAll = useCallback(async () => {
    setIsTrimming(true);
    setTrimResult(null);
    try {
      const result = await api.trimAllWorkingSets();
      setTrimResult(result);
    } catch {
      // IPC failure — button resets, user can retry
    } finally {
      setIsTrimming(false);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setTrimResult(null);
    try {
      const data = await api.analyzeOptimize();
      setAnalysis(data);
    } catch {
      // IPC failure — button resets, user can retry
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleAutoProtectToggle = async (
    field: keyof AutoProtectSettings,
    value: boolean | number,
  ) => {
    const updated = { ...autoProtect, [field]: value };
    setAutoProtect(updated);
    await api.setAutoProtect(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        {t('actions.loading', locale)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TrimPanel
        trimResult={trimResult}
        analysis={analysis}
        isTrimming={isTrimming}
        isAnalyzing={isAnalyzing}
        onTrimAll={handleTrimAll}
        onAnalyze={handleAnalyze}
        locale={locale}
      />

      {analysis && (
        <RecommendationsPanel
          recommendations={analysis.tier2.recommendations}
          multiProcessApps={analysis.tier2.multiProcessApps}
          ramPercent={analysis.currentRamPercent}
          locale={locale}
        />
      )}

      <AutoProtectPanel
        autoProtect={autoProtect}
        onToggle={handleAutoProtectToggle}
        locale={locale}
      />

      {analysis && (
        <ManualKillPanel processes={analysis.tier3.killableProcesses} locale={locale} />
      )}
    </div>
  );
}

// --- Tier 1: Safe Trim ---

function TrimPanel({
  trimResult,
  analysis,
  isTrimming,
  isAnalyzing,
  onTrimAll,
  onAnalyze,
  locale,
}: {
  trimResult: TrimResult | null;
  analysis: OptimizeAnalysis | null;
  isTrimming: boolean;
  isAnalyzing: boolean;
  onTrimAll: () => void;
  onAnalyze: () => void;
  locale: Locale;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-mg-text">{t('actions.oneClick', locale)}</h3>
          <p className="text-xs text-mg-muted mt-0.5">
            {t('actions.oneClickDesc', locale)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="px-3 py-1.5 text-sm rounded bg-mg-border/50 text-mg-muted
              hover:text-mg-text hover:bg-mg-border transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? t('actions.analyzing', locale) : t('actions.analyze', locale)}
          </button>
          <button
            onClick={onTrimAll}
            disabled={isTrimming}
            className="px-4 py-1.5 text-sm rounded bg-green-600 text-white
              hover:bg-green-500 transition-colors disabled:opacity-50"
          >
            {isTrimming ? t('actions.trimming', locale) : t('actions.optimizeNow', locale)}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="text-xs text-mg-muted mb-2">
          {t('actions.ramStatus', locale)}: {analysis.currentRamPercent.toFixed(0)}% | {t('actions.estimatedReclaimable', locale)}:{' '}
          <span className="text-green-400">
            {formatBytes(analysis.tier1.estimatedSavings)}
          </span>{' '}
          {t('actions.across', locale)} {analysis.tier1.trimTargets.length} {t('actions.processes', locale)}
        </div>
      )}

      {trimResult && <TrimResultBanner result={trimResult} locale={locale} />}
    </div>
  );
}

function TrimResultBanner({ result, locale }: { result: TrimResult; locale: Locale }) {
  const reclaimed = result.ramBefore - result.ramAfter;
  return (
    <div className="space-y-1">
      <div className="py-3 px-4 rounded bg-green-900/20 border border-green-500/30">
        <span className="text-green-400 text-sm font-medium">{t('actions.done', locale)} </span>
        <span className="text-mg-text text-sm">
          {t('actions.trimmed', locale)} {result.trimmed.length} {t('actions.processes', locale)}, {t('actions.reclaimed', locale)}{' '}
          <span className="text-green-400 font-mono">
            {reclaimed > 0 ? formatBytes(reclaimed) : '~0 MB'}
          </span>
        </span>
      </div>
      {result.failed.length > 0 && (
        <div className="text-xs text-amber-400 px-4">
          {result.failed.length} {t('actions.trimFailed', locale)}
        </div>
      )}
    </div>
  );
}

// --- Tier 2: Recommendations ---

function RecommendationsPanel({
  recommendations,
  multiProcessApps,
  ramPercent,
  locale,
}: {
  recommendations: readonly Recommendation[];
  multiProcessApps: readonly MultiProcessSummary[];
  ramPercent: number;
  locale: Locale;
}) {
  if (recommendations.length === 0 && multiProcessApps.length === 0) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-medium text-mg-text mb-3">{t('rec.title', locale)}</h3>
        <div className="text-center text-mg-muted text-sm py-4">
          {t('rec.healthy', locale)} ({ramPercent.toFixed(0)}% RAM)
        </div>
      </div>
    );
  }

  const REASON_LABEL: Record<string, string> = {
    'leak-critical': t('rec.leak', locale),
    'leak-suspect': t('rec.suspect', locale),
    'idle-high-ram': t('rec.idle', locale),
  };

  const REASON_COLOR: Record<string, string> = {
    'leak-critical': 'bg-red-600/30 text-red-400',
    'leak-suspect': 'bg-amber-600/30 text-amber-400',
    'idle-high-ram': 'bg-blue-600/30 text-blue-400',
  };

  const leaks = recommendations.filter(
    (r) => r.reason === 'leak-critical' || r.reason === 'leak-suspect',
  );
  const idleHigh = recommendations.filter((r) => r.reason === 'idle-high-ram');

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-mg-text mb-3">{t('rec.title', locale)}</h3>
      <div className="space-y-1">
        {[...leaks, ...idleHigh].map((rec) => (
          <div key={rec.pid} className="flex items-center justify-between py-2 px-3 rounded bg-mg-bg/50">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-1.5 py-0.5 rounded ${REASON_COLOR[rec.reason]}`}>
                {REASON_LABEL[rec.reason]}
              </span>
              <span className="text-sm text-mg-text">{rec.name}</span>
              <span className="text-xs text-mg-muted">{rec.description}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-mg-text">{formatBytes(rec.ram)}</span>
              {rec.riskLevel === 'high' && (
                <span className="text-xs text-amber-400">{t('rec.multiProcess', locale)}</span>
              )}
              <KillButton
                onClick={() => api.killProcess(rec.pid)}
                label={t('rec.end', locale)}
                confirmLabel={
                  rec.riskLevel === 'high'
                    ? `Close ${rec.name}?`
                    : t('rec.endProcess', locale)
                }
              />
            </div>
          </div>
        ))}
      </div>

      {multiProcessApps.length > 0 && (
        <>
          <h4 className="text-xs font-medium text-mg-muted mt-4 mb-2">
            {t('rec.multiProcessApps', locale)}
          </h4>
          <div className="space-y-1">
            {multiProcessApps.map((app) => (
              <div
                key={app.name}
                className="flex items-center justify-between py-2 px-3 rounded bg-mg-bg/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-mg-text">{app.name}</span>
                  <span className="text-xs text-mg-muted">
                    {app.processCount} {t('actions.processes', locale)}
                  </span>
                </div>
                <span className="text-sm font-mono text-mg-text">
                  {formatBytes(app.totalRam)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Auto-Protect ---

function AutoProtectPanel({
  autoProtect,
  onToggle,
  locale,
}: {
  autoProtect: AutoProtectSettings;
  onToggle: (field: keyof AutoProtectSettings, value: boolean | number) => void;
  locale: Locale;
}) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-mg-text mb-3">{t('protect.title', locale)}</h3>
      <div className="space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-mg-muted">{t('protect.enable', locale)}</span>
          <input
            type="checkbox"
            checked={autoProtect.enabled}
            onChange={(e) => onToggle('enabled', e.target.checked)}
            className="accent-mg-primary w-4 h-4"
          />
        </label>

        {autoProtect.enabled && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-mg-muted">{t('protect.ramThreshold', locale)}</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={50}
                  max={95}
                  step={5}
                  value={autoProtect.threshold}
                  onChange={(e) => onToggle('threshold', Number(e.target.value))}
                  className="w-24 accent-mg-primary"
                />
                <span className="text-sm text-mg-text font-mono w-10 text-right">
                  {autoProtect.threshold}%
                </span>
              </div>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm text-mg-muted">{t('protect.autoTrim', locale)}</span>
                <p className="text-xs text-mg-muted/60 mt-0.5">
                  {t('protect.autoTrimDesc', locale)}
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoProtect.autoTrim}
                onChange={(e) => onToggle('autoTrim', e.target.checked)}
                className="accent-mg-primary w-4 h-4"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

// --- Tier 3: Manual Kill (collapsed by default) ---

function ManualKillPanel({
  processes,
  locale,
}: {
  processes: readonly ProcessInfo[];
  locale: Locale;
}) {
  const [search, setSearch] = useState('');

  const filtered = processes.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || String(p.pid).includes(q);
  });

  return (
    <details className="card">
      <summary className="p-4 cursor-pointer text-sm font-medium text-mg-muted hover:text-mg-text transition-colors select-none">
        {t('manual.title', locale)} ({processes.length} {t('actions.processes', locale)})
      </summary>
      <div className="px-4 pb-4">
        <p className="text-xs text-amber-400 mb-3">
          {t('manual.warning', locale)}
        </p>

        <input
          type="text"
          placeholder={t('process.search', locale)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-3 px-3 py-1.5 text-sm rounded bg-mg-bg border border-mg-border
            text-mg-text placeholder-mg-muted/50 focus:outline-none focus:border-mg-primary"
        />

        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.slice(0, 50).map((proc) => (
            <div
              key={proc.pid}
              className="flex items-center justify-between py-1.5 px-3 rounded bg-mg-bg/50
                hover:bg-mg-bg transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-mg-text">{proc.name}</span>
                <span className="text-xs text-mg-muted">PID {proc.pid}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-mg-muted">
                  {formatBytes(proc.ram)}
                </span>
                <KillButton
                  onClick={() => api.killProcess(proc.pid)}
                  label={t('process.kill', locale)}
                  confirmLabel={t('process.sure', locale)}
                />
              </div>
            </div>
          ))}
          {filtered.length > 50 && (
            <div className="text-xs text-mg-muted text-center py-2">
              {t('manual.showingOf', locale)} {filtered.length} {t('manual.useSearch', locale)}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

// --- Shared: Kill button with confirmation ---

function KillButton({
  onClick,
  label = 'Kill',
  confirmLabel = 'Sure?',
}: {
  onClick: () => void;
  label?: string;
  confirmLabel?: string;
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
      {confirming ? confirmLabel : label}
    </button>
  );
}
