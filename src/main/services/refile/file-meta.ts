import fs from 'node:fs'

export interface FileMeta {
  readonly mode: number
  readonly mtime: number
  readonly atime: number
}

export function getFileMeta(filePath: string): FileMeta {
  const stat = fs.statSync(filePath)
  return {
    mode: stat.mode,
    mtime: stat.mtimeMs,
    atime: stat.atimeMs,
  }
}

export function restoreFileMeta(filePath: string, meta: FileMeta): void {
  try {
    fs.chmodSync(filePath, meta.mode)
  } catch {
    // Windows has limited chmod support
  }
  try {
    fs.utimesSync(filePath, new Date(meta.atime), new Date(meta.mtime))
  } catch {
    // Best effort
  }
}
