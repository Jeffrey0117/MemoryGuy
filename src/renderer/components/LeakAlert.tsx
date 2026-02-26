import { useLeakDetection } from '../hooks/useLeakDetection';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function LeakAlert() {
  const { leaks, dismissLeak } = useLeakDetection();
  const locale = useAppStore((s) => s.locale);

  if (leaks.length === 0) return null;

  const criticals = leaks.filter((l) => l.severity === 'critical');
  const suspects = leaks.filter((l) => l.severity === 'suspect');

  return (
    <div className="space-y-2 mb-4">
      {criticals.map((leak) => (
        <div
          key={leak.pid}
          className="bg-red-900/30 border border-red-500/50 rounded-lg px-4 py-3 flex items-center justify-between"
        >
          <div>
            <span className="text-red-400 font-medium text-sm">
              {t('leak.critical', locale)}
            </span>
            <span className="text-mg-text text-sm ml-3">
              {leak.name} (PID {leak.pid})
            </span>
            <span className="text-red-300 text-xs ml-3">
              +{formatBytes(leak.growthRate)}/min for {leak.duration.toFixed(0)} min
            </span>
            <span className="text-mg-muted text-xs ml-3">
              {formatBytes(leak.startMem)} → {formatBytes(leak.currentMem)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => api.killProcess(leak.pid)}
              className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
            >
              {t('process.kill', locale)}
            </button>
            <button
              onClick={() => dismissLeak(leak.pid)}
              className="text-xs px-2 py-1 text-mg-muted hover:text-mg-text transition-colors"
            >
              {t('leak.dismiss', locale)}
            </button>
          </div>
        </div>
      ))}

      {suspects.map((leak) => (
        <div
          key={leak.pid}
          className="bg-amber-900/20 border border-amber-500/40 rounded-lg px-4 py-3 flex items-center justify-between"
        >
          <div>
            <span className="text-amber-400 font-medium text-sm">
              {t('leak.suspect', locale)}
            </span>
            <span className="text-mg-text text-sm ml-3">
              {leak.name} (PID {leak.pid})
            </span>
            <span className="text-amber-300 text-xs ml-3">
              +{formatBytes(leak.growthRate)}/min for {leak.duration.toFixed(0)} min
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => api.killProcess(leak.pid)}
              className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors"
            >
              {t('process.kill', locale)}
            </button>
            <button
              onClick={() => dismissLeak(leak.pid)}
              className="text-xs px-2 py-1 text-mg-muted hover:text-mg-text transition-colors"
            >
              {t('leak.dismiss', locale)}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
