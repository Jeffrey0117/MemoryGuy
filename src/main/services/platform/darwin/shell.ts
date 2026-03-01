import { execFile } from 'child_process'

const CMD_TIMEOUT = 15_000
const MAX_BUFFER = 4 * 1024 * 1024 // 4 MB

export function runCmd(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      '/bin/sh',
      ['-c', command],
      { timeout: CMD_TIMEOUT, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || err.message))
        } else {
          resolve(stdout.trim())
        }
      },
    )
  })
}

/** Escape a string for use in shell single quotes: ' -> '\'' */
export function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''")
}
