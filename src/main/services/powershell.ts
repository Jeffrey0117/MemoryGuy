import { execFile } from 'child_process';

const PS_TIMEOUT = 15_000;
const MAX_BUFFER = 4 * 1024 * 1024; // 4 MB

export function runPs(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: PS_TIMEOUT, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || err.message));
        } else {
          resolve(stdout.trim());
        }
      },
    );
  });
}

/** Escape a string for use inside PowerShell single quotes: ' → '' */
export function psEscape(s: string): string {
  return s.replace(/'/g, "''");
}
