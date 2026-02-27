import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import http from 'http';
import type { ProcessMonitor } from './process-monitor';
import type { DevServer } from '@shared/types';
import { PORT_SCAN_MS, DEV_PORT_RANGE_MIN, DEV_PORT_RANGE_MAX, DEV_PROCESS_NAMES } from '@shared/constants';

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 200);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

interface NetstatEntry {
  readonly port: number;
  readonly pid: number;
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
      const entries = await this.getListeningPorts();
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
      const detailsMap = await this.getProcessDetails(pids);

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

  private getProcessDetails(pids: number[]): Promise<Map<number, { ppid: number; commandLine: string }>> {
    if (pids.length === 0) return Promise.resolve(new Map());

    const validPids = pids.filter((p) => Number.isSafeInteger(p) && p > 0);
    if (validPids.length === 0) return Promise.resolve(new Map());

    const filter = validPids.map((p) => `ProcessId=${p}`).join(' or ');
    const psCommand = `Get-CimInstance Win32_Process -Filter '${filter}' | Select-Object ProcessId, ParentProcessId, CommandLine | ConvertTo-Csv -NoTypeInformation`;

    return new Promise((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-Command', psCommand],
        { timeout: 4000 },
        (err, stdout) => {
          if (err) {
            resolve(new Map());
            return;
          }

          const map = new Map<number, { ppid: number; commandLine: string }>();
          const lines = stdout.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('"ProcessId"')) continue;

            // CSV format: "ProcessId","ParentProcessId","CommandLine"
            // CommandLine may contain commas and quotes, so parse carefully
            const fields = parseCsvLine(trimmed);
            if (fields.length < 2) continue;
            const pid = parseInt(fields[0], 10);
            const ppid = parseInt(fields[1], 10);
            const commandLine = fields[2] ?? '';
            if (Number.isFinite(pid) && pid > 0 && Number.isFinite(ppid) && ppid >= 0) {
              map.set(pid, { ppid, commandLine });
            }
          }

          resolve(map);
        },
      );
    });
  }

  private getListeningPorts(): Promise<NetstatEntry[]> {
    return new Promise((resolve) => {
      execFile('netstat', ['-ano'], { timeout: 5000 }, (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }

        const entries: NetstatEntry[] = [];
        const lines = stdout.split('\n');

        for (const line of lines) {
          if (!line.includes('LISTENING')) continue;
          // Format: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
          const parts = line.trim().split(/\s+/);
          if (parts.length < 5) continue;

          const localAddr = parts[1];
          const pid = parseInt(parts[4], 10);
          if (!Number.isFinite(pid) || pid <= 0) continue;

          const colonIdx = localAddr.lastIndexOf(':');
          if (colonIdx === -1) continue;
          const port = parseInt(localAddr.slice(colonIdx + 1), 10);
          if (!Number.isFinite(port)) continue;

          entries.push({ port, pid });
        }

        resolve(entries);
      });
    });
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
