import { useSystemStats } from '../hooks/useSystemStats';
import { SystemGauge } from './SystemGauge';
import { MemoryChart } from './MemoryChart';

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function Dashboard() {
  const { stats, ramHistory, cpuHistory, isLoading } = useSystemStats();

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-mg-muted">
        Loading system info...
      </div>
    );
  }

  const ramPercent = (stats.usedMem / stats.totalMem) * 100;

  return (
    <div className="space-y-4">
      {/* Gauges */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card flex flex-col items-center py-6">
          <SystemGauge
            value={ramPercent}
            label="RAM Usage"
            subtitle={`${formatBytes(stats.usedMem)} / ${formatBytes(stats.totalMem)}`}
            color="text-mg-primary"
          />
        </div>
        <div className="card flex flex-col items-center py-6">
          <SystemGauge
            value={stats.cpuLoad}
            label="CPU Load"
            subtitle={`${stats.cpuLoad.toFixed(1)}%`}
            color="text-mg-primary"
          />
        </div>
      </div>

      {/* Charts */}
      <MemoryChart
        data={ramHistory}
        label="RAM History (30 min)"
        color="#3b82f6"
        unit="gb"
      />
      <MemoryChart
        data={cpuHistory}
        label="CPU History (30 min)"
        color="#f59e0b"
        unit="percent"
      />
    </div>
  );
}
