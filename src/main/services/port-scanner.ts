import { EventEmitter } from 'events';
import http from 'http';
import type { ProcessMonitor } from './process-monitor';
import type { DevServer } from '@shared/types';
import { PORT_SCAN_MS, DEV_PORT_RANGE_MIN, DEV_PORT_RANGE_MAX } from '@shared/constants';
import { getPlatform, DEV_PROCESS_NAMES } from './platform';

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 200);
}

export class PortScanner extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentServers: DevServer[] = [];

  constructor(private processMonitor: ProcessMonitor) {
    super();
  }

  start(): void {
    if (this.interval) return;
    this.scan();
    this.interval = setInterval(() => this.scan(), PORT_SCAN_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getDevServers(): DevServer[] {
    return [...this.currentServers];
  }

  async scan(): Promise<DevServer[]> {
    try {
      const platform = getPlatform();
      const entries = await platform.portOps.getListeningPorts();
      const processes = this.processMonitor.getProcesses();
      const procMap = new Map(processes.map((p) => [p.pid, p]));

      // Filter to dev port range and dev process names
      const devEntries = entries.filter((e) => {
        if (e.port < DEV_PORT_RANGE_MIN || e.port > DEV_PORT_RANGE_MAX) return false;
        const proc = procMap.get(e.pid);
        if (!proc) return false;
        return DEV_PROCESS_NAMES.has(proc.name);
      });

      // Deduplicate by port (keep first)
      const seenPorts = new Set<number>();
      const unique = devEntries.filter((e) => {
        if (seenPorts.has(e.port)) return false;
        seenPorts.add(e.port);
        return true;
      });

      // Batch-fetch PPIDs + CommandLine for all discovered PIDs
      const pids = unique.map((e) => e.pid);
      const detailsMap = await platform.portOps.getProcessDetails(pids);

      // HTTP probe all servers in parallel
      const servers = await Promise.all(
        unique.map(async (entry) => {
          const proc = procMap.get(entry.pid);
          const details = detailsMap.get(entry.pid);
          const url = `http://localhost:${entry.port}`;
          const probe = await this.httpProbe(url);

          return {
            port: entry.port,
            pid: entry.pid,
            ppid: details?.ppid,
            processName: proc?.name ?? 'unknown',
            url,
            httpStatus: probe.status,
            pageTitle: probe.title,
            ram: proc?.ram,
            cpu: proc?.cpu,
            commandLine: details?.commandLine || undefined,
          } satisfies DevServer;
        }),
      );

      this.currentServers = servers;
      this.emit('dev-servers-update', servers);
      return servers;
    } catch {
      return this.currentServers;
    }
  }

  private httpProbe(url: string): Promise<{ status?: number; title?: string }> {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (result: { status?: number; title?: string }) => {
        if (resolved) return;
        resolved = true;
        resolve(result);
      };

      const req = http.get(url, { timeout: 1000 }, (res) => {
        const status = res.statusCode;
        let body = '';

        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 4096) {
            res.destroy();
            const titleMatch = body.match(/<title[^>]*>(.*?)<\/title>/i);
            const title = titleMatch?.[1]?.trim();
            done({ status, title: title ? sanitizeTitle(title) : undefined });
          }
        });

        res.on('end', () => {
          const titleMatch = body.match(/<title[^>]*>(.*?)<\/title>/i);
          const title = titleMatch?.[1]?.trim();
          done({ status, title: title ? sanitizeTitle(title) : undefined });
        });

        res.on('error', () => {
          done({ status });
        });
      });

      req.on('error', () => {
        done({});
      });

      req.on('timeout', () => {
        req.destroy();
        done({});
      });
    });
  }
}
