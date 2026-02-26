import { exec, execFile } from 'child_process';
import { SYSTEM_PROTECTED, TRIM_POWERSHELL_TIMEOUT_MS } from '@shared/constants';

export function killByPid(
  pid: number,
  processName?: string,
): Promise<{ success: boolean; error?: string }> {
  // Strict PID validation to prevent command injection
  if (!Number.isInteger(pid) || pid <= 4) {
    return Promise.resolve({
      success: false,
      error: `Invalid or protected PID: ${pid}`,
    });
  }

  // Don't kill MemoryGuy itself
  if (pid === process.pid) {
    return Promise.resolve({
      success: false,
      error: 'Cannot kill MemoryGuy process',
    });
  }

  // Block system-critical processes
  if (processName && SYSTEM_PROTECTED.has(processName)) {
    return Promise.resolve({
      success: false,
      error: `Cannot kill system-critical process: ${processName}`,
    });
  }

  return new Promise((resolve) => {
    exec(`taskkill /F /PID ${pid}`, (err, _stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr.trim() || err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

/**
 * Trim working sets of multiple processes using Windows EmptyWorkingSet API.
 * Non-destructive: reclaims unused memory without killing any process.
 */
export function trimWorkingSets(
  pids: readonly number[],
): Promise<{ trimmed: number[]; failed: { pid: number; error: string }[] }> {
  const validPids = pids.filter(
    (pid) => Number.isInteger(pid) && pid > 4 && pid !== process.pid,
  );

  if (validPids.length === 0) {
    return Promise.resolve({ trimmed: [], failed: [] });
  }

  // Single PowerShell invocation for all PIDs — much faster than one per PID
  const pidArray = validPids.join(',');
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
    '}',
    '"@',
    '$results = @()',
    `foreach ($pid in @(${pidArray})) {`,
    '    try {',
    '        $h = [MemTrimmer]::OpenProcess(0x0500, $false, $pid)',
    '        if ($h -ne [IntPtr]::Zero) {',
    '            $ok = [MemTrimmer]::EmptyWorkingSet($h)',
    '            [MemTrimmer]::CloseHandle($h) | Out-Null',
    '            $results += @{ pid = $pid; ok = $ok }',
    '        } else {',
    '            $results += @{ pid = $pid; ok = $false; err = "OpenProcess failed" }',
    '        }',
    '    } catch {',
    '        $results += @{ pid = $pid; ok = $false; err = $_.Exception.Message }',
    '    }',
    '}',
    '$results | ConvertTo-Json -Compress',
  ].join('\n');

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: TRIM_POWERSHELL_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          resolve({
            trimmed: [],
            failed: validPids.map((pid) => ({
              pid,
              error: stderr?.trim() || err.message,
            })),
          });
          return;
        }

        try {
          const raw = JSON.parse(stdout.trim());
          // PowerShell returns single object (not array) when only 1 result
          const results: { pid: number; ok: boolean; err?: string }[] =
            Array.isArray(raw) ? raw : [raw];

          const trimmed: number[] = [];
          const failed: { pid: number; error: string }[] = [];

          for (const r of results) {
            if (r.ok) {
              trimmed.push(r.pid);
            } else {
              failed.push({ pid: r.pid, error: r.err ?? 'EmptyWorkingSet failed' });
            }
          }

          resolve({ trimmed, failed });
        } catch {
          resolve({
            trimmed: [],
            failed: validPids.map((pid) => ({
              pid,
              error: 'Failed to parse PowerShell output',
            })),
          });
        }
      },
    );
  });
}
