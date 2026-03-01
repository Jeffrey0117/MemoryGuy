import si from 'systeminformation';
import type { SystemMonitor } from './system-monitor';
import type { HardwareSpecs, HardwareScore, HardwareAdvice, HardwareHealth } from '@shared/types';

// --- Interpolation helper ---

function interpolate(value: number, breaks: readonly number[], scores: readonly number[]): number {
  if (value <= breaks[0]) return scores[0];
  if (value >= breaks[breaks.length - 1]) return scores[scores.length - 1];
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value <= breaks[i + 1]) {
      const ratio = (value - breaks[i]) / (breaks[i + 1] - breaks[i]);
      return Math.round(scores[i] + ratio * (scores[i + 1] - scores[i]));
    }
  }
  return scores[scores.length - 1];
}

// --- PR scoring reference tables ---

function scoreCpu(physicalCores: number, speedMax: number): number {
  const metric = physicalCores * speedMax;
  return interpolate(metric, [4, 8, 16, 32, 48, 64], [10, 20, 35, 55, 75, 90]);
}

function scoreRam(totalBytes: number): number {
  const gb = totalBytes / (1024 * 1024 * 1024);
  return interpolate(gb, [4, 8, 16, 32, 64, 128], [10, 20, 45, 70, 88, 97]);
}

function scoreDisk(hasSystemSsd: boolean, hasNvme: boolean): number {
  if (hasNvme) return 80;
  if (hasSystemSsd) return 55;
  return 10;
}

function scoreGpu(vramMb: number): number {
  return interpolate(vramMb, [0, 2048, 4096, 8192, 12288, 16384], [15, 25, 40, 65, 80, 92]);
}

function classifyDiskType(type: string, name: string, interfaceType: string): string {
  const combined = `${type} ${name} ${interfaceType}`.toLowerCase();
  if (combined.includes('nvme') || combined.includes('pcie')) return 'NVMe';
  if (combined.includes('ssd')) return 'SSD';
  return 'HDD';
}

// Virtual/indirect display adapters to skip when finding the real GPU
const VIRTUAL_GPU_PATTERNS = [
  'indirect display',
  'idd device',
  'basic display',
  'basic render',
  'remote desktop',
  'virtual',
  'parsec',
  'spacedesk',
];

function isVirtualGpu(model: string, vendor: string): boolean {
  const combined = `${model} ${vendor}`.toLowerCase();
  return VIRTUAL_GPU_PATTERNS.some((p) => combined.includes(p));
}

// LPDDR types are soldered — no physical slots
function isSolderedRam(type: string): boolean {
  return type.toLowerCase().startsWith('lpddr');
}

// --- Advice generation ---

function generateAdvice(
  specs: HardwareSpecs,
  avgRamPercent: number,
  avgCpuPercent: number,
): readonly HardwareAdvice[] {
  const advice: HardwareAdvice[] = [];
  const ramGb = Math.round(specs.ram.totalBytes / (1024 * 1024 * 1024));
  const freeSlots = specs.ram.slots - specs.ram.usedSlots;

  // RAM bottleneck
  const isSoldered = specs.ram.slots === 0;
  if (avgRamPercent > 80 && !isSoldered && freeSlots > 0) {
    advice.push({
      key: 'hw.advice.ramSlotFree',
      severity: 'bottleneck',
      params: { free: String(freeSlots) },
    });
  } else if (avgRamPercent > 80 && !isSoldered && freeSlots <= 0) {
    advice.push({
      key: 'hw.advice.ramSlotFull',
      severity: 'bottleneck',
      params: {},
    });
  } else if (avgRamPercent > 80 && isSoldered) {
    advice.push({
      key: 'hw.advice.ramSoldered',
      severity: 'bottleneck',
      params: {},
    });
  }

  // System disk is HDD
  if (!specs.disk.hasSystemSsd) {
    advice.push({
      key: 'hw.advice.hddSystem',
      severity: 'bottleneck',
      params: {},
    });
  }

  // CPU bottleneck
  if (avgCpuPercent > 70 && specs.cpu.physicalCores <= 4) {
    advice.push({
      key: 'hw.advice.cpuWeak',
      severity: 'bottleneck',
      params: { cores: String(specs.cpu.physicalCores) },
    });
  }

  // SATA SSD upgrade suggestion
  const hasSataSsd = specs.disk.devices.some((d) => d.type === 'SSD');
  const hasNvme = specs.disk.devices.some((d) => d.type === 'NVMe');
  if (hasSataSsd && !hasNvme) {
    advice.push({
      key: 'hw.advice.nvmeUpgrade',
      severity: 'suggest',
      params: {},
    });
  }

  // Low RAM suggestion
  if (ramGb < 16) {
    advice.push({
      key: 'hw.advice.ramLow',
      severity: 'suggest',
      params: { gb: String(ramGb) },
    });
  }

  // Integrated GPU with low RAM
  const gpuLower = specs.gpu.model.toLowerCase();
  const isIntegrated = specs.gpu.vram <= 512 ||
    gpuLower.includes('integrated') ||
    (gpuLower.includes('intel') && !gpuLower.includes('arc'));
  if (isIntegrated && ramGb < 16) {
    advice.push({
      key: 'hw.advice.gpuIntegrated',
      severity: 'suggest',
      params: {},
    });
  }

  // All good
  if (advice.length === 0) {
    advice.push({
      key: 'hw.advice.allGood',
      severity: 'info',
      params: {},
    });
  }

  return advice;
}

