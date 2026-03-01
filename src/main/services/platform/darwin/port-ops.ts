import { execFile } from 'child_process'
import type { PortOps, NetstatEntry, ProcessDetail } from '../types'

export function createDarwinPortOps(): PortOps {
  return {
    getListeningPorts(): Promise<NetstatEntry[]> {
      return new Promise((resolve) => {
        // lsof -iTCP -sTCP:LISTEN -P -n -F pn
        // Output format (per entry):
        //   p<pid>
        //   n<host>:<port>
        execFile('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n', '-F', 'pn'], { timeout: 5000 }, (err, stdout) => {
          if (err) {
            resolve([])
            return
          }

          const entries: NetstatEntry[] = []
          let currentPid = -1

          for (const line of stdout.split('\n')) {
            if (line.startsWith('p')) {
              currentPid = parseInt(line.slice(1), 10)
            } else if (line.startsWith('n') && currentPid > 0) {
              const addr = line.slice(1)
              const colonIdx = addr.lastIndexOf(':')
              if (colonIdx === -1) continue
              const port = parseInt(addr.slice(colonIdx + 1), 10)
              if (Number.isFinite(port) && port > 0) {
                entries.push({ port, pid: currentPid })
              }
            }
          }

          resolve(entries)
        })
      })
    },

    getProcessDetails(pids: number[]): Promise<Map<number, ProcessDetail>> {
      if (pids.length === 0) return Promise.resolve(new Map())

      const validPids = pids.filter((p) => Number.isSafeInteger(p) && p > 0)
      if (validPids.length === 0) return Promise.resolve(new Map())

      // ps -o ppid=,args= -p <pid1>,<pid2>,...
      const pidList = validPids.join(',')

      return new Promise((resolve) => {
        execFile('ps', ['-o', 'pid=,ppid=,args=', '-p', pidList], { timeout: 4000 }, (err, stdout) => {
          if (err) {
            resolve(new Map())
            return
          }

          const map = new Map<number, ProcessDetail>()

          for (const line of stdout.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue
            // Format: "  PID  PPID  ARGS..."
            const match = trimmed.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
            if (!match) continue
            const pid = parseInt(match[1], 10)
            const ppid = parseInt(match[2], 10)
            const commandLine = match[3] ?? ''
            if (Number.isFinite(pid) && pid > 0 && Number.isFinite(ppid) && ppid >= 0) {
              map.set(pid, { ppid, commandLine })
            }
          }

          resolve(map)
        })
      })
    },
  }
}
