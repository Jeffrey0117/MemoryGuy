import { execFile } from 'child_process'
import type { PortOps, NetstatEntry, ProcessDetail } from '../types'

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

export function createWin32PortOps(): PortOps {
  return {
    getListeningPorts(): Promise<NetstatEntry[]> {
      return new Promise((resolve) => {
        execFile('netstat', ['-ano'], { timeout: 5000 }, (err, stdout) => {
          if (err) {
            resolve([])
            return
          }

          const entries: NetstatEntry[] = []
          const lines = stdout.split('\n')

          for (const line of lines) {
            if (!line.includes('LISTENING')) continue
            const parts = line.trim().split(/\s+/)
            if (parts.length < 5) continue

            const localAddr = parts[1]
            const pid = parseInt(parts[4], 10)
            if (!Number.isFinite(pid) || pid <= 0) continue

            const colonIdx = localAddr.lastIndexOf(':')
            if (colonIdx === -1) continue
            const port = parseInt(localAddr.slice(colonIdx + 1), 10)
            if (!Number.isFinite(port)) continue

            entries.push({ port, pid })
          }

          resolve(entries)
        })
      })
    },

    getProcessDetails(pids: number[]): Promise<Map<number, ProcessDetail>> {
      if (pids.length === 0) return Promise.resolve(new Map())

      const validPids = pids.filter((p) => Number.isSafeInteger(p) && p > 0)
      if (validPids.length === 0) return Promise.resolve(new Map())

      const filter = validPids.map((p) => `ProcessId=${p}`).join(' or ')
      const psCommand = `Get-CimInstance Win32_Process -Filter '${filter}' | Select-Object ProcessId, ParentProcessId, CommandLine | ConvertTo-Csv -NoTypeInformation`

      return new Promise((resolve) => {
        execFile(
          'powershell.exe',
          ['-NoProfile', '-Command', psCommand],
          { timeout: 4000 },
          (err, stdout) => {
            if (err) {
              resolve(new Map())
              return
            }

            const map = new Map<number, ProcessDetail>()
            const lines = stdout.split('\n')

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith('"ProcessId"')) continue

              const fields = parseCsvLine(trimmed)
              if (fields.length < 2) continue
              const pid = parseInt(fields[0], 10)
              const ppid = parseInt(fields[1], 10)
              const commandLine = fields[2] ?? ''
              if (Number.isFinite(pid) && pid > 0 && Number.isFinite(ppid) && ppid >= 0) {
                map.set(pid, { ppid, commandLine })
              }
            }

            resolve(map)
          },
        )
      })
    },
  }
}
