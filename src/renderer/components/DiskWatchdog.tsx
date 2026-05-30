import { useState, useEffect } from 'react';
import type { DiskWatchdogSettings, DiskLevel } from '@shared/types';
import { useDiskWatchdog } from '../hooks/useDiskWatchdog';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';

const GB = 1024 * 1024 * 1024;

function fmtGb(bytes: number): string {
  return `${(bytes / GB).toFixed(1)} GB`;
}

const LEVEL_STYLE: Record<DiskLevel, { bar: string; text: string; labelKey: 'watchdog.statusOk' | 'watchdog.statusWarn' | 'watchdog.statusUrgent' | 'watchdog.statusUnknown' }> = {
  ok: { bar: 'bg-green-500', text: 'text-green-400', labelKey: 'watchdog.statusOk' },
  warn: { bar: 'bg-amber-500', text: 'text-amber-400', labelKey: 'watchdog.statusWarn' },
  urgent: { bar: 'bg-red-500', text: 'text-red-400', labelKey: 'watchdog.statusUrgent' },
  unknown: { bar: 'bg-mg-border', text: 'text-mg-muted', labelKey: 'watchdog.statusUnknown' },
};

export function DiskWatchdog() {
  const locale = useAppStore((s) => s.locale);
  const { settings, drives, save, test, refresh } = useDiskWatchdog();

  const [form, setForm] = useState<DiskWatchdogSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (!form) {
    return <div className="flex items-center justify-center h-64 text-mg-muted">{t('virt.loading', locale)}</div>;
  }

  const update = (patch: Partial<DiskWatchdogSettings>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  };

  const hasTelegram = form.telegramToken.trim().length > 0 && form.telegramChatId.trim().length > 0;

  const handleSave = async () => {
    await save(form);
    setSaved(true);
  };

  const handleTest = async () => {
    if (!hasTelegram) {
      setTestMsg({ ok: false, text: t('watchdog.needConfig', locale) });
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      // Persist current form first so the test uses the latest token/chat id
      await save(form);
      setSaved(true);
      const result = await test();
      setTestMsg(
        result.ok
          ? { ok: true, text: t('watchdog.testOk', locale) }
          : { ok: false, text: `${t('watchdog.testFail', locale)}: ${result.error ?? ''}` },
      );
    } finally {
      setTesting(false);
    }
  };

  const inputClass = 'bg-mg-bg border border-mg-border rounded px-2 py-1 text-sm text-mg-text w-full';
  const labelClass = 'block text-xs text-mg-muted mb-1';

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-mg-text mb-1">{t('watchdog.title', locale)}</h3>
        <p className="text-xs text-mg-muted">{t('watchdog.desc', locale)}</p>
      </div>

      {/* Settings */}
      <div className="card p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="accent-mg-primary"
          />
          <span className="text-sm text-mg-text">{t('watchdog.enable', locale)}</span>
        </label>

        <div>
          <label className={labelClass}>{t('watchdog.telegramToken', locale)}</label>
          <input
            type="password"
            value={form.telegramToken}
            onChange={(e) => update({ telegramToken: e.target.value })}
            placeholder="123456:ABC-DEF..."
            className={inputClass}
          />
          <p className="text-[11px] text-mg-muted mt-0.5">{t('watchdog.telegramTokenHint', locale)}</p>
        </div>

        <div>
          <label className={labelClass}>{t('watchdog.telegramChatId', locale)}</label>
          <input
            type="text"
            value={form.telegramChatId}
            onChange={(e) => update({ telegramChatId: e.target.value })}
            placeholder="123456789"
            className={inputClass}
          />
          <p className="text-[11px] text-mg-muted mt-0.5">{t('watchdog.telegramChatIdHint', locale)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t('watchdog.warnGb', locale)}</label>
            <input
              type="number"
              min={1}
              value={form.warnFreeGb}
              onChange={(e) => update({ warnFreeGb: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('watchdog.urgentGb', locale)}</label>
            <input
              type="number"
              min={1}
              value={form.urgentFreeGb}
              onChange={(e) => update({ urgentFreeGb: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('watchdog.intervalSec', locale)}</label>
            <input
              type="number"
              min={15}
              value={form.intervalSec}
              onChange={(e) => update({ intervalSec: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('watchdog.reNotifyMin', locale)}</label>
            <input
              type="number"
              min={1}
              value={form.reNotifyMin}
              onChange={(e) => update({ reNotifyMin: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm rounded bg-mg-primary text-white hover:opacity-90"
          >
            {saved ? t('watchdog.saved', locale) : t('watchdog.save', locale)}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-1.5 text-sm rounded bg-mg-border/50 text-mg-text hover:bg-mg-border disabled:opacity-50"
          >
            {testing ? t('watchdog.testing', locale) : t('watchdog.test', locale)}
          </button>
          {testMsg && (
            <span className={`text-xs ${testMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{testMsg.text}</span>
          )}
        </div>
      </div>

      {/* Live drive status */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-mg-text">{t('watchdog.drives', locale)}</h3>
          <button onClick={refresh} className="text-xs text-mg-muted hover:text-mg-text">
            {t('watchdog.refresh', locale)}
          </button>
        </div>
        {drives.length === 0 ? (
          <div className="text-center text-mg-muted text-sm py-4">{t('watchdog.noDrives', locale)}</div>
        ) : (
          <div className="space-y-2">
            {drives.map((d) => {
              const style = LEVEL_STYLE[d.level];
              const usedPct = d.totalBytes > 0 ? ((d.totalBytes - d.freeBytes) / d.totalBytes) * 100 : 0;
              return (
                <div key={d.drive} className="py-2 px-3 rounded bg-mg-bg/50">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-mg-text font-medium">{d.drive}</span>
                    <span className="text-mg-muted">
                      <span className={style.text}>{t(style.labelKey, locale)}</span>
                      {' · '}
                      {fmtGb(d.freeBytes)} {t('watchdog.free', locale)} / {fmtGb(d.totalBytes)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded bg-mg-border/40 overflow-hidden">
                    <div className={`h-full ${style.bar}`} style={{ width: `${Math.min(100, Math.max(0, usedPct))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