// --- Main service ---

export class HardwareProfiler {
  private specsCache: HardwareSpecs | null = null;

  constructor(private readonly systemMonitor: SystemMonitor) {}

  async getHealth(): Promise<HardwareHealth> {
    const specs = await this.getSpecs();
    const { avgRamPercent, avgCpuPercent } = this.getRecentAverages();
    const score = this.computeScore(specs);
    const advice = generateAdvice(specs, avgRamPercent, avgCpuPercent);
    return { specs, score, advice };
  }

  private async getSpecs(): Promise<HardwareSpecs> {
    if (this.specsCache) return this.specsCache;

    const [cpu, memLayout, diskLayout, graphics, mem] = await Promise.all([
      si.cpu(),
      si.memLayout(),
      si.diskLayout(),
      si.graphics(),
      si.mem(),
    ]);

    const ramType = memLayout[0]?.type || 'Unknown';
    const ramSpeed = memLayout[0]?.clockSpeed || 0;
    const soldered = isSolderedRam(ramType);
    // For soldered RAM (LPDDR*), report 0 slots — there's nothing to upgrade
    const usedSlots = soldered ? 0 : memLayout.filter((m) => m.size > 0).length;
    const totalSlots = soldered ? 0 : (memLayout.length > 0 ? memLayout.length : usedSlots);

    const diskDevices = diskLayout.map((d) => {
      const iface = 'interfaceType' in d ? String(d.interfaceType) : '';
      const dtype = classifyDiskType(d.type, d.name, iface);
      return { name: d.name, type: dtype, size: d.size };
    });
    const hasSystemSsd = diskDevices.length > 0 &&
      (diskDevices[0].type === 'SSD' || diskDevices[0].type === 'NVMe');

    // Skip virtual display adapters (MS Idd Device, Basic Display, etc.)
    const realGpu = graphics.controllers.find((c) => !isVirtualGpu(c.model, c.vendor))
      ?? graphics.controllers[0];
    const gpuModel = realGpu?.model || 'Unknown';
    const gpuVram = realGpu?.vram || 0;
    const gpuVendor = realGpu?.vendor || 'Unknown';

    this.specsCache = {
      cpu: {
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        speedMax: cpu.speedMax || cpu.speed,
      },
      ram: {
        totalBytes: mem.total,
        slots: totalSlots,
        usedSlots,
        type: ramType,
        speed: ramSpeed,
      },
      disk: {
        devices: diskDevices,
        hasSystemSsd,
      },
      gpu: {
        model: gpuModel,
        vram: gpuVram,
        vendor: gpuVendor,
      },
    };

    return this.specsCache;
  }

  private computeScore(specs: HardwareSpecs): HardwareScore {
    const hasNvme = specs.disk.devices.some((d) => d.type === 'NVMe');
    const cpuScore = scoreCpu(specs.cpu.physicalCores, specs.cpu.speedMax);
    const ramScore = scoreRam(specs.ram.totalBytes);
    const diskScore = scoreDisk(specs.disk.hasSystemSsd, hasNvme);
    const gpuScore = scoreGpu(specs.gpu.vram);
    const overall = Math.round(
      cpuScore * 0.30 + ramScore * 0.30 + diskScore * 0.25 + gpuScore * 0.15,
    );
    return { overall, cpu: cpuScore, ram: ramScore, disk: diskScore, gpu: gpuScore };
  }

  private getRecentAverages(): { avgRamPercent: number; avgCpuPercent: number } {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;

    const ramHistory = this.systemMonitor.getRamHistory();
    const cpuHistory = this.systemMonitor.getCpuHistory();
    const stats = this.systemMonitor.getStats();

    const recentRam = ramHistory.filter((s) => s.timestamp >= fiveMinAgo);
    const recentCpu = cpuHistory.filter((s) => s.timestamp >= fiveMinAgo);

    let avgRamPercent = 50;
    if (recentRam.length > 0 && stats && stats.totalMem > 0) {
      const avgRamBytes = recentRam.reduce((sum, s) => sum + s.value, 0) / recentRam.length;
      avgRamPercent = (avgRamBytes / stats.totalMem) * 100;
    } else if (stats && stats.totalMem > 0) {
      avgRamPercent = (stats.usedMem / stats.totalMem) * 100;
    }

    let avgCpuPercent = 30;
    if (recentCpu.length > 0) {
      avgCpuPercent = recentCpu.reduce((sum, s) => sum + s.value, 0) / recentCpu.length;
    } else if (stats) {
      avgCpuPercent = stats.cpuLoad;
    }

    return { avgRamPercent, avgCpuPercent };
  }
}
