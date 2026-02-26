import { useState } from 'react';
import { useGuardian } from '../hooks/useGuardian';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function ShieldIcon({ status }: { status: 'protect' | 'watch' | 'none' }) {
  const color = status === 'protect'
    ? 'text-green-400'
    : status === 'watch'
      ? 'text-blue-400'
      : 'text-mg-muted/40';

  return (
    <svg className={`w-4 h-4 inline-block ${color}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L3 7v5c0 5.25 3.83 10.17 9 11.37C17.17 22.17 21 17.25 21 12V7l-9-5z" />
    </svg>
  );
}

export function GuardianPanel() {
  const {
    rules,
    watchedProcesses,
    eventLog,
    isLoading,
    addRule,
    removeRule,
    updateRule,
    clearLog,
    generateHook,
  } = useGuardian();
  const locale = useAppStore((s) => s.locale);

  const [newPattern, setNewPattern] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newMode, setNewMode] = useState<'watch' | 'protect'>('watch');
  const [hookResult, setHookResult] = useState<{ success: boolean; message: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        {t('actions.loading', locale)}
      </div>
    );
  }

  const handleAddRule = async () => {
    if (!newPattern.trim() || !newLabel.trim()) return;
    await addRule({
      pattern: newPattern.trim(),
      label: newLabel.trim(),
      mode: newMode,
      enabled: true,
    });
    setNewPattern('');
    setNewLabel('');
    setNewMode('watch');
  };

  const handleGenerateHook = async () => {
    const result = await generateHook();
    if (result.success) {
      setHookResult({ success: true, message: `${t('guardian.hookSuccess', locale)}: ${result.path}` });
    } else {
      setHookResult({ success: false, message: `${t('guardian.hookFailed', locale)}: ${result.error}` });
    }
    setTimeout(() => setHookResult(null), 5000);
  };

  const customRules = rules.filter((r) => !r.builtIn);
  const builtInRules = rules.filter((r) => r.builtIn);

  return (
    <div className="space-y-6">
      {/* Protection Rules */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold text-mg-text mb-3">{t('guardian.rules', locale)}</h2>

        {/* Add rule form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder={t('guardian.pattern', locale)}
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            className="flex-1 bg-mg-bg border border-mg-border rounded px-3 py-1.5 text-sm text-mg-text
              placeholder:text-mg-muted focus:outline-none focus:border-mg-primary"
          />
          <input
            type="text"
            placeholder={t('guardian.label', locale)}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 bg-mg-bg border border-mg-border rounded px-3 py-1.5 text-sm text-mg-text
              placeholder:text-mg-muted focus:outline-none focus:border-mg-primary"
          />
          <select
            value={newMode}
            onChange={(e) => setNewMode(e.target.value as 'watch' | 'protect')}
            className="bg-mg-bg border border-mg-border rounded px-3 py-1.5 text-sm text-mg-text
              focus:outline-none focus:border-mg-primary"
          >
            <option value="watch">{t('guardian.modeWatch', locale)}</option>
            <option value="protect">{t('guardian.modeProtect', locale)}</option>
          </select>
          <button
            onClick={handleAddRule}
            disabled={!newPattern.trim() || !newLabel.trim()}
            className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {t('guardian.addRule', locale)}
          </button>
        </div>

        {/* Custom rules */}
        {customRules.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-mg-muted mb-1">{t('guardian.custom', locale)}</div>
            <table className="w-full">
              <tbody>
                {customRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-mg-border/30">
                    <td className="py-2 px-2 text-sm">
                      <ShieldIcon status={rule.enabled ? rule.mode : 'none'} />
                      <span className="ml-2 text-mg-text">{rule.label}</span>
                    </td>
                    <td className="py-2 px-2 text-sm text-mg-muted font-mono">{rule.pattern}</td>
                    <td className="py-2 px-2 text-sm">
                      <select
                        value={rule.mode}
                        onChange={(e) => updateRule(rule.id, { mode: e.target.value as 'watch' | 'protect' })}
                        className="bg-mg-bg border border-mg-border rounded px-2 py-0.5 text-xs text-mg-text"
                      >
                        <option value="watch">{t('guardian.modeWatch', locale)}</option>
                        <option value="protect">{t('guardian.modeProtect', locale)}</option>
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                          className="accent-mg-primary"
                        />
                        <span className="text-xs text-mg-muted">{t('guardian.enabled', locale)}</span>
                      </label>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="text-xs px-2 py-1 rounded bg-mg-border/50 text-mg-muted hover:text-red-400 hover:bg-mg-border transition-colors"
                      >
                        {t('guardian.remove', locale)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Built-in rules (collapsed) */}
        <details className="text-xs text-mg-muted">
          <summary className="cursor-pointer hover:text-mg-text transition-colors">
            {t('guardian.builtIn', locale)} ({builtInRules.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {builtInRules.map((rule) => (
              <span key={rule.id} className="px-2 py-0.5 bg-mg-bg rounded text-mg-muted">
                {rule.pattern}
              </span>
            ))}
          </div>
        </details>
      </section>

      {/* Watched Processes */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold text-mg-text mb-3">{t('guardian.watchedProcesses', locale)}</h2>
        {watchedProcesses.length === 0 ? (
          <p className="text-sm text-mg-muted">{t('guardian.noWatched', locale)}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {watchedProcesses.map((wp) => (
              <div key={wp.pid} className="bg-mg-bg rounded px-3 py-2 text-sm">
                <div className="text-mg-text font-mono">{wp.name}</div>
                <div className="text-xs text-mg-muted">PID {wp.pid}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Event Log */}
      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mg-text">{t('guardian.eventLog', locale)}</h2>
          {eventLog.length > 0 && (
            <button
              onClick={clearLog}
              className="text-xs px-2 py-1 rounded bg-mg-border/50 text-mg-muted hover:text-mg-text hover:bg-mg-border transition-colors"
            >
              {t('guardian.clearLog', locale)}
            </button>
          )}
        </div>
        {eventLog.length === 0 ? (
          <p className="text-sm text-mg-muted">{t('guardian.noEvents', locale)}</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {eventLog.map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-1 border-b border-mg-border/20 text-sm">
                <span className="text-xs text-mg-muted font-mono">{formatTime(event.terminatedAt)}</span>
                <span className="text-red-400">&#x25CF;</span>
                <span className="text-mg-text">{event.ruleLabel}</span>
                <span className="text-mg-muted">PID {event.pid}</span>
                <span className="text-mg-muted">{t('guardian.terminated', locale)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hook Generator */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold text-mg-text mb-2">{t('guardian.hookGenerate', locale)}</h2>
        <p className="text-xs text-mg-muted mb-3">{t('guardian.hookDesc', locale)}</p>
        <button
          onClick={handleGenerateHook}
          className="px-4 py-2 text-sm rounded bg-mg-primary text-white hover:opacity-90 transition-opacity"
        >
          {t('guardian.hookGenerate', locale)}
        </button>
        {hookResult && (
          <div className={`mt-2 text-xs ${hookResult.success ? 'text-green-400' : 'text-red-400'}`}>
            {hookResult.message}
          </div>
        )}
      </section>
    </div>
  );
}
