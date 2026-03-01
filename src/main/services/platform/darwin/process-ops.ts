import { execFile } from 'child_process'
import type { ProcessOps, TrimOpsResult } from '../types'

export function createDarwinProcessOps(): ProcessOps {
  return {
    killByPid(pid: number): Promise<{ success: boolean; error?: string }> {
      return new Promise((resolve) => {
        execFile('kill', ['-9', String(pid)], (err, _stdout, stderr) => {
          if (err) {
            resolve({ success: false, error: stderr.trim() || err.message })
          } else {
            resolve({ success: true })
          }
        })
      })
    },

    trimWorkingSets(_pids: readonly number[]): Promise<TrimOpsResult> {
      // macOS has no equivalent to Windows EmptyWorkingSet API
      return Promise.resolve({ trimmed: [], failed: [] })
    },
  }
}
