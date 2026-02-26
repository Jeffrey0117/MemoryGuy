import { Tray, Menu, nativeImage, BrowserWindow, Notification } from 'electron';
import zlib from 'zlib';
import type { SystemMonitor } from './services/system-monitor';
import type { ProcessMonitor } from './services/process-monitor';
import type { MemoryTracker } from './services/memory-tracker';
import type { LeakInfo } from '@shared/types';

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createSolidIcon(r: number, g: number, b: number, size = 16): Electron.NativeImage {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const off = y * (size * 3 + 1) + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(raw);

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  const png = Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  return nativeImage.createFromBuffer(png);
}

function ramColor(percent: number): [number, number, number] {
  if (percent < 60) return [34, 197, 94]; // green
  if (percent < 80) return [245, 158, 11]; // amber
  return [239, 68, 68]; // red
}

export class AppTray {
  private tray: Tray | null = null;
  private getMainWindow: () => BrowserWindow | null;

  constructor(
    private systemMonitor: SystemMonitor,
    private processMonitor: ProcessMonitor,
    private memoryTracker: MemoryTracker,
    getMainWindow: () => BrowserWindow | null,
  ) {
    this.getMainWindow = getMainWindow;
  }

  create(): void {
    const icon = createSolidIcon(59, 130, 246);
    this.tray = new Tray(icon);
    this.tray.setToolTip('MemoryGuy - Loading...');

    this.tray.on('double-click', () => {
      const win = this.getMainWindow();
      if (win) {
        if (win.isVisible()) {
          win.focus();
        } else {
          win.show();
        }
      }
    });

    this.updateMenu();

    // Update tray on system stats change
    this.systemMonitor.on('update', () => this.updateTray());

    // Notify on leak detection
    this.memoryTracker.on('leak-detected', (leak: LeakInfo) => {
      if (Notification.isSupported()) {
        const n = new Notification({
          title: leak.severity === 'critical' ? 'Critical Memory Leak!' : 'Memory Leak Suspect',
          body: `${leak.name} (PID ${leak.pid}) growing ${(leak.growthRate / 1024 / 1024).toFixed(1)} MB/min`,
        });
        n.show();
      }
    });
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  private updateTray(): void {
    if (!this.tray) return;

    const stats = this.systemMonitor.getStats();
    if (!stats) return;

    const ramPercent = (stats.usedMem / stats.totalMem) * 100;
    const [r, g, b] = ramColor(ramPercent);
    this.tray.setImage(createSolidIcon(r, g, b));

    const usedGB = (stats.usedMem / 1024 / 1024 / 1024).toFixed(1);
    const totalGB = (stats.totalMem / 1024 / 1024 / 1024).toFixed(1);
    this.tray.setToolTip(
      `MemoryGuy - RAM: ${ramPercent.toFixed(0)}% (${usedGB}/${totalGB} GB) | CPU: ${stats.cpuLoad.toFixed(0)}%`,
    );

    this.updateMenu();
  }

  private updateMenu(): void {
    if (!this.tray) return;

    const topProcesses = this.processMonitor
      .getProcesses()
      .slice(0, 5)
      .map((p) => ({
        label: `${p.name} — ${formatBytes(p.ram)} (${p.cpu.toFixed(1)}%)`,
        enabled: false,
      }));

    const menu = Menu.buildFromTemplate([
      { label: 'MemoryGuy', enabled: false },
      { type: 'separator' },
      { label: 'Top RAM Usage:', enabled: false },
      ...topProcesses,
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => {
          const win = this.getMainWindow();
          if (win) {
            win.show();
            win.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          const win = this.getMainWindow();
          if (win) win.destroy();
          this.destroy();
          process.exit(0);
        },
      },
    ]);

    this.tray.setContextMenu(menu);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
