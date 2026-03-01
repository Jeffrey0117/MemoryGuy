import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { app, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import type { PortScanner } from './port-scanner';
import type { ProtectionStore } from './protection-store';
import type { DevServer } from '@shared/types';
import { DEV_PORT_RANGE_MIN, DEV_PORT_RANGE_MAX, PORT_SCAN_MS } from '@shared/constants';
import { getPlatform, DEV_PROCESS_NAMES } from './platform';

interface AutoRestartConfig {
  readonly port: number;
  readonly processName: string;
  readonly commandLine: string;
  readonly enabled: boolean;
}

const MAX_BATCH_SIZE = 50;

function isValidDevPort(port: number): boolean {
  return Number.isInteger(port) && port >= DEV_PORT_RANGE_MIN && port <= DEV_PORT_RANGE_MAX;
}

/** Validate that the command line starts with a known dev process executable. */
function isValidDevCommand(commandLine: string): boolean {
  if (!commandLine) return false;
  // Extract the executable from the command line (may be quoted)
  const match = commandLine.match(/^"?([^"\s]+)"?/);
  if (!match) return false;
  const exe = path.basename(match[1]).toLowerCase();
  return DEV_PROCESS_NAMES.has(exe);
}

function inferCwd(commandLine: string): string {
  return getPlatform().pathUtils.inferCwd(commandLine);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DevServerManager extends EventEmitter {
  private configs = new Map<number, AutoRestartConfig>();
  private previousPorts = new Set<number>();
  private readonly configPath: string;
  private handler: ((servers: DevServer[]) => void) | null = null;
  private restartingPorts = new Set<number>();

  constructor(
    private portScanner: PortScanner,
    private protectionStore: ProtectionStore,
  ) {
    super();
    this.configPath = path.join(app.getPath('userData'), 'auto-restart.json');
  }

  start(): void {
    this.loadConfig();
    this.handler = (servers: DevServer[]) => this.handleServersUpdate(servers);
    this.portScanner.on('dev-servers-update', this.handler);
  }

  stop(): void {
    if (this.handler) {
      this.portScanner.removeListener('dev-servers-update', this.handler);
      this.handler = null;
    }
  }

  setAutoRestart(port: number, enabled: boolean): void {
    if (!isValidDevPort(port)) return;

    if (enabled) {
      const existing = this.configs.get(port);
      // Eagerly populate from current scan data if available
      const currentServer = this.portScanner.getDevServers().find((s) => s.port === port);
      const config: AutoRestartConfig = {
        port,
        processName: currentServer?.processName ?? existing?.processName ?? '',
        commandLine: currentServer?.commandLine ?? existing?.commandLine ?? '',
        enabled: true,
      };
      const next = new Map(this.configs);
      next.set(port, config);
      this.configs = next;
    } else {
      const next = new Map(this.configs);
      next.delete(port);
      this.configs = next;
    }
    this.saveConfig();
  }

  getAutoRestart(port: number): boolean {
    return this.configs.get(port)?.enabled === true;
  }

  getAutoRestartPorts(): number[] {
    const ports: number[] = [];
    for (const [port, config] of this.configs) {
      if (config.enabled) ports.push(port);
    }
    return ports;
  }

  enableBatch(ports: number[]): void {
    const validPorts = ports.filter(isValidDevPort).slice(0, MAX_BATCH_SIZE);
    if (validPorts.length === 0) return;

    const currentServers = this.portScanner.getDevServers();
    const serverByPort = new Map(currentServers.map((s) => [s.port, s]));

    const next = new Map(this.configs);
    for (const port of validPorts) {
      const existing = next.get(port);
      const server = serverByPort.get(port);
      next.set(port, {
        port,
        processName: server?.processName ?? existing?.processName ?? '',
        commandLine: server?.commandLine ?? existing?.commandLine ?? '',
        enabled: true,
      });
    }
    this.configs = next;
    this.saveConfig();
  }

  isProtected(processName: string): boolean {
    return this.protectionStore.isProtected(processName);
  }

  private handleServersUpdate(servers: DevServer[]): void {
    const currentPorts = new Set(servers.map((s) => s.port));

    // Detect disappeared servers that have auto-restart enabled
    for (const [port, config] of this.configs) {
      if (config.enabled && config.commandLine && !currentPorts.has(port) && this.previousPorts.has(port) && !this.restartingPorts.has(port)) {
        this.attemptRestart(config);
      }
    }

    // Update commandLine + processName for known servers
    let changed = false;
    const next = new Map(this.configs);
    for (const s of servers) {
      const existing = next.get(s.port);
      if (existing) {
        const needsUpdate = (s.commandLine && existing.commandLine !== s.commandLine) ||
          (s.processName && existing.processName !== s.processName);
        if (needsUpdate) {
          next.set(s.port, {
            ...existing,
            commandLine: s.commandLine ?? existing.commandLine,
            processName: s.processName ?? existing.processName,
          });
          changed = true;
        }
      }
    }
    if (changed) {
      this.configs = next;
      this.saveConfig();
    }

    this.previousPorts = currentPorts;
  }

  private async attemptRestart(config: AutoRestartConfig): Promise<void> {
    if (!isValidDevCommand(config.commandLine)) return;

    this.restartingPorts.add(config.port);

    try {
      const success = this.spawnProcess(config);
      if (success) {
        await sleep(PORT_SCAN_MS + 1000);
        const servers = this.portScanner.getDevServers();
        if (servers.some((s) => s.port === config.port)) {
          this.emit('server-restarted', { port: config.port, processName: config.processName, success: true, timestamp: Date.now() });
          return;
        }
      }

      // Retry once after 2 seconds
      await sleep(2000);
      const retry = this.spawnProcess(config);
      if (retry) {
        await sleep(PORT_SCAN_MS + 1000);
        const servers = this.portScanner.getDevServers();
        if (servers.some((s) => s.port === config.port)) {
          this.emit('server-restarted', { port: config.port, processName: config.processName, success: true, timestamp: Date.now() });
          return;
        }
      }

      // Both attempts failed
      this.emit('restart-failed', { port: config.port, processName: config.processName, success: false, timestamp: Date.now() });
      try {
        new Notification({
          title: 'Dev Server Restart Failed',
          body: `Could not restart ${config.processName || 'server'} on port ${config.port}`,
        }).show();
      } catch {
        // Notification may fail in some environments
      }
    } finally {
      this.restartingPorts.delete(config.port);
    }
  }

  private spawnProcess(config: AutoRestartConfig): boolean {
    if (!isValidDevCommand(config.commandLine)) return false;

    try {
      const cwd = inferCwd(config.commandLine);
      const child = spawn(config.commandLine, {
        shell: true,
        detached: true,
        cwd,
        stdio: 'ignore',
      });
      child.unref();
      return true;
    } catch {
      return false;
    }
  }

  private loadConfig(): void {
    try {
      if (!fs.existsSync(this.configPath)) return;
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return;

      const configs = new Map<number, AutoRestartConfig>();
      for (const item of data) {
        if (typeof item.port !== 'number' || !isValidDevPort(item.port)) continue;
        if (typeof item.commandLine !== 'string') continue;
        configs.set(item.port, {
          port: item.port,
          processName: String(item.processName ?? ''),
          commandLine: item.commandLine,
          enabled: item.enabled !== false,
        });
      }
      this.configs = configs;
    } catch {
      // Corrupted config, start fresh
    }
  }

  private saveConfig(): void {
    try {
      const data = Array.from(this.configs.values());
      fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Write failure, non-critical
    }
  }
}
