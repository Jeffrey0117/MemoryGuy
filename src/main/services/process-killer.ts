import { exec } from 'child_process';

const SYSTEM_BLOCKLIST = new Set([
  'System',
  'System Idle Process',
  'Registry',
  'Memory Compression',
  'explorer.exe',
  'csrss.exe',
  'winlogon.exe',
  'lsass.exe',
  'services.exe',
  'svchost.exe',
  'smss.exe',
  'wininit.exe',
  'dwm.exe',
  'fontdrvhost.exe',
  'sihost.exe',
  'taskhostw.exe',
]);

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
  if (processName && SYSTEM_BLOCKLIST.has(processName)) {
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
