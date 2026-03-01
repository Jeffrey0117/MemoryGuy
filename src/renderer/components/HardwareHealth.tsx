import { useEffect } from 'react';
import { useHardwareHealth } from '../hooks/useHardwareHealth';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { HardwareAdvice, HardwareScore, HardwareSpecs } from '@shared/types';

// --- Helpers ---

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1000) return `${(gb / 1024).toFixed(1)} TB`;
  return `${Math.round(gb)} GB`;
}

function prColor(pr: number): string {
  if (pr >= 75) return 'var(--mg-success)';
  if (pr >= 45) return 'var(--mg-primary)';
  if (pr >= 25) return 'var(--mg-warning)';
  return 'var(--mg-danger)';
}

function prLabel(pr: number, locale: string): string {
  if (locale === 'zh') {
    if (pr >= 85) return '頂級';
    if (pr >= 70) return '中上';
    if (pr >= 45) return '中等';
    if (pr >= 25) return '偏低';
    return '不足';
  }
  if (pr >= 85) return 'Excellent';
  if (pr >= 70) return 'Good';
  if (pr >= 45) return 'Average';
  if (pr >= 25) return 'Below Avg';
  return 'Low';
}

function severityIcon(severity: HardwareAdvice['severity']): { icon: string; color: string } {
  switch (severity) {
    case 'bottleneck': return { icon: '!', color: 'var(--mg-danger)' };
    case 'suggest': return { icon: '?', color: 'var(--mg-warning)' };
    case 'info': return { icon: 'i', color: 'var(--mg-success)' };
  }
}

function interpolateAdvice(text: string, params: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}

// --- Sub-components ---

function OverallScore({ score, locale }: { score: HardwareScore; locale: string }) {
  const color = prColor(score.overall);
  const label = prLabel(score.overall, locale);
  const radius = 52;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.overall / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle
          cx="65" cy="65" r={radius}
          fill="none"
          stroke="var(--mg-border)"
          strokeWidth={stroke}
        />
        <circle
          cx="65" cy="65" r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 65 65)"
          className="transition-all duration-700"
        />
        <text
          x="65" y="60"
          textAnchor="middle"
          className="text-2xl font-bold"
          style={{ fill: color }}
        >
          {score.overall}
        </text>
        <text
          x="65" y="78"
          textAnchor="middle"
          className="text-xs"
          style={{ fill: 'var(--mg-muted)' }}
        >
          {label}
        </text>
      </svg>
      <span className="text-sm font-medium text-mg-text mt-1">
        {t('hw.score.overall', locale as 'en' | 'zh')}
      </span>
    </div>
  );
}

function ScoreBar({ label, pr, specLine }: { label: string; pr: number; specLine: string }) {
  const color = prColor(pr);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-mg-muted w-12 text-right shrink-0">{label}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--mg-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pr}%`, background: color }}
            />
          </div>
          <span className="text-xs font-mono shrink-0" style={{ color, minWidth: '2rem', textAlign: 'right' }}>
            {pr}
          </span>
        </div>
        <span className="text-[11px] text-mg-muted truncate block">{specLine}</span>
      </div>
    </div>
  );
}

function buildCpuLine(specs: HardwareSpecs): string {
  const ghz = specs.cpu.speedMax > 0 ? specs.cpu.speedMax : specs.cpu.speed;
  return `${specs.cpu.brand} · ${specs.cpu.physicalCores}C/${specs.cpu.cores}T · ${ghz.toFixed(1)} GHz`;
}

function buildRamLine(specs: HardwareSpecs): string {
  const gb = Math.round(specs.ram.totalBytes / (1024 * 1024 * 1024));
  const typeStr = specs.ram.type !== 'Unknown' ? ` ${specs.ram.type}` : '';
  const speedStr = specs.ram.speed > 0 ? `-${specs.ram.speed}` : '';
  const slotStr = specs.ram.slots > 0
    ? ` · ${specs.ram.usedSlots}/${specs.ram.slots} slots`
    : ' · soldered';
  return `${gb} GB${typeStr}${speedStr}${slotStr}`;
}

function buildDiskLine(specs: HardwareSpecs): string {
  if (specs.disk.devices.length === 0) return 'Unknown';
  return specs.disk.devices
    .slice(0, 3)
    .map((d) => `${d.type} ${formatBytes(d.size)}`)
    .join(' + ');
}

function buildGpuLine(specs: HardwareSpecs): string {
  if (!specs.gpu.model || specs.gpu.model === 'Unknown') return 'Unknown';
  const vram = specs.gpu.vram > 0 ? ` · ${specs.gpu.vram >= 1024 ? `${(specs.gpu.vram / 1024).toFixed(0)} GB` : `${specs.gpu.vram} MB`}` : '';
  return `${specs.gpu.model}${vram}`;
}

function AdviceList({ advice, locale }: { advice: readonly HardwareAdvice[]; locale: string }) {
  return (
    <div className="space-y-1.5">
      {advice.map((item, i) => {
        const { icon, color } = severityIcon(item.severity);
        const text = t(item.key as Parameters<typeof t>[0], locale as 'en' | 'zh');
        const rendered = interpolateAdvice(text, item.params);
        return (
          <div key={item.key} className="flex items-start gap-2 text-sm">
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
              style={{ background: color, color: '#fff' }}
            >
              {icon}
            </span>
            <span className="text-mg-text">{rendered}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Main component ---

export function HardwareHealth() {
  const { health, isLoading, error, load } = useHardwareHealth();
  const locale = useAppStore((s) => s.locale);

  // Auto-load on mount — specs are static, no reason to wait for user click
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-mg-text">
          {t('hw.title', locale)}
        </h3>
        {health && (
          <button
            onClick={load}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium rounded-md transition-colors bg-mg-primary/20 text-mg-primary hover:bg-mg-primary/30 disabled:opacity-50"
          >
            {isLoading ? t('hw.loading', locale) : t('hw.check', locale)}
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-mg-danger text-center py-6">
          {error}
        </div>
      )}

      {isLoading && !health && (
        <div className="text-sm text-mg-muted text-center py-6 animate-pulse">
          {t('hw.loading', locale)}
        </div>
      )}

      {health && (
        <div className="space-y-4">
          {/* Top row: overall ring + score bars */}
          <div className="flex gap-4">
            <OverallScore score={health.score} locale={locale} />
            <div className="flex-1 space-y-2 min-w-0 py-1">
              <ScoreBar
                label={t('hw.score.cpu', locale)}
                pr={health.score.cpu}
                specLine={buildCpuLine(health.specs)}
              />
              <ScoreBar
                label={t('hw.score.ram', locale)}
                pr={health.score.ram}
                specLine={buildRamLine(health.specs)}
              />
              <ScoreBar
                label={t('hw.score.disk', locale)}
                pr={health.score.disk}
                specLine={buildDiskLine(health.specs)}
              />
              <ScoreBar
                label={t('hw.score.gpu', locale)}
                pr={health.score.gpu}
                specLine={buildGpuLine(health.specs)}
              />
            </div>
          </div>

          {/* Advice */}
          <div className="border-t border-mg-border pt-3">
            <AdviceList advice={health.advice} locale={locale} />
          </div>
        </div>
      )}
    </div>
  );
}
