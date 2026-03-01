import { exec, execFile } from 'child_process'
import type { ProcessOps, TrimOpsResult } from '../types'
import { TRIM_POWERSHELL_TIMEOUT_MS } from '../constants'

export function createWin32ProcessOps(): ProcessOps {
  return {
    killByPid(pid: number): Promise<{ success: boolean; error?: string }> {
      return new Promise((resolve) => {
        exec(`taskkill /F /PID ${pid}`, (err, _stdout, stderr) => {
          if (err) {
            resolve({ success: false, error: stderr.trim() || err.message })
          } else {
            resolve({ success: true })
          }
        })
      })
    },

    trimWorkingSets(pids: readonly number[]): Promise<TrimOpsResult> {
      if (pids.length === 0) {
        return Promise.resolve({ trimmed: [], failed: [] })
      }

      const pidArray = pids.join(',')
      const script = [
        'Add-Type -TypeDefinition @"',
        'using System;',
        'using System.Runtime.InteropServices;',
        'public class MemTrimmer {',
        '    [DllImport("psapi.dll")]',
        '    public static extern bool EmptyWorkingSet(IntPtr hProcess);',
        '    [DllImport("kernel32.dll")]',
        '    public static extern IntPtr OpenProcess(int access, bool inherit, int pid);',
        '    [DllImport("kernel32.dll")]',
        '    public static extern bool CloseHandle(IntPtr handle);',
        '    [DllImport("advapi32.dll", SetLastError=true)]',
        '    public static extern bool OpenProcessToken(IntPtr proc, int access, out IntPtr token);',
        '    [DllImport("advapi32.dll", SetLastError=true)]',
        '    public static extern bool LookupPrivilegeValue(string host, string name, out long luid);',
        '    [DllImport("advapi32.dll", SetLastError=true)]',
        '    public static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TOKEN_PRIVILEGES newState, int bufLen, IntPtr prev, IntPtr retLen);',
        '    [StructLayout(LayoutKind.Sequential)]',
        '    public struct TOKEN_PRIVILEGES {',
        '        public int PrivilegeCount;',
        '        public long Luid;',
        '        public int Attributes;',
        '    }',
        '}',
        '"@',
        'try {',
        '    $tp = New-Object MemTrimmer+TOKEN_PRIVILEGES',
        '    $tp.PrivilegeCount = 1',
        '    $tp.Attributes = 2',
        '    $luid = [long]0',
        '    [MemTrimmer]::LookupPrivilegeValue($null, "SeDebugPrivilege", [ref]$luid) | Out-Null',
        '    $tp.Luid = $luid',
        '    $tok = [IntPtr]::Zero',
        '    [MemTrimmer]::OpenProcessToken([System.Diagnostics.Process]::GetCurrentProcess().Handle, 0x0028, [ref]$tok) | Out-Null',
        '    [MemTrimmer]::AdjustTokenPrivileges($tok, $false, [ref]$tp, 0, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null',
        '} catch {}',
        '$results = @()',
        `foreach ($pid in @(${pidArray})) {`,
        '    try {',
        '        $h = [MemTrimmer]::OpenProcess(0x0500, $false, $pid)',
        '        if ($h -ne [IntPtr]::Zero) {',
        '            $ok = [MemTrimmer]::EmptyWorkingSet($h)',
        '            [MemTrimmer]::CloseHandle($h) | Out-Null',
        '            $results += @{ pid = $pid; ok = $ok }',
        '        }',
        '    } catch {',
        '        $results += @{ pid = $pid; ok = $false; err = $_.Exception.Message }',
        '    }',
        '}',
        'if ($results.Count -eq 0) { "[]" } else { $results | ConvertTo-Json -Compress }',
      ].join('\n')

      return new Promise((resolve) => {
        execFile(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', script],
          { timeout: TRIM_POWERSHELL_TIMEOUT_MS },
          (err, stdout, stderr) => {
            if (err) {
              resolve({
                trimmed: [],
                failed: [...pids].map((pid) => ({
                  pid,
                  error: stderr?.trim() || err.message,
                })),
              })
              return
            }

            try {
              const raw = JSON.parse(stdout.trim())
              const results: { pid: number; ok: boolean; err?: string }[] =
                Array.isArray(raw) ? raw : [raw]

              const trimmed: number[] = []
              const failed: { pid: number; error: string }[] = []

              for (const r of results) {
                if (r.ok) {
                  trimmed.push(r.pid)
                } else {
                  failed.push({ pid: r.pid, error: r.err ?? 'EmptyWorkingSet failed' })
                }
              }

              resolve({ trimmed, failed })
            } catch {
              resolve({
                trimmed: [],
                failed: [...pids].map((pid) => ({
                  pid,
                  error: 'Failed to parse PowerShell output',
                })),
              })
            }
          },
        )
      })
    },
  }
}
