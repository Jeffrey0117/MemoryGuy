import { useSystemStats } from '../hooks/useSystemStats';
import { SystemGauge } from './SystemGauge';
import { MemoryChart } from './MemoryChart';
import { HardwareHealth } from './HardwareHealth';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function Dashboard() {
  const { stats, ramHistory, cpuHistory, isLoading } = useSystemStats();
  const locale = useAppStore((s) => s.locale);

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        {t('dashboard.loading', locale)}
      </div>
    );
  }

  const ramPercent = (stats.usedMem / stats.totalMem) * 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="card flex flex-col items-center py-6">
          <SystemGauge
            value={ramPercent}
            label={t('dashboard.ramUsage', locale)}
            subtitle={`${formatBytes(stats.usedMem)} / ${formatBytes(stats.totalMem)}`}
            color="text-mg-primary"
          />
        </div>
        <div className="card flex flex-col items-center py-6">
          <SystemGauge
            value={stats.cpuLoad}
            label={t('dashboard.cpuLoad', locale)}
            subtitle={`${stats.cpuLoad.toFixed(1)}%`}
            color="text-mg-primary"
          />
        </div>
      </div>

      <MemoryChart
        data={ramHistory}
        label={t('dashboard.ramHistory', locale)}
        color="#3b82f6"
        unit="gb"
      />
      <MemoryChart
        data={cpuHistory}
        label={t('dashboard.cpuHistory', locale)}
        color="#f59e0b"
        unit="percent"
      />

      <HardwareHealth />
    </div>
  );
}
